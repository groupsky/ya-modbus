/**
 * Data points of the Microsyst SR04 and where each one lives.
 *
 * The blocks are the same requests the old homy reader made on the real device. The manual
 * (revision 2020-10-30, pages 15-16) says the device has an 80 byte buffer, so a block must stay
 * small: the largest here answers 70 bytes of data.
 */

import { readScaledInt16BE } from '@ya-modbus/driver-sdk'
import type { DataPoint, PollType, Unit } from '@ya-modbus/driver-types'

import { CLOCK_ADDRESS, CLOCK_REGISTERS, decodeClock, decodeWeekDay } from './clock.js'

/** One read request */
export interface Block {
  table: 'coils' | 'holding'
  address: number
  count: number
}

const STATUS_COILS: Block = { table: 'coils', address: 296, count: 64 }
const SERIAL_COILS: Block = { table: 'coils', address: 1000, count: 4 }
const OUTPUT_COILS: Block = { table: 'coils', address: 2864, count: 40 }
const SETTINGS_1: Block = { table: 'holding', address: 0, count: 35 }
const SETTINGS_2: Block = { table: 'holding', address: 35, count: 14 }
const ADDRESS: Block = { table: 'holding', address: 127, count: 1 }
const MEASUREMENTS: Block = { table: 'holding', address: 557, count: 11 }
export const CLOCK: Block = { table: 'holding', address: CLOCK_ADDRESS, count: CLOCK_REGISTERS }

/** A temperature register holds this value when the sensor gives no reading */
export const NO_SENSOR = 2070

export interface Register {
  block: Block
  point: DataPoint
  /** Value from the buffer of the block */
  decode: (buffer: Buffer) => unknown
}

const coil = (block: Block, address: number) => (buffer: Buffer) => {
  const bit = address - block.address
  return (((buffer[bit >> 3] as number) >> (bit & 7)) & 1) === 1
}

const offset = (block: Block, address: number): number => (address - block.address) * 2

const int16 = (block: Block, address: number) => (buffer: Buffer) =>
  buffer.readInt16BE(offset(block, address))

const tenths = (block: Block, address: number) => (buffer: Buffer) =>
  readScaledInt16BE(buffer, offset(block, address), 10)

const temperature = (block: Block, address: number) => (buffer: Buffer) =>
  buffer.readInt16BE(offset(block, address)) === NO_SENSOR ? null : tenths(block, address)(buffer)

interface Options {
  name: string
  description: string
  unit?: Unit
  pollType?: PollType
  min?: number
  max?: number
  decimals?: number
  enumValues?: Record<string, string>
}

function point(
  id: string,
  type: DataPoint['type'],
  block: Block,
  decode: Register['decode'],
  { pollType = 'dynamic', ...options }: Options
): Register {
  return { block, decode, point: { id, type, access: 'r', pollType, ...options } }
}

const statusCoil = (id: string, address: number, name: string, description: string): Register =>
  point(id, 'boolean', STATUS_COILS, coil(STATUS_COILS, address), { name, description })

const output = (n: number): Register =>
  point(`output_p${n}`, 'boolean', OUTPUT_COILS, coil(OUTPUT_COILS, 2895 + n), {
    name: `Output P${n}`,
    description: `Relay output P${n} is on`,
  })

const sensor = (n: number, description: string): Register =>
  point(`t${n}_temperature`, 'float', MEASUREMENTS, temperature(MEASUREMENTS, 559 + n), {
    name: `T${n} temperature`,
    description: `${description}. null when the register holds ${NO_SENSOR} (no sensor)`,
    unit: '°C',
    decimals: 1,
  })

const setting = (
  id: string,
  address: number,
  name: string,
  description: string,
  unit?: Unit
): Register => {
  const block = address < SETTINGS_2.address ? SETTINGS_1 : SETTINGS_2
  return point(id, 'integer', block, int16(block, address), {
    name,
    description,
    pollType: 'static',
    ...(unit && { unit }),
  })
}

const hysteresis = (id: string, address: number, name: string, description: string): Register =>
  point(id, 'float', SETTINGS_1, tenths(SETTINGS_1, address), {
    name,
    description,
    unit: '°C',
    pollType: 'static',
    decimals: 1,
  })

