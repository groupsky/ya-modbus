/**
 * Aspar MOD-16RO Relay Module Driver
 *
 * 16 relay outputs, DIN rail, RS-485, Modbus RTU or ASCII. The address is set with DIP
 * switches.
 *
 * Reads: registers 0x00-0x01 with function code 03, all other registers with function
 * code 04 (the manual swaps the usual names of the two).
 * Writes: only the 16 outputs, each with function code 05 on its own coil.
 */

import type {
  CreateDriverFunction,
  DataPoint,
  DefaultSerialConfig,
  DeviceDriver,
  DriverConfig,
  SupportedSerialConfig,
  Transport,
} from '@ya-modbus/driver-types'

import { REGISTERS, type Block, type Register } from './data-points.js'

/**
 * Supported serial settings
 *
 * From the manual: 2400-115200 baud, none, odd or even parity (and two fixed parity bits
 * that serial ports rarely support), 7 or 8 data bits, 1 or 2 stop bits. DIP switches set
 * address 0-31; Modbus allows 1-247, which can be set over the bus.
 */
export const SUPPORTED_CONFIG = {
  validBaudRates: [2400, 4800, 9600, 19200, 38400, 57600, 115200],
  validParity: ['none', 'odd', 'even'],
  validDataBits: [7, 8],
  validStopBits: [1, 2],
  validAddressRange: [1, 247],
} as const satisfies SupportedSerialConfig

/**
 * Factory default serial settings
 *
 * From the manual: 19200 baud, no parity, RTU. The manual says "Data bits 1", which is
 * read as 8 data bits and 1 stop bit. The address has no factory default: it comes from the
 * DIP switches; 1 is a placeholder.
 */
export const DEFAULT_CONFIG = {
  baudRate: 19200,
  parity: 'none',
  dataBits: 8,
  stopBits: 1,
  defaultAddress: 1,
} as const satisfies DefaultSerialConfig

const DATA_POINTS: ReadonlyArray<DataPoint> = REGISTERS.map((r) => r.point)

const REGISTER_BY_ID = new Map(REGISTERS.map((r) => [r.point.id, r]))

const readBlock = (transport: Transport, block: Block): Promise<Buffer> =>
  block.functionCode === 3
    ? transport.readHoldingRegisters(block.address, block.count)
    : transport.readInputRegisters(block.address, block.count)

/**
 * Create the MOD-16RO driver
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
        buffers.set(block, await readBlock(transport, block))
      }
    }

    const result: Record<string, unknown> = {}
    for (const { block, point, decode } of wanted) {
      result[point.id] = decode(buffers.get(block) as Buffer)
    }
    return result
  }

  const driver: DeviceDriver = {
    name: 'MOD-16RO',
    manufacturer: 'Aspar',
    model: 'MOD-16RO',
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
      if (register.coil === undefined) {
        throw new Error(`Data point ${id} is read-only`)
      }
      if (typeof value !== 'boolean') {
        throw new Error(
          `Invalid value for ${id}: expected true or false, got ${JSON.stringify(value)}`
        )
      }
      await transport.writeSingleCoil(register.coil, value)
    },
  }

  return Promise.resolve(driver)
}
