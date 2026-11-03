/**
 * BAC-002 room thermostat driver
 *
 * The register list comes from an older reader of this device and from the Wiren Board page
 * for the BAC-002ALN. There is no vendor register document.
 *
 * One read of holding registers 0-10 (function 3) returns everything:
 *
 * | Register | Data point          | Raw value                                  | Access |
 * | -------- | ------------------- | ------------------------------------------ | ------ |
 * | 0        | `power`             | 0 off, 1 on                                | rw     |
 * | 1        | `fan_setting`       | 0 auto, 1 high, 2 mid, 3 low               | rw     |
 * | 2        | `mode`              | 0 cooling, 1 heating, 2 ventilation        | rw     |
 * | 3        | `target_temperature`| tenths of a degree                         | rw     |
 * | 4        | `lock`              | 0 unlock, 1 lock                           | rw     |
 * | 5        | `clock_minutes`     | 0-59                                       | rw     |
 * | 6        | `clock_hours`       | 0-23                                       | rw     |
 * | 7        | `week_day`          | 1 mon ... 7 sun (0 when not set)           | rw     |
 * | 8        | `current_temperature` | tenths of a degree                       | r      |
 * | 9        | `valve`, `valve_status` | number; 0 off, 1 on                    | r      |
 * | 10       | `fan`, `fan_status` | number; 0 off, 1 high, 2 mid, 3 low        | r      |
 */

import type {
  CreateDriverFunction,
  DataPoint,
  DefaultSerialConfig,
  DeviceDriver,
} from '@ya-modbus/driver-types'

/**
 * Factory default serial settings of the BAC-002
 */
export const DEFAULT_CONFIG = {
  baudRate: 9600,
  parity: 'none',
  dataBits: 8,
  stopBits: 1,
  defaultAddress: 1,
} as const satisfies DefaultSerialConfig

/** Number of registers in the one read that returns every data point */
const REGISTER_COUNT = 11

/**
 * One data point and the way to turn its register value into a driver value
 */
interface Field {
  readonly dataPoint: DataPoint
  readonly register: number
  readonly decode: (raw: number) => unknown
}

/**
 * Fields that hold a text value out of a fixed list, such as `heating`.
 * `names` maps each text value to the register value.
 */
function enumField(
  register: number,
  dataPoint: Omit<DataPoint, 'type' | 'enumValues'>,
  names: Readonly<Record<string, number>>,
  labels: Readonly<Record<string, string>>,
  unsetName?: string
): Field {
  return {
    register,
    dataPoint: { ...dataPoint, type: 'enum', enumValues: labels },
    decode: (raw) => {
      if (raw === 0 && unsetName !== undefined) return unsetName
      const found = Object.entries(names).find(([, value]) => value === raw)
      if (found === undefined) {
        throw new Error(`Unknown ${dataPoint.name} value from device: ${raw}`)
      }
      return found[0]
    },
  }
}

function integerField(register: number, dataPoint: Omit<DataPoint, 'type'>): Field {
  return { register, dataPoint: { ...dataPoint, type: 'integer' }, decode: (raw) => raw }
}

function temperatureField(register: number, dataPoint: Omit<DataPoint, 'type'>): Field {
  return {
    register,
    dataPoint: { ...dataPoint, type: 'float', unit: '°C', decimals: 1 },
    decode: (raw) => raw / 10,
  }
}

const POWER = { off: 0, on: 1 }
const FAN_SETTING = { auto: 0, high: 1, mid: 2, low: 3 }
const MODE = { cooling: 0, heating: 1, ventilation: 2 }
const LOCK = { unlock: 0, lock: 1 }
const WEEK_DAY = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 }
const VALVE_STATUS = { off: 0, on: 1 }
const FAN_STATUS = { off: 0, high: 1, mid: 2, low: 3 }

