/**
 * Huawei SUN2000 Solar Inverter Driver
 *
 * Grid-tied solar inverter, Modbus TCP.
 *
 * Register mapping (holding registers, FC 03, big-endian, high word first):
 * - 32080-32088: active power, reactive power, power factor, grid frequency,
 *   efficiency, internal temperature, insulation resistance
 * - 32106-32107: accumulated energy yield
 * - 32114-32115: daily energy yield
 *
 * The inverter accepts only one Modbus TCP connection at a time.
 */

import { readScaledInt16BE, readScaledUInt16BE, readScaledUInt32BE } from '@ya-modbus/driver-sdk'
import type {
  CreateDriverFunction,
  DataPoint,
  DefaultTCPConfig,
  DeviceDriver,
  DriverConfig,
  SupportedTCPConfig,
} from '@ya-modbus/driver-types'

/**
 * Supported configuration values for SUN2000
 *
 * The unit ID depends on how the inverter is connected, so 0 is allowed too.
 */
export const SUPPORTED_CONFIG = {
  validAddressRange: [0, 247],
} as const satisfies SupportedTCPConfig

/**
 * Default SUN2000 connection settings
 */
export const DEFAULT_CONFIG = {
  defaultAddress: 1,
  defaultPort: 502,
} as const satisfies DefaultTCPConfig

/** One request reads one block of holding registers. */
interface Block {
  address: number
  count: number
}

/** The seven values from active power to insulation resistance are neighbours */
const POWER: Block = { address: 32080, count: 9 }
/**
 * The two energy counters are read one by one: the registers between them
 * (32108-32113) are not in the register list, so they are not read.
 */
const TOTAL_ENERGY: Block = { address: 32106, count: 2 }
const DAILY_ENERGY: Block = { address: 32114, count: 2 }

interface Register {
  block: Block
  /** Decode the value from the block buffer; `offset` is the byte offset of the register */
  decode: (buffer: Buffer, offset: number) => number
  /** Holding register address */
  register: number
  point: DataPoint
}

function floatPoint(
  id: string,
  name: string,
  unit: DataPoint['unit'],
  decimals: number,
  description: string
): DataPoint {
  return { id, name, type: 'float', ...(unit && { unit }), access: 'r', description, decimals }
}

/** Signed 32-bit integer divided by `scale` (the two powers) */
const readScaledInt32BE =
  (scale: number) =>
  (buffer: Buffer, offset: number): number =>
    buffer.readInt32BE(offset) / scale

const REGISTERS: ReadonlyArray<Register> = [
  {
    block: POWER,
    register: 32080,
    decode: readScaledInt32BE(1000),
    point: floatPoint('active_power', 'Active Power', 'kW', 3, 'Active power'),
  },
  {
    block: POWER,
    register: 32082,
    decode: readScaledInt32BE(1000),
    point: floatPoint('reactive_power', 'Reactive Power', 'kVAr', 3, 'Reactive power'),
  },
  {
    block: POWER,
    register: 32084,
    decode: (b, o) => readScaledInt16BE(b, o, 1000),
    point: floatPoint('power_factor', 'Power Factor', undefined, 3, 'Power factor'),
  },
  {
    block: POWER,
    register: 32085,
    decode: (b, o) => readScaledUInt16BE(b, o, 100),
    point: floatPoint('grid_frequency', 'Grid Frequency', 'Hz', 2, 'Grid frequency'),
  },
  {
    block: POWER,
    register: 32086,
    decode: (b, o) => readScaledUInt16BE(b, o, 100),
    point: floatPoint('efficiency', 'Efficiency', '%', 2, 'Inverter efficiency'),
  },
  {
    block: POWER,
    register: 32087,
    decode: (b, o) => readScaledInt16BE(b, o, 10),
    point: floatPoint(
      'internal_temperature',
      'Internal Temperature',
      '°C',
      1,
      'Internal temperature of the inverter'
    ),
  },
  {
    block: POWER,
    register: 32088,
    decode: (b, o) => readScaledUInt16BE(b, o, 1000),
    // The unit is MΩ, which is not in the list of standard units
    point: floatPoint(
      'insulation_resistance',
      'Insulation Resistance',
      undefined,
      3,
      'Insulation resistance in MΩ (megaohm)'
    ),
  },
  {
    block: TOTAL_ENERGY,
    register: 32106,
    decode: (b, o) => readScaledUInt32BE(b, o, 100),
    point: floatPoint(
      'total_energy_yield',
      'Total Energy Yield',
      'kWh',
      2,
      'Accumulated energy yield'
    ),
  },
  {
    block: DAILY_ENERGY,
    register: 32114,
    decode: (b, o) => readScaledUInt32BE(b, o, 100),
    point: floatPoint('daily_energy_yield', 'Daily Energy Yield', 'kWh', 2, 'Daily energy yield'),
  },
]

const DATA_POINTS: ReadonlyArray<DataPoint> = REGISTERS.map((r) => r.point)

const REGISTER_BY_ID = new Map(REGISTERS.map((r) => [r.point.id, r]))

/**
 * Create SUN2000 device driver
 */
export const createDriver: CreateDriverFunction = (config: DriverConfig) => {
  const { transport } = config

  /** Read each needed block once and decode the requested ids */
  async function read(ids: string[]): Promise<Record<string, unknown>> {
    const unknown = ids.filter((id) => !REGISTER_BY_ID.has(id))
    if (unknown.length > 0) {
      throw new Error(`Unknown data points: ${unknown.join(', ')}`)
    }

    const wanted = ids.map((id) => REGISTER_BY_ID.get(id) as Register)
    const blocks = new Set(wanted.map((r) => r.block))
    const buffers = new Map<Block, Buffer>()
    for (const block of blocks) {
      buffers.set(block, await transport.readHoldingRegisters(block.address, block.count))
    }

    const result: Record<string, unknown> = {}
    for (const { block, register, decode, point } of wanted) {
      result[point.id] = decode(buffers.get(block) as Buffer, (register - block.address) * 2)
    }
    return result
  }

  const driver: DeviceDriver = {
    name: 'SUN2000',
    manufacturer: 'Huawei',
    model: 'SUN2000',
    dataPoints: DATA_POINTS,

    async readDataPoint(id: string): Promise<unknown> {
      if (!REGISTER_BY_ID.has(id)) {
        throw new Error(`Unknown data point: ${id}`)
      }
      return (await read([id]))[id]
    },

    writeDataPoint(id: string): Promise<void> {
      return Promise.reject(new Error(`Data point ${id} is read-only`))
    },

    readDataPoints: read,
  }

  return Promise.resolve(driver)
}
