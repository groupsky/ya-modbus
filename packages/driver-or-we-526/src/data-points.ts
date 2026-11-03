/**
 * Data points of the ORNO OR-WE-526 and where each one lives.
 *
 * Registers come from ORNO's register list for the OR-WE-524, OR-WE-525 and OR-WE-526
 * (PDF made 2023-05-31). All registers are holding registers (function code 03). 32-bit values
 * are read high word first, as the old homy reader does on the real meter.
 */

import { readScaledInt16BE } from '@ya-modbus/driver-sdk'
import type { DataPoint, PollType, Unit } from '@ya-modbus/driver-types'

/** One read request of holding registers */
export interface Block {
  address: number
  count: number
}

/** Voltage, current, powers, frequency and power factor (0x100-0x10B) */
const INSTANT: Block = { address: 0x100, count: 12 }
/** Forward, reverse and total energy with tariffs T1-T4 (0x10E-0x149) */
const ENERGY: Block = { address: 0x10e, count: 60 }
/** Reactive energy per quadrant and the resettable energy (0x14A-0x175) */
const QUADRANTS: Block = { address: 0x14a, count: 44 }
/** Demand (0x176-0x187). 0x17E-0x17F are not in the list; the old reader read them too */
const DEMAND: Block = { address: 0x176, count: 18 }
/** Serial number, address, versions and checksum (0x1000-0x1006) */
const METER: Block = { address: 0x1000, count: 7 }
/** Clock and scrolling time (0x1007-0x100B) */
const CLOCK: Block = { address: 0x1007, count: 5 }
/** Serial settings, combined code, demand, display and password (0x100C-0x1016) */
const SETTINGS: Block = { address: 0x100c, count: 11 }
/** Running time and timing current (0x1018-0x101B) */
const RUNNING: Block = { address: 0x1018, count: 4 }

export interface Register {
  block: Block
  point: DataPoint
  /** Value from the buffer of the block */
  decode: (buffer: Buffer) => unknown
}

const offset = (block: Block, address: number): number => (address - block.address) * 2

/** Signed 32-bit value, high word first, divided by `scale` */
const int32 =
  (block: Block, address: number, scale = 1) =>
  (buffer: Buffer): number =>
    buffer.readInt32BE(offset(block, address)) / scale

/** Signed 16-bit value divided by `scale` */
const int16 =
  (block: Block, address: number, scale: number) =>
  (buffer: Buffer): number =>
    readScaledInt16BE(buffer, offset(block, address), scale)

const uint16 =
  (block: Block, address: number) =>
  (buffer: Buffer): number =>
    buffer.readUInt16BE(offset(block, address))

/** Registers as hex digits, 4 per register */
const hex =
  (block: Block, address: number, registers: number) =>
  (buffer: Buffer): string => {
    const start = offset(block, address)
    return buffer.toString('hex', start, start + registers * 2)
  }

/** A code from a table, or null for a code that is not in the table */
const code =
  <T>(block: Block, address: number, table: Record<number, T>) =>
  (buffer: Buffer): T | null =>
    table[buffer.readUInt16BE(offset(block, address))] ?? null

interface Options {
  name: string
  description: string
  unit?: Unit
  decimals?: number
  pollType?: PollType
  enumValues?: Record<string | number, string>
}

function point(
  id: string,
  type: DataPoint['type'],
  block: Block,
  decode: Register['decode'],
  options: Options
): Register {
  return { block, decode, point: { id, type, access: 'r', ...options } }
}

/** Settings and identity are read once, when the bridge starts */
const once = { pollType: 'static' } as const

// ---------------------------------------------------------------------------
// Energy: each value comes as total, T1, T2, T3, T4 in 5 neighbouring pairs
// ---------------------------------------------------------------------------

const TARIFFS = ['', '_t1', '_t2', '_t3', '_t4'] as const

/**
 * Total and T1-T4 of one energy value, kWh or kVArh with 2 decimals.
 * On a meter without tariffs, T1 equals the total and T2-T4 are 0.
 */
function energy(
  block: Block,
  first: number,
  id: string,
  name: string,
  unit: 'kWh' | 'kVArh'
): Register[] {
  return TARIFFS.map((suffix, i) => {
    const tariff = suffix ? ` ${suffix.slice(1).toUpperCase()}` : ''
    return point(`${id}${suffix}`, 'float', block, int32(block, first + i * 2, 100), {
      name: `${name}${tariff}`,
      description: `${name}${tariff ? `, tariff${tariff}` : ', all tariffs'}`,
      unit,
      decimals: 2,
    })
  })
}

function demand(address: number, id: string, name: string, unit: 'W' | 'VAr'): Register {
  return point(id, 'float', DEMAND, int32(DEMAND, address, 10), {
    name,
    description: name,
    unit,
    decimals: 1,
  })
}

