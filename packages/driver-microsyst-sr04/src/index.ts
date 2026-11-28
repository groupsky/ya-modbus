/**
 * Microsyst SR04 Solar Heating Systems Controller Driver
 *
 * Registers come from the maker's manual (revision 2020-10-30, pages 15-16). The device answers
 * function codes 01 (read coils), 03 (read holding registers), 05 and 06 only.
 *
 * Only the clock can be written. The clock takes four single-register writes (06).
 */

import type {
  CreateDriverFunction,
  DataPoint,
  DefaultSerialConfig,
  DeviceDriver,
  DriverConfig,
  SupportedSerialConfig,
} from '@ya-modbus/driver-types'

import { CLOCK_ADDRESS, encodeClock, parseClock } from './clock.js'
import { REGISTERS, type Block, type Register } from './data-points.js'

/**
 * Supported serial settings
 *
 * From the manual: 9600 or 19200 baud, no or even parity, 1 or 2 stop bits, address 1-247.
 */
export const SUPPORTED_CONFIG = {
  validBaudRates: [9600, 19200],
  validParity: ['none', 'even'],
  validDataBits: [8],
  validStopBits: [1, 2],
  validAddressRange: [1, 247],
} as const satisfies SupportedSerialConfig

/**
 * Factory default serial settings
 *
 * The manual's default for the RS485 setting is 0: 9600 baud, no parity, 1 stop bit, address 1.
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
 * Create the SR04 driver
 */
export const createDriver: CreateDriverFunction = (config: DriverConfig) => {
  const { transport } = config

  const readBlock = (block: Block): Promise<Buffer> =>
    block.table === 'coils'
      ? transport.readCoils(block.address, block.count)
      : transport.readHoldingRegisters(block.address, block.count)

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
        buffers.set(block, await readBlock(block))
      }
    }

    const result: Record<string, unknown> = {}
    for (const { block, point, decode } of wanted) {
      result[point.id] = decode(buffers.get(block) as Buffer)
    }
    return result
  }

  /**
   * Set the clock. Seconds and minutes go first, so a carry while the four writes run can only
   * come from the new time: send a time with seconds away from 59.
   */
  async function writeClock(value: unknown): Promise<void> {
    // Checks the value before any request
    const clock = parseClock(value)
    // The low byte of 1027 is not documented, so it is written back as it is
    const yearRegister = (await transport.readHoldingRegisters(CLOCK_ADDRESS + 3, 1)).readUInt16BE(
      0
    )
    const registers = encodeClock(clock, yearRegister)
    for (const [i, register] of registers.entries()) {
      await transport.writeSingleRegister(CLOCK_ADDRESS + i, register)
    }
  }

  const driver: DeviceDriver = {
    name: 'SR04',
    manufacturer: 'Microsyst',
    model: 'SR04',
    dataPoints: DATA_POINTS,

    async readDataPoint(id: string): Promise<unknown> {
      if (!REGISTER_BY_ID.has(id)) {
        throw new Error(`Unknown data point: ${id}`)
      }
      return (await read([id]))[id]
    },

    readDataPoints: read,

    async writeDataPoint(id: string, value: unknown): Promise<void> {
      const register = REGISTER_BY_ID.get(id)
      if (!register) {
        throw new Error(`Unknown data point: ${id}`)
      }
      if (register.point.access !== 'rw') {
        throw new Error(`Data point ${id} is read-only`)
      }
      await writeClock(value)
    },
  }

  return Promise.resolve(driver)
}
