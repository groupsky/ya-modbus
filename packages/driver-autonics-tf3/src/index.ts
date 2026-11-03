/**
 * Autonics TF3 temperature controller driver
 *
 * Temperatures are numbers in the controller's own unit (Celsius or Fahrenheit, see the
 * `temperature_unit` data point). The controller has a decimal-point register: the driver reads
 * it with every read or write of a temperature and does not assume a scale.
 *
 * Out of scope on purpose: factory reset (coil 0x0002) and the communication setup
 * (0x0130..0x0133 address, baud rate, parity, stop bits), because a wrong write there cuts the
 * device off the bus. The response delay (0x0134) is not used: it is how long the
 * device waits before it answers, so a pause before our request would not help. The transport timeout
 * covers the answer, and the bridge has `connection.interDeviceDelay` for spacing on the bus.
 */

import { readScaledInt16BE, readScaledUInt16BE } from '@ya-modbus/driver-sdk'
import type {
  CreateDriverFunction,
  DefaultSerialConfig,
  DeviceDriver,
  DriverConfig,
  SupportedSerialConfig,
  Transport,
} from '@ya-modbus/driver-types'

import {
  BLOCKS,
  DATA_POINTS,
  DIVISOR_WORD,
  SPEC_BY_ID,
  type BlockName,
  type PointSpec,
} from './data-points.js'

/** What the device supports (communication manual V1.1: address 1 to 99, holding 0x0130..0x0133) */
export const SUPPORTED_CONFIG = {
  validBaudRates: [2400, 4800, 9600, 19200, 38400],
  validParity: ['none', 'even', 'odd'],
  validDataBits: [8],
  validStopBits: [1, 2],
  validAddressRange: [1, 99],
} as const satisfies SupportedSerialConfig

/** Factory settings (communication manual V1.1): 9600 baud, 8 data bits, no parity, 2 stop bits */
export const DEFAULT_CONFIG = {
  baudRate: 9600,
  parity: 'none',
  dataBits: 8,
  stopBits: 2,
  defaultAddress: 1,
} as const satisfies DefaultSerialConfig

/** Scale of the temperatures from the decimal-point register */
function scaleFromRegister(raw: number): number {
  if (raw === 0) return 1
  if (raw === 1) return 10
  throw new Error(`Unknown decimal point setting ${raw} (expected 0 or 1)`)
}

function readBlock(transport: Transport, name: BlockName): Promise<Buffer> {
  const { table, address, count } = BLOCKS[name]
  if (table === 'coil') return transport.readCoils(address, count)
  return table === 'input'
    ? transport.readInputRegisters(address, count)
    : transport.readHoldingRegisters(address, count)
}

function decode(spec: PointSpec, buffer: Buffer, scale: number): unknown {
  const offset = spec.word * 2
  switch (spec.kind) {
    case 'temp':
      return readScaledInt16BE(buffer, offset, scale)
    case 'temp_unsigned':
      return readScaledUInt16BE(buffer, offset, scale)
    case 'tenths':
      return readScaledUInt16BE(buffer, offset, 10)
    case 'uint16':
    case 'enum':
      return buffer.readUInt16BE(offset)
    case 'flag':
      return buffer.readUInt16BE(offset) !== 0
    case 'coil':
      return ((buffer.readUInt8(0) >> spec.word) & 1) === 1
    case 'divisor':
      return scaleFromRegister(buffer.readUInt16BE(offset))
    case 'uint32':
      return buffer.readUInt32BE(offset)
    case 'text':
      return buffer
        .subarray(offset, offset + (spec.words ?? 1) * 2)
        .toString('latin1')
        .replace(/\0/g, ' ')
        .trim()
  }
}

const isTemperature = (spec: PointSpec): boolean =>
  spec.kind === 'temp' || spec.kind === 'temp_unsigned'

/** The 16 bit register value for a data point value, or an error when the value does not fit */
function encode(spec: PointSpec, value: unknown, scale: number): number {
  const { id, enumValues } = spec.point
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid value for ${id}: expected a number, got ${String(value)}`)
  }
  if (spec.kind === 'enum') {
    if (!enumValues || !(value in enumValues)) {
      throw new Error(
        `Invalid value for ${id}: ${value} (valid: ${Object.keys(enumValues ?? {}).join(', ')})`
      )
    }
    return value
  }
  const raw = isTemperature(spec) ? Math.round(value * scale) : value
  const [min, max] = spec.kind === 'temp' ? [-0x8000, 0x7fff] : [0, 0xffff]
  if (!Number.isInteger(raw) || raw < min || raw > max) {
    throw new Error(`Invalid value for ${id}: ${value} (register range ${min}..${max})`)
  }
  return raw & 0xffff
}

/**
 * Create the TF3 driver
 *
 * Every read goes through the register groups of `BLOCKS`. A group is read whole once per call,
 * and the decimal-point register is part of the status group, so a read of any temperature costs
 * at most one extra request. Nothing is cached, because the scale can be changed on the device.
 */
export const createDriver: CreateDriverFunction = (config: DriverConfig) => {
  const { transport } = config

  const readScale = async (): Promise<number> =>
    scaleFromRegister(
      (await transport.readInputRegisters(BLOCKS.status.address + DIVISOR_WORD, 1)).readUInt16BE(0)
    )

  const specFor = (id: string): PointSpec => {
    const spec = SPEC_BY_ID.get(id)
    if (!spec) throw new Error(`Unknown data point: ${id}`)
    return spec
  }

  const driver: DeviceDriver = {
    name: 'Autonics TF3',
    manufacturer: 'Autonics',
    model: 'TF3',
    dataPoints: DATA_POINTS,

    async readDataPoints(ids: string[]): Promise<Record<string, unknown>> {
      const specs = ids.map(specFor)
      const needed = new Set<BlockName>(specs.map((spec) => spec.block))
      // The status group carries the decimal-point register
      if (specs.some(isTemperature)) needed.add('status')

      const buffers = {} as Record<BlockName, Buffer>
      for (const name of needed) {
        buffers[name] = await readBlock(transport, name)
      }

      // Only a temperature needs the scale, so an unknown decimal value does not break other reads
      const scale = specs.some(isTemperature)
        ? scaleFromRegister(buffers.status.readUInt16BE(DIVISOR_WORD * 2))
        : 1
      return Object.fromEntries(
        specs.map((spec) => [spec.point.id, decode(spec, buffers[spec.block], scale)])
      )
    },

    async readDataPoint(id: string): Promise<unknown> {
      return (await driver.readDataPoints([id]))[id]
    },

    async writeDataPoint(id: string, value: unknown): Promise<void> {
      const spec = specFor(id)
      const address = spec.writeAddress
      if (address === undefined) throw new Error(`Data point ${id} is read-only`)

      if (spec.kind === 'coil') {
        if (typeof value !== 'boolean') {
          throw new Error(`Invalid value for ${id}: expected true or false, got ${String(value)}`)
        }
        await transport.writeSingleCoil(address, value)
        return
      }

      const scale = isTemperature(spec) ? await readScale() : 1
      const raw = encode(spec, value, scale)
      await transport.writeSingleRegister(address, raw)
    },
  }

  return Promise.resolve(driver)
}
