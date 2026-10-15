/**
 * Sinotimer DDS519MR Single-Phase Energy Meter Driver
 *
 * Single-phase energy meter, DIN rail, RS-485.
 *
 * Factory default specifications are exported via the DEFAULT_CONFIG constant.
 * See DEFAULT_CONFIG for baud rate, parity, data bits, stop bits, and default address.
 *
 * Register mapping (input registers, FC 04, float32 big-endian, 2 registers each):
 * - 0x00: voltage, 0x08: current, 0x12: active power
 * - 0x2A: power factor, 0x36: frequency
 * - 0x100: total active energy
 *
 * Power is in W. The manual says kW; the real meters return W.
 */

import { readFloatBE } from '@ya-modbus/driver-sdk'
import type {
  CreateDriverFunction,
  DataPoint,
  DefaultSerialConfig,
  DeviceDriver,
  DriverConfig,
  SupportedSerialConfig,
} from '@ya-modbus/driver-types'

/**
 * Supported configuration values for DDS519MR
 *
 * Baud rates, parity and the address range come from the manual of the sibling
 * model DDS661. Only 9600 baud, even parity, 8 data bits and 1 stop bit are seen
 * on real meters.
 */
export const SUPPORTED_CONFIG = {
  validBaudRates: [1200, 2400, 4800, 9600],
  validParity: ['even', 'odd', 'none'],
  validDataBits: [8],
  validStopBits: [1],
  validAddressRange: [1, 247],
} as const satisfies SupportedSerialConfig

/**
 * Default DDS519MR device configuration
 *
 * Use these values when connecting to a factory-default DDS519MR device.
 */
export const DEFAULT_CONFIG = {
  baudRate: 9600,
  parity: 'even',
  dataBits: 8,
  stopBits: 1,
  defaultAddress: 1,
} as const satisfies DefaultSerialConfig

/** One request reads one block of input registers. */
interface Block {
  address: number
  count: number
}

const ELECTRICAL: Block = { address: 0x00, count: 20 }
const POWER_FACTOR_FREQUENCY: Block = { address: 0x2a, count: 14 }
const ACTIVE_ENERGY: Block = { address: 0x100, count: 2 }

interface Register {
  block: Block
  /** Input register address */
  register: number
  point: DataPoint
}

function floatPoint(
  block: Block,
  register: number,
  id: string,
  name: string,
  description: string,
  unit: DataPoint['unit'],
  decimals: number
): Register {
  return {
    block,
    register,
    point: {
      id,
      name,
      type: 'float',
      ...(unit && { unit }),
      access: 'r',
      description,
      decimals,
    },
  }
}

const REGISTERS: ReadonlyArray<Register> = [
  floatPoint(ELECTRICAL, 0x00, 'voltage', 'Voltage', 'Line voltage in volts', 'V', 1),
  floatPoint(ELECTRICAL, 0x08, 'current', 'Current', 'Line current in amperes', 'A', 3),
  floatPoint(
    ELECTRICAL,
    0x12,
    'active_power',
    'Active Power',
    'Active power in watts (the manual says kW, the meter returns W)',
    'W',
    1
  ),
  floatPoint(
    POWER_FACTOR_FREQUENCY,
    0x2a,
    'power_factor',
    'Power Factor',
    'Power factor (1 at very low current)',
    undefined,
    3
  ),
  floatPoint(
    POWER_FACTOR_FREQUENCY,
    0x36,
    'frequency',
    'Grid Frequency',
    'Grid frequency in hertz. Warning: this meter reports a fixed 50 Hz, it seems not to measure the frequency',
    'Hz',
    2
  ),
  floatPoint(
    ACTIVE_ENERGY,
    0x100,
    'total_active_energy',
    'Total Active Energy',
    'Total active energy in kilowatt-hours',
    'kWh',
    2
  ),
]

const DATA_POINTS: ReadonlyArray<DataPoint> = REGISTERS.map((r) => r.point)

const REGISTER_BY_ID = new Map(REGISTERS.map((r) => [r.point.id, r]))

/**
 * Create DDS519MR device driver
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
      buffers.set(block, await transport.readInputRegisters(block.address, block.count))
    }

    const result: Record<string, unknown> = {}
    for (const { block, register, point } of wanted) {
      result[point.id] = readFloatBE(buffers.get(block) as Buffer, (register - block.address) * 2)
    }
    return result
  }

  const driver: DeviceDriver = {
    name: 'DDS519MR',
    manufacturer: 'Sinotimer',
    model: 'DDS519MR',
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
