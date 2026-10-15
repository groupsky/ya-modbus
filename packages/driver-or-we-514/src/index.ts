/**
 * ORNO OR-WE-514 Single-Phase Energy Meter Driver
 *
 * Single-phase energy meter, DIN rail (1 module), RS-485, Modbus RTU.
 *
 * Factory default specifications are exported via the DEFAULT_CONFIG constant.
 * See DEFAULT_CONFIG for baud rate, parity, data bits, stop bits, and default address.
 *
 * Register mapping (holding registers, FC 03, big-endian, high word first):
 * - 0x130-0x131: frequency, voltage
 * - 0x139, 0x140, 0x148, 0x150, 0x158: current, powers, power factor
 * - 0xA000, 0xA01E: total active and reactive energy
 *
 * Power is in W, VAr and VA: the register list says 0.001 kW per count, which is 1 W.
 */

import { readScaledInt16BE, readScaledUInt16BE, readScaledUInt32BE } from '@ya-modbus/driver-sdk'
import type {
  CreateDriverFunction,
  DataPoint,
  DefaultSerialConfig,
  DeviceDriver,
  DriverConfig,
  SupportedSerialConfig,
} from '@ya-modbus/driver-types'

/**
 * Supported configuration values for OR-WE-514
 *
 * Baud rates and address range come from the register list (settings table).
 * Even parity, 8 data bits and 1 stop bit come from the manual (section 8.1);
 * other parity settings are not checked on the meter.
 */
export const SUPPORTED_CONFIG = {
  validBaudRates: [1200, 2400, 4800, 9600],
  validParity: ['even'],
  validDataBits: [8],
  validStopBits: [1],
  validAddressRange: [1, 247],
} as const satisfies SupportedSerialConfig

/**
 * Default OR-WE-514 device configuration
 *
 * Use these values when connecting to a factory-default OR-WE-514 device.
 */
export const DEFAULT_CONFIG = {
  baudRate: 9600,
  parity: 'even',
  dataBits: 8,
  stopBits: 1,
  defaultAddress: 1,
} as const satisfies DefaultSerialConfig

/** One request reads one block of holding registers. */
interface Block {
  address: number
  count: number
}

/** Frequency and voltage are two neighbouring registers read together */
const FREQUENCY_VOLTAGE: Block = { address: 0x130, count: 2 }
const CURRENT: Block = { address: 0x139, count: 2 }
const ACTIVE_POWER: Block = { address: 0x140, count: 2 }
const REACTIVE_POWER: Block = { address: 0x148, count: 2 }
const APPARENT_POWER: Block = { address: 0x150, count: 2 }
const POWER_FACTOR: Block = { address: 0x158, count: 1 }
const ACTIVE_ENERGY: Block = { address: 0xa000, count: 2 }
const REACTIVE_ENERGY: Block = { address: 0xa01e, count: 2 }

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

function integerPoint(
  id: string,
  name: string,
  unit: NonNullable<DataPoint['unit']>,
  description: string
): DataPoint {
  return { id, name, type: 'integer', unit, access: 'r', description }
}

/** Signed 32-bit integer, 1 unit per count (the three powers) */
const readInt32BE = (buffer: Buffer, offset: number): number => buffer.readInt32BE(offset)

const REGISTERS: ReadonlyArray<Register> = [
  {
    block: FREQUENCY_VOLTAGE,
    register: 0x130,
    decode: (b, o) => readScaledUInt16BE(b, o, 100),
    point: floatPoint('frequency', 'Grid Frequency', 'Hz', 2, 'Grid frequency'),
  },
  {
    block: FREQUENCY_VOLTAGE,
    register: 0x131,
    decode: (b, o) => readScaledUInt16BE(b, o, 100),
    point: floatPoint('voltage', 'Voltage', 'V', 2, 'Line voltage'),
  },
  {
    block: CURRENT,
    register: 0x139,
    decode: (b, o) => readScaledUInt32BE(b, o, 1000),
    point: floatPoint('current', 'Current', 'A', 3, 'Line current'),
  },
  {
    block: ACTIVE_POWER,
    register: 0x140,
    decode: readInt32BE,
    point: integerPoint('active_power', 'Active Power', 'W', 'Active power'),
  },
  {
    block: REACTIVE_POWER,
    register: 0x148,
    decode: readInt32BE,
    point: integerPoint('reactive_power', 'Reactive Power', 'VAr', 'Reactive power'),
  },
  {
    block: APPARENT_POWER,
    register: 0x150,
    decode: readInt32BE,
    point: integerPoint('apparent_power', 'Apparent Power', 'VA', 'Apparent power'),
  },
  {
    block: POWER_FACTOR,
    register: 0x158,
    decode: (b, o) => readScaledInt16BE(b, o, 1000),
    point: floatPoint('power_factor', 'Power Factor', undefined, 3, 'Power factor'),
  },
  {
    block: ACTIVE_ENERGY,
    register: 0xa000,
    decode: (b, o) => readScaledUInt32BE(b, o, 100),
    point: floatPoint(
      'total_active_energy',
      'Total Active Energy',
      'kWh',
      2,
      'Total active energy'
    ),
  },
  {
    block: REACTIVE_ENERGY,
    register: 0xa01e,
    decode: (b, o) => readScaledUInt32BE(b, o, 100),
    point: floatPoint(
      'total_reactive_energy',
      'Total Reactive Energy',
      'kVArh',
      2,
      'Total reactive energy'
    ),
  },
]

const DATA_POINTS: ReadonlyArray<DataPoint> = REGISTERS.map((r) => r.point)

const REGISTER_BY_ID = new Map(REGISTERS.map((r) => [r.point.id, r]))

/**
 * Create OR-WE-514 device driver
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
    name: 'OR-WE-514',
    manufacturer: 'ORNO',
    model: 'OR-WE-514',
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