const BAUD_RATES: Record<number, number> = { 6: 9600, 7: 19200, 8: 38400, 9: 115200 }
const PARITIES: Record<number, string> = { 0: 'none', 1: 'odd', 2: 'even' }
const COMBINED_CODES: Record<number, string> = {
  1: 'forward',
  2: 'reverse',
  3: 'forward+reverse',
  4: 'forward-reverse',
}
const DEMAND_MODES: Record<number, string> = { 0: 'interval', 1: 'slip' }

/**
 * The meter clock (0x1007-0x100A) as local date-time `YYYY-MM-DDTHH:MM:SS`, without a time zone.
 * Bytes: 0, year, month, day, week day, hour, minute, second; each one BCD (0x26 = 26).
 * The week day is not used.
 */
function decodeClock(buffer: Buffer): string {
  const byte = (i: number): string => buffer.toString('hex', i, i + 1)
  return `20${byte(1)}-${byte(2)}-${byte(3)}T${byte(5)}:${byte(6)}:${byte(7)}`
}

export const REGISTERS: ReadonlyArray<Register> = [
  // Instantaneous values
  point('voltage', 'float', INSTANT, int32(INSTANT, 0x100, 1000), {
    name: 'Voltage',
    description: 'Line voltage',
    unit: 'V',
    decimals: 3,
  }),
  point('current', 'float', INSTANT, int32(INSTANT, 0x102, 1000), {
    name: 'Current',
    description: 'Line current, forward and reverse',
    unit: 'A',
    decimals: 3,
  }),
  point('active_power', 'integer', INSTANT, int32(INSTANT, 0x104), {
    name: 'Active Power',
    description: 'Active power, negative for reverse',
    unit: 'W',
  }),
  point('apparent_power', 'integer', INSTANT, int32(INSTANT, 0x106), {
    name: 'Apparent Power',
    description: 'Apparent power',
    unit: 'VA',
  }),
  point('reactive_power', 'integer', INSTANT, int32(INSTANT, 0x108), {
    name: 'Reactive Power',
    description: 'Reactive power',
    unit: 'VAr',
  }),
  point('frequency', 'float', INSTANT, int16(INSTANT, 0x10a, 10), {
    name: 'Grid Frequency',
    description: 'Grid frequency',
    unit: 'Hz',
    decimals: 1,
  }),
  point('power_factor', 'float', INSTANT, int16(INSTANT, 0x10b, 1000), {
    name: 'Power Factor',
    description: 'Power factor, with the sign of the active power',
    decimals: 3,
  }),

  // Energy
  ...energy(ENERGY, 0x10e, 'active_energy_forward', 'Forward Active Energy', 'kWh'),
  ...energy(ENERGY, 0x118, 'active_energy_reverse', 'Reverse Active Energy', 'kWh'),
  ...energy(ENERGY, 0x122, 'active_energy_total', 'Total Active Energy', 'kWh'),
  ...energy(ENERGY, 0x12c, 'reactive_energy_forward', 'Forward Reactive Energy', 'kVArh'),
  ...energy(ENERGY, 0x136, 'reactive_energy_reverse', 'Reverse Reactive Energy', 'kVArh'),
  ...energy(ENERGY, 0x140, 'reactive_energy_total', 'Total Reactive Energy', 'kVArh'),
  ...energy(QUADRANTS, 0x14a, 'reactive_energy_q1', 'Reactive Energy Quadrant 1', 'kVArh'),
  ...energy(QUADRANTS, 0x154, 'reactive_energy_q2', 'Reactive Energy Quadrant 2', 'kVArh'),
  ...energy(QUADRANTS, 0x15e, 'reactive_energy_q3', 'Reactive Energy Quadrant 3', 'kVArh'),
  ...energy(QUADRANTS, 0x168, 'reactive_energy_q4', 'Reactive Energy Quadrant 4', 'kVArh'),
  point('active_energy_resettable', 'float', QUADRANTS, int32(QUADRANTS, 0x172, 100), {
    name: 'Resettable Active Energy',
    description: 'Total active energy since the last reset',
    unit: 'kWh',
    decimals: 2,
  }),
  point('reactive_energy_resettable', 'float', QUADRANTS, int32(QUADRANTS, 0x174, 100), {
    name: 'Resettable Reactive Energy',
    description: 'Total reactive energy since the last reset',
    unit: 'kVArh',
    decimals: 2,
  }),

  // Demand
  demand(0x176, 'active_power_demand_forward', 'Forward Active Demand', 'W'),
  demand(0x178, 'active_power_demand_forward_max', 'Forward Maximum Active Demand', 'W'),
  demand(0x17a, 'active_power_demand_reverse', 'Reverse Active Demand', 'W'),
  demand(0x17c, 'active_power_demand_reverse_max', 'Reverse Maximum Active Demand', 'W'),
  demand(0x180, 'reactive_power_demand_forward', 'Forward Reactive Demand', 'VAr'),
  demand(0x182, 'reactive_power_demand_forward_max', 'Forward Maximum Reactive Demand', 'VAr'),
  demand(0x184, 'reactive_power_demand_reverse', 'Reverse Reactive Demand', 'VAr'),
  demand(0x186, 'reactive_power_demand_reverse_max', 'Reverse Maximum Reactive Demand', 'VAr'),

  // Identity
  point('serial_number', 'string', METER, hex(METER, 0x1000, 3), {
    name: 'Serial Number',
    description: 'Serial number, 12 digits',
    ...once,
  }),
  point('device_address', 'integer', METER, uint16(METER, 0x1003), {
    name: 'Device Address',
    description: 'Modbus address set in the meter (1-247)',
    ...once,
  }),
  point('software_version', 'integer', METER, uint16(METER, 0x1004), {
    name: 'Software Version',
    description: 'Firmware version',
    ...once,
  }),
  point('hardware_version', 'integer', METER, uint16(METER, 0x1005), {
    name: 'Hardware Version',
    description: 'Hardware version',
    ...once,
  }),
  point('firmware_checksum', 'integer', METER, uint16(METER, 0x1006), {
    name: 'Firmware Checksum',
    description: 'Firmware checksum',
    ...once,
  }),

  // Clock
  point('clock', 'timestamp', CLOCK, decodeClock, {
    name: 'Clock',
    description:
      'Clock of the meter as local date-time YYYY-MM-DDTHH:MM:SS, without a time zone. ' +
      'Only the multi-tariff version has a clock',
  }),

  // Settings
  point('scroll_time', 'integer', CLOCK, uint16(CLOCK, 0x100b), {
    name: 'Scrolling Time',
    description: 'Time each screen stays on the display (0-99)',
    unit: 's',
    ...once,
  }),
  point('baud_rate', 'enum', SETTINGS, code(SETTINGS, 0x100c, BAUD_RATES), {
    name: 'Baud Rate',
    description: 'Serial baud rate',
    enumValues: { 9600: '9600 bps', 19200: '19200 bps', 38400: '38400 bps', 115200: '115200 bps' },
    ...once,
  }),
  point('parity', 'enum', SETTINGS, code(SETTINGS, 0x100d, PARITIES), {
    name: 'Parity',
    description: 'Serial parity',
    enumValues: { none: 'No parity', odd: 'Odd parity', even: 'Even parity' },
    ...once,
  }),
  point('stop_bits', 'integer', SETTINGS, uint16(SETTINGS, 0x100e), {
    name: 'Stop Bits',
    description: 'Serial stop bits, 1 or 2',
    ...once,
  }),
  point('combined_code', 'enum', SETTINGS, code(SETTINGS, 0x100f, COMBINED_CODES), {
    name: 'Combined Code',
    description: 'How the total active energy is made from forward and reverse energy',
    enumValues: {
      forward: 'Total = forward',
      reverse: 'Total = reverse',
      'forward+reverse': 'Total = forward + reverse',
      'forward-reverse': 'Total = forward - reverse',
    },
    ...once,
  }),
  point('demand_mode', 'enum', SETTINGS, code(SETTINGS, 0x1010, DEMAND_MODES), {
    name: 'Demand Mode',
    description: 'How the demand is calculated',
    enumValues: { interval: 'Interval', slip: 'Slip' },
    ...once,
  }),
  point('demand_cycle', 'integer', SETTINGS, uint16(SETTINGS, 0x1011), {
    name: 'Demand Cycle',
    description: 'Demand period (1-30)',
    unit: 'min',
    ...once,
  }),
  point('display_mode', 'string', SETTINGS, hex(SETTINGS, 0x1012, 4), {
    name: 'Display Content',
    description: 'Bits of the screens shown in turn, as 16 hex digits; 0 = not shown',
    ...once,
  }),
  point(
    'password',
    'string',
    SETTINGS,
    (b) => String(uint16(SETTINGS, 0x1016)(b)).padStart(4, '0'),
    {
      name: 'Display Password',
      description: 'Password of the buttons on the meter, 4 digits',
      ...once,
    }
  ),
  point('running_time', 'integer', RUNNING, int32(RUNNING, 0x1018), {
    name: 'Running Time',
    description:
      'Meter running time: counts while the current is above the timing current. ' +
      'The register list gives no unit. Only the multi-tariff version has it',
  }),
  point('startup_current', 'float', RUNNING, int32(RUNNING, 0x101a, 1000), {
    name: 'Timing Current',
    description: 'The running time counts while the current is above this value',
    unit: 'A',
    decimals: 3,
    ...once,
  }),
]