const serialCoil = (address: number): ((buffer: Buffer) => boolean) => coil(SERIAL_COILS, address)

export const REGISTERS: ReadonlyArray<Register> = [
  // Status coils
  statusCoil('boiler_low_enabled', 296, 'Boiler low (E1)', 'Coil "BOILER LOW E1"'),
  statusCoil('solar2_enabled', 297, 'Solar 2 (E4)', 'Coil "SOLAR 2 E4"'),
  statusCoil('storage_tank_enabled', 298, 'Storage tank (E5)', 'Coil "ACCUMUL. E5"'),
  statusCoil('heating_enabled', 299, 'Heat installation (E6)', 'Coil "HEAT INSTALLATION E6"'),
  statusCoil('pool_enabled', 300, 'Pool (E7)', 'Coil "POOL E7"'),
  statusCoil('stove_enabled', 301, 'Chimney (E8)', 'Coil "CHIMNEY E8"'),
  statusCoil('sensor_type', 302, 'Sensor type', 'Coil "TYPE SENS" (PT1000 or NTC)'),
  statusCoil('trial', 303, 'Trial', 'Coil "TRIAL": the trial period is on'),
  statusCoil('priority', 352, 'Priority', 'Coil "PRIOR": pool or storage tank first'),
  statusCoil('summer_winter', 353, 'Summer / winter', 'Coil "SUM-WIN": summer or winter mode'),

  // Measurements
  point('sensor_error', 'integer', MEASUREMENTS, (b) => b[1], {
    name: 'Sensor error',
    description: 'Low byte of register "SENS ERR"',
  }),
  point('adc2', 'integer', MEASUREMENTS, int16(MEASUREMENTS, 558), {
    name: 'ADC2',
    description: 'Raw value of ADC2',
  }),
  point('adc3', 'integer', MEASUREMENTS, int16(MEASUREMENTS, 559), {
    name: 'ADC3',
    description: 'Raw value of ADC3',
  }),
  sensor(1, 'Boiler, lower sensor'),
  sensor(2, 'Boiler, top sensor'),
  sensor(3, 'Solar collector 1'),
  sensor(4, 'Solar collector 2'),
  sensor(5, 'Storage tank'),
  sensor(6, 'Return from the heating system'),
  sensor(7, 'Pool'),
  sensor(8, 'Stove or fireplace'),

  // Settings: calibration and filter
  setting('calibration_ntc_53_41k', 0, 'Calibration NTC 53.41k', 'Factory calibration value'),
  setting('calibration_ntc_2_588k', 2, 'Calibration NTC 2.588k', 'Factory calibration value'),
  setting('calibration_pt_1_000k', 4, 'Calibration PT 1.000k', 'Factory calibration value'),
  setting('calibration_pt_1_385k', 6, 'Calibration PT 1.385k', 'Factory calibration value'),
  setting('filter', 12, 'Filter', 'Filter of measurements, 1-100: a smaller value filters more'),
  setting('adc_jump', 13, 'ADC jump', 'Register "ADC Jump"'),
  setting('jump_time', 14, 'Jump time', 'Register "Jump time"'),

  // Settings: electric heater time windows
  setting('heater_on1', 15, 'Heater on 1', 'Hour 0-23 to switch the electric heater on'),
  setting('heater_off1', 16, 'Heater off 1', 'Hour 0-23 to switch the electric heater off'),
  setting('heater_on2', 17, 'Heater on 2', 'Hour 0-23 to switch the electric heater on'),
  setting('heater_off2', 18, 'Heater off 2', 'Hour 0-23 to switch the electric heater off'),
  setting('heater_on3', 19, 'Heater on 3', 'Hour 0-23 to switch the electric heater on'),
  setting('heater_off3', 20, 'Heater off 3', 'Hour 0-23 to switch the electric heater off'),

  // Settings: temperatures
  setting('t1_setpoint', 21, 'SP T1', 'Boiler set point for heating from sun or stove', '°C'),
  setting('t2_max', 22, 'Max T2', 'Max boiler temperature (T2)', '°C'),
  setting('t3_t4_max', 23, 'Max T3, T4', 'Max collector temperature', '°C'),
  setting('t3_t4_min', 24, 'Min T3, T4', 'Min collector temperature for exchange', '°C'),
  setting('freeze', 25, 'Freeze', 'Collector freeze protection temperature', '°C'),
  setting('delta', 26, 'Delta', 'Temperature difference to start an exchange', '°C'),
  setting('tolerance', 27, 'Tolerance', 'Tolerance of the solar panel to the heater', '°C'),
  hysteresis('hysteresis', 28, 'H', 'Hysteresis of the pumps P1 and P2'),
  hysteresis('hysteresis2', 29, 'H2', 'Hysteresis of the electric heater (P6)'),
  hysteresis('hysteresis3', 30, 'H3', 'Hysteresis in all other cases'),
  setting('t5_setpoint', 31, 'SP T5', 'Storage tank set point', '°C'),
  setting('t7_setpoint', 32, 'SP T7', 'Pool set point', '°C'),
  setting('t8_min', 33, 'Min T8', 'Min stove temperature for exchange', '°C'),
  setting('t8_max', 34, 'Max T8', 'Max stove temperature', '°C'),
  setting('t8_freeze', 35, 'Freeze T8', 'Stove freeze protection temperature', '°C'),

  // Settings: scheme, pump kick, heater
  setting('scheme', 36, 'Scheme', 'Basic scheme, 1 or 2'),
  setting('kick_off', 38, 'Kick off', 'Hour 0-23 to stop the "actuality of measurements"'),
  setting('kick_on', 39, 'Kick on', 'Hour 0-23 to start the "actuality of measurements"'),
  setting('kick_pause', 40, 'Kick pause', 'Pause of a pump before it is kicked', 'min'),
  setting('kick_time', 41, 'Kick time', 'How long a pump is kicked', 's'),
  setting('time_05c', 42, 'Time 0.5 C', 'Time to watch for a rise of 0.5 °C after a kick', 's'),
  setting('heater_setpoint', 43, 'Heat SP', 'Set point of the electric heater', '°C'),
  setting('trial_time', 45, 'Trial time', 'Register "TRIAL TIME"'),
  setting('decimal_point', 48, 'D point', 'Display: 0 = whole degrees, 1-6 = tenths'),

  // Serial settings
  point('stop_bits', 'integer', SERIAL_COILS, (b) => (serialCoil(1000)(b) ? 2 : 1), {
    name: 'Stop bits',
    description: 'Coil 1000 "TX 9 bit": 1 = two stop bits, 0 = one',
    pollType: 'static',
  }),
  point('parity', 'enum', SERIAL_COILS, (b) => (serialCoil(1001)(b) ? 'even' : 'none'), {
    name: 'Parity',
    description: 'Coil 1001: 1 = even parity, 0 = no parity',
    pollType: 'static',
    enumValues: { none: 'No parity', even: 'Even parity' },
  }),
  point('baud_rate', 'integer', SERIAL_COILS, (b) => (serialCoil(1002)(b) ? 19200 : 9600), {
    name: 'Baud rate',
    description: 'Coil 1002: 1 = 19200, 0 = 9600',
    pollType: 'static',
  }),
  point('broadcast', 'boolean', SERIAL_COILS, (b) => !serialCoil(1003)(b), {
    name: 'Broadcast',
    description: 'The device takes broadcast requests (coil 1003 "NO BROADCAST" is 0)',
    pollType: 'static',
  }),
  point('address', 'integer', ADDRESS, int16(ADDRESS, 127), {
    name: 'Modbus address',
    description: 'Modbus address set in the device',
    pollType: 'static',
  }),

  // Outputs
  point('fast', 'boolean', OUTPUT_COILS, coil(OUTPUT_COILS, 2865), {
    name: 'Fast',
    description: 'Coil "FAST"',
  }),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(output),

  // Clock
  {
    block: CLOCK,
    decode: decodeClock,
    point: {
      id: 'clock',
      name: 'Clock',
      type: 'timestamp',
      access: 'rw',
      pollType: 'dynamic',
      description:
        'Clock of the device as local date-time YYYY-MM-DDTHH:MM:SS, without a time zone. ' +
        'A write sets the week day from the date',
    },
  },
  point('clock_week_day', 'integer', CLOCK, decodeWeekDay, {
    name: 'Clock week day',
    description: 'Week day of the clock, 0 = Sunday to 6 = Saturday',
    min: 0,
    max: 6,
  }),
]
