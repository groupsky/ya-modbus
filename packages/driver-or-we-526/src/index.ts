/**
 * ORNO OR-WE-526 Single-Phase Energy Meter Driver
 *
 * Single-phase energy meter with tariffs T1-T4 and a clock, DIN rail (1 module), RS-485,
 * Modbus RTU. All values are holding registers (function code 03).
 *
 * The driver only reads. It writes nothing to the meter.
 */

import type {
  CreateDriverFunction,
  DataPoint,
  DefaultSerialConfig,
  DeviceDriver,
  DriverConfig,
  SupportedSerialConfig,
} from '@ya-modbus/driver-types'

import { REGISTERS, type Block, type Register } from './data-points.js'

/**
 * Supported serial settings
 *
 * From the register list (0x100C-0x100E) and the manual: 9600-115200 baud, any parity,
 * 1 or 2 stop bits, address 1-247.
 */
export const SUPPORTED_CONFIG = {
  validBaudRates: [9600, 19200, 38400, 115200],
  validParity: ['none', 'even', 'odd'],
  validDataBits: [8],
  validStopBits: [1, 2],
  validAddressRange: [1, 247],
} as const satisfies SupportedSerialConfig

/**
 * Factory default serial settings
 *
 * From the manual: address 1, 9600 baud, no parity, 1 stop bit.
 */
export const DEFAULT_CONFIG = {
  baudRate: 9600,
  parity: 'none',
  dataBits: 8,
  stopBits: 1,
  defaultAddress: 1,
} as const satisfies DefaultSerialConfig

const DATA_POINTS: ReadonlyArray<DataPoint> = REGISTERS.map((r) => r.point)

const REGISTER_BY_ID = new Map(REGISTERS.map((r) => [r.point.id, r]))

/**
 * Create the OR-WE-526 driver
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
    const buffers = new Map<Block, Buffer>()
    for (const { block } of wanted) {
      if (!buffers.has(block)) {
        buffers.set(block, await transport.readHoldingRegisters(block.address, block.count))
      }
    }

    const result: Record<string, unknown> = {}
    for (const { block, point, decode } of wanted) {
      result[point.id] = decode(buffers.get(block) as Buffer)
    }
    return result
  }

  const driver: DeviceDriver = {
    name: 'OR-WE-526',
    manufacturer: 'ORNO',
    model: 'OR-WE-526',
    dataPoints: DATA_POINTS,

    async readDataPoint(id: string): Promise<unknown> {
      if (!REGISTER_BY_ID.has(id)) {
        throw new Error(`Unknown data point: ${id}`)
      }
      return (await read([id]))[id]
    },

    readDataPoints: read,

    writeDataPoint(id: string): Promise<void> {
      if (!REGISTER_BY_ID.has(id)) {
        return Promise.reject(new Error(`Unknown data point: ${id}`))
      }
      return Promise.reject(new Error(`Data point ${id} is read-only`))
    },
  }

  return Promise.resolve(driver)
}