const FIELDS: ReadonlyArray<Field> = [
  enumField(
    0,
    { id: 'power', name: 'Power', access: 'rw', description: 'Thermostat power: off or on' },
    POWER,
    { off: 'Off', on: 'On' }
  ),
  enumField(
    1,
    {
      id: 'fan_setting',
      name: 'Fan Setting',
      access: 'rw',
      description: 'Wanted fan speed: auto, high, mid or low',
    },
    FAN_SETTING,
    { auto: 'Auto', high: 'High', mid: 'Medium', low: 'Low' }
  ),
  enumField(
    2,
    {
      id: 'mode',
      name: 'Mode',
      access: 'rw',
      description: 'Operating mode: cooling, heating or ventilation',
    },
    MODE,
    { cooling: 'Cooling', heating: 'Heating', ventilation: 'Ventilation' }
  ),
  temperatureField(3, {
    id: 'target_temperature',
    name: 'Target Temperature',
    access: 'rw',
    description: 'Wanted room temperature in degrees Celsius',
    min: 0,
    max: 100,
  }),
  enumField(
    4,
    {
      id: 'lock',
      name: 'Lock',
      access: 'rw',
      description: 'Keypad lock: lock or unlock',
    },
    LOCK,
    { unlock: 'Unlocked', lock: 'Locked' }
  ),
  integerField(5, {
    id: 'clock_minutes',
    name: 'Clock Minutes',
    unit: 'min',
    access: 'rw',
    description: 'Minutes of the thermostat clock (0-59)',
    min: 0,
    max: 59,
  }),
  integerField(6, {
    id: 'clock_hours',
    name: 'Clock Hours',
    unit: 'h',
    access: 'rw',
    description: 'Hours of the thermostat clock (0-23)',
    min: 0,
    max: 23,
  }),
  enumField(
    7,
    {
      id: 'week_day',
      name: 'Week Day',
      access: 'rw',
      description:
        'Day of the week of the thermostat clock (mon to sun). Reads as unknown when the device has no day set',
    },
    WEEK_DAY,
    {
      mon: 'Monday',
      tue: 'Tuesday',
      wed: 'Wednesday',
      thu: 'Thursday',
      fri: 'Friday',
      sat: 'Saturday',
      sun: 'Sunday',
    },
    'unknown'
  ),
  temperatureField(8, {
    id: 'current_temperature',
    name: 'Current Temperature',
    access: 'r',
    description: 'Measured room temperature in degrees Celsius',
  }),
  integerField(9, {
    id: 'valve',
    name: 'Valve',
    access: 'r',
    description: 'Raw valve value from the device',
  }),
  enumField(
    9,
    { id: 'valve_status', name: 'Valve', access: 'r', description: 'Valve state: off or on' },
    VALVE_STATUS,
    { off: 'Off', on: 'On' }
  ),
  integerField(10, {
    id: 'fan',
    name: 'Fan',
    access: 'r',
    description: 'Raw fan value from the device',
  }),
  enumField(
    10,
    {
      id: 'fan_status',
      name: 'Fan',
      access: 'r',
      description: 'Fan state now: off, high, mid or low',
    },
    FAN_STATUS,
    { off: 'Off', high: 'High', mid: 'Medium', low: 'Low' }
  ),
]

const DATA_POINTS: ReadonlyArray<DataPoint> = FIELDS.map((field) => field.dataPoint)
const FIELD_BY_ID = new Map(FIELDS.map((field) => [field.dataPoint.id, field]))

function findField(id: string): Field {
  const field = FIELD_BY_ID.get(id)
  if (field === undefined) {
    throw new Error(`Unknown data point: ${id}`)
  }
  return field
}

/**
 * Create BAC-002 device driver
 */
export const createDriver: CreateDriverFunction = ({ transport }) => {
  const readFields = async (fields: ReadonlyArray<Field>): Promise<Record<string, unknown>> => {
    const buffer = await transport.readHoldingRegisters(0, REGISTER_COUNT)
    if (buffer.length < REGISTER_COUNT * 2) {
      throw new Error(
        `Buffer too short: expected at least ${REGISTER_COUNT * 2} bytes, got ${buffer.length}`
      )
    }
    const result: Record<string, unknown> = {}
    for (const field of fields) {
      result[field.dataPoint.id] = field.decode(buffer.readUInt16BE(field.register * 2))
    }
    return result
  }

  const driver: DeviceDriver = {
    name: 'BAC-002',
    manufacturer: 'Unknown',
    model: 'BAC-002',
    dataPoints: DATA_POINTS,

    async readDataPoint(id: string): Promise<unknown> {
      const field = findField(id)
      const values = await readFields([field])
      return values[id]
    },

    async readDataPoints(ids: string[]): Promise<Record<string, unknown>> {
      return readFields(ids.map(findField))
    },

    // eslint-disable-next-line @typescript-eslint/require-await
    async writeDataPoint(id: string): Promise<void> {
      findField(id)
      throw new Error(`Data point ${id} is read-only`)
    },
  }

  return Promise.resolve(driver)
}
