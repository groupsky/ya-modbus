/**
 * MBSL32DI Digital Input Module Driver
 *
 * 32 digital inputs, RS-485, Modbus RTU. Sold under the brand "Dio Smart".
 *
 * There is no manual for this module. The registers come from the old homy reader, the only
 * code known to work on a real module: one read of holding registers 0x0000-0x0001 with
 * function code 03. Register 0x0000 holds inputs 1-16, register 0x0001 inputs 17-32.
 * The driver only reads; it writes nothing.
 */

import type {
  CreateDriverFunction,
  DataPoint,
  DefaultSerialConfig,
  DeviceDriver,
  DriverConfig,
  SupportedSerialConfig,
} from '@ya-modbus/driver-types'

/** Number of digital inputs */
export const INPUT_COUNT = 32

/** First register of the inputs and number of registers, read with function code 03 */
const INPUTS_ADDRESS = 0x0000
const INPUTS_COUNT = 2

/**
 * Supported serial settings
 *
 * Without a manual, only the settings of the real bus are known: 115200 baud, even parity,
 * 8 data bits, 1 stop bit. Modbus allows addresses 1-247.
 */
export const SUPPORTED_CONFIG = {
  validBaudRates: [115200],
  validParity: ['even'],
  validDataBits: [8],
  validStopBits: [1],
  validAddressRange: [1, 247],
} as const satisfies SupportedSerialConfig

/**
 * Default serial settings
 *
 * The settings of the real bus. The factory address is not known; 1 is a placeholder.
 */
export const DEFAULT_CONFIG = {
  baudRate: 115200,
  parity: 'even',
  dataBits: 8,
  stopBits: 1,
  defaultAddress: 1,
} as const satisfies DefaultSerialConfig

const INPUT_IDS = Array.from({ length: INPUT_COUNT }, (_, i) => `input_${i + 1}`)

const DATA_POINTS: ReadonlyArray<DataPoint> = [
  {
    id: 'inputs',
    type: 'integer',
    access: 'r',
    name: 'Inputs',
    description:
      'States of all 32 inputs as one unsigned 32-bit number, bit 0 = input 1 (register 0x0000 is the low word)',
  },
  ...INPUT_IDS.map((id, bit): DataPoint => ({
    id,
    type: 'boolean',
    access: 'r',
    name: `Input ${bit + 1}`,
    description: `Digital input ${bit + 1}: true = on`,
  })),
]

const KNOWN_IDS = new Set(DATA_POINTS.map((dp) => dp.id))

/** All 32 inputs as an unsigned number: register 0x0000 is the low word */
const decodeInputs = (buffer: Buffer): number =>
  buffer.readUInt16BE(0) + buffer.readUInt16BE(2) * 0x10000

/** Bit of each `input_n` in the inputs value */
const BIT_BY_ID = new Map(INPUT_IDS.map((id, bit) => [id, bit]))

/** Value of one data point from the unsigned 32-bit inputs value */
const valueOf = (id: string, inputs: number): number | boolean => {
  const bit = BIT_BY_ID.get(id)
  return bit === undefined ? inputs : ((inputs >>> bit) & 1) === 1
}

/**
 * Create the MBSL32DI driver
 */
export const createDriver: CreateDriverFunction = (config: DriverConfig) => {
  const { transport } = config

  /** Read both registers once and decode the requested ids */
  async function read(ids: string[]): Promise<Record<string, unknown>> {
    const unknown = ids.filter((id) => !KNOWN_IDS.has(id))
    if (unknown.length > 0) {
      throw new Error(`Unknown data points: ${unknown.join(', ')}`)
    }

    const inputs = decodeInputs(await transport.readHoldingRegisters(INPUTS_ADDRESS, INPUTS_COUNT))

    return Object.fromEntries(ids.map((id) => [id, valueOf(id, inputs)]))
  }

  const driver: DeviceDriver = {
    name: 'MBSL32DI',
    manufacturer: 'Dio Smart',
    model: 'MBSL32DI',
    dataPoints: DATA_POINTS,

    async readDataPoint(id: string): Promise<unknown> {
      if (!KNOWN_IDS.has(id)) {
        throw new Error(`Unknown data point: ${id}`)
      }
      return (await read([id]))[id]
    },

    readDataPoints: read,

    writeDataPoint(id: string): Promise<void> {
      return Promise.reject(
        new Error(KNOWN_IDS.has(id) ? `Data point ${id} is read-only` : `Unknown data point: ${id}`)
      )
    },
  }

  return Promise.resolve(driver)
}
