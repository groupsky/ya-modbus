/**
 * NOARK Ex9EM Energy Meter Driver
 *
 * Factory default device specifications are exported via the DEFAULT_CONFIG constant.
 * See DEFAULT_CONFIG for baud rate, parity, data bits, stop bits, and default address.
 *
 * Register mapping:
 *
 * Measurement registers (based on working device implementation):
 * - Holding register 0x0000: Voltage (×10, V)
 * - Holding register 0x0001: Current (×10, A)
 * - Holding register 0x0002: Grid frequency (×10, Hz) [undocumented in PDF]
 * - Holding register 0x0003: Active power (W)
 * - Holding register 0x0004: Reactive power (VAr)
 * - Holding register 0x0005: Apparent power (VA)
 * - Holding register 0x0006: Power factor (×1000) [undocumented in PDF]
 * - Holding registers 0x0007-0x0008: Total active energy (32-bit, ×100, kWh)
 * - Holding registers 0x0009-0x000A: Total reactive energy (32-bit, ×100, kVArh)
 *
 * Configuration registers (per PDF documentation):
 * - Holding register 0x002A: Baud rate (1=1200, 2=2400, 3=4800, 4=9600)
 * - Holding register 0x002B: Device address (1-247)
 * - Holding registers 0x002C-0x002D: Password (32-bit, default 0)
 *
 * Note: The official PDF register map (docs/ex9em-1p-1m-80a-mo-mt-register-map.pdf)
 * shows a different layout with gaps and tariff-specific energy registers for 0x0007-0x001A.
 * This implementation uses the simplified layout from verified working code.
 */

import type {
  DeviceDriver,
  DataPoint,
  CreateDriverFunction,
  DriverConfig,
  DefaultSerialConfig,
  SupportedSerialConfig,
} from '@ya-modbus/driver-types'

/**
 * Supported configuration values for Ex9EM
 *
 * The device supports:
 * - Baud rates: 1200, 2400, 4800, 9600 bps (per register map PDF)
 * - Parity: even, none
 * - Data bits: 8 only
 * - Stop bits: 1 only
 * - Slave address: 1-247 (standard Modbus range)
 *
 * See DEFAULT_CONFIG for factory defaults.
 */
export const SUPPORTED_CONFIG = {
  validBaudRates: [1200, 2400, 4800, 9600],
  validParity: ['even', 'none'],
  validDataBits: [8],
  validStopBits: [1],
  validAddressRange: [1, 247],
} as const satisfies SupportedSerialConfig

/**
 * Default Ex9EM device configuration
 *
 * Use these values when connecting to a factory-default Ex9EM device.
 * These are the settings the device ships with from the manufacturer.
 *
 * @example
 * ```typescript
 * import { DEFAULT_CONFIG } from 'ya-modbus-driver-ex9em'
 *
 * const transport = await createRTUTransport({
 *   port: '/dev/ttyUSB0',
 *   baudRate: DEFAULT_CONFIG.baudRate,
 *   parity: DEFAULT_CONFIG.parity,
 *   dataBits: DEFAULT_CONFIG.dataBits,
 *   stopBits: DEFAULT_CONFIG.stopBits,
 *   slaveId: DEFAULT_CONFIG.defaultAddress,
 * })
 * ```
 */
export const DEFAULT_CONFIG = {
  baudRate: 9600,
  parity: 'even',
  dataBits: 8,
  stopBits: 1,
  defaultAddress: 1,
} as const satisfies DefaultSerialConfig

/**
 * Data point definitions for Ex9EM
 */
const DATA_POINTS: ReadonlyArray<DataPoint> = [
  {
    id: 'voltage',
    name: 'Voltage',
    type: 'float',
    unit: 'V',
    access: 'r',
    description: 'Line voltage in volts',
    decimals: 1,
  },
  {
    id: 'current',
    name: 'Current',
    type: 'float',
    unit: 'A',
    access: 'r',
    description: 'Line current in amperes',
    decimals: 1,
  },
  {
    id: 'frequency',
    name: 'Grid Frequency',
    type: 'float',
    unit: 'Hz',
    access: 'r',
    description: 'Grid frequency in hertz',
    decimals: 1,
  },
  {
    id: 'active_power',
    name: 'Active Power',
    type: 'integer',
    unit: 'W',
    access: 'r',
    description: 'Active power in watts',
  },
  {
    id: 'reactive_power',
    name: 'Reactive Power',
    type: 'integer',
    unit: 'VAr',
    access: 'r',
    description: 'Reactive power in volt-amperes reactive',
  },
  {
    id: 'apparent_power',
    name: 'Apparent Power',
    type: 'integer',
    unit: 'VA',
    access: 'r',
    description: 'Apparent power in volt-amperes',
  },
  {
    id: 'power_factor',
    name: 'Power Factor',
    type: 'float',
    access: 'r',
    description: 'Power factor (0.000-1.000, dimensionless)',
    decimals: 3,
    min: 0,
    max: 1,
  },
  {
    id: 'total_active_energy',
    name: 'Total Active Energy',
    type: 'float',
    unit: 'kWh',
    access: 'r',
    description: 'Total active energy consumption in kilowatt-hours',
    decimals: 2,
  },
  {
    id: 'total_reactive_energy',
    name: 'Total Reactive Energy',
    type: 'float',
    unit: 'kVArh',
    access: 'r',
    description: 'Total reactive energy in kilovolt-amperes reactive hours',
    decimals: 2,
  },
  {
    id: 'device_address',
    name: 'Device Address',
    type: 'integer',
    access: 'rw',
    pollType: 'on-demand',
    description: 'Modbus device address (1-247). Changes applied after device restart.',
    min: 1,
    max: 247,
  },
  {
    id: 'baud_rate',
    name: 'Baud Rate',
    type: 'enum',
    access: 'rw',
    pollType: 'on-demand',
    description: 'Serial communication baud rate. Changes applied after device restart.',
    enumValues: {
      1200: '1200 bps',
      2400: '2400 bps',
      4800: '4800 bps',
      9600: '9600 bps',
    },
  },
  {
    id: 'password',
    name: 'Password',
    type: 'integer',
    access: 'w',
    pollType: 'on-demand',
    description:
      'Device password for configuration changes (32-bit, default 0). Write password before changing configuration.',
    min: 0,
    max: 4294967295,
  },
]

/**
 * Valid baud rate type extracted from SUPPORTED_CONFIG
 */
type ValidBaudRate = (typeof SUPPORTED_CONFIG.validBaudRates)[number]

/**
 * Baud rate encoding/decoding mappings
 * Device encoding: 1=1200, 2=2400, 3=4800, 4=9600 bps
 */
const BAUD_RATE_DECODE: Record<number, number> = { 1: 1200, 2: 2400, 3: 4800, 4: 9600 }
const BAUD_RATE_ENCODE: Record<ValidBaudRate, number> = { 1200: 1, 2400: 2, 4800: 3, 9600: 4 }

/**
 * Validate that a value is one of the supported baud rates
 */
function isValidBaudRate(value: unknown): value is ValidBaudRate {
  return (
    typeof value === 'number' && SUPPORTED_CONFIG.validBaudRates.includes(value as ValidBaudRate)
  )
}

/**
 * Decode raw Modbus buffer containing measurement data to data point values
 */
function decodeMeasurementDataPoints(buffer: Buffer): Record<string, unknown> {
  // Buffer must contain 11 registers (22 bytes) for all measurement data
  if (buffer.length < 22) {
    throw new Error(`Buffer too short: expected at least 22 bytes, got ${buffer.length}`)
  }

  // Voltage (register 0, ×10)
  const voltage = buffer.readUInt16BE(0) / 10
  // Current (register 1, ×10)
  const current = buffer.readUInt16BE(2) / 10
  // Grid frequency (register 2, ×10)
  const frequency = buffer.readUInt16BE(4) / 10
  // Active power (register 3)
  const active_power = buffer.readUInt16BE(6)
  // Reactive power (register 4)
  const reactive_power = buffer.readUInt16BE(8)
  // Apparent power (register 5)
  const apparent_power = buffer.readUInt16BE(10)
  // Power factor (register 6, ×1000)
  const power_factor = buffer.readUInt16BE(12) / 1000
  // Total active energy (registers 7-8, 32-bit big-endian, ×100)
  const total_active_energy = buffer.readUInt32BE(14) / 100
  // Total reactive energy (registers 9-10, 32-bit big-endian, ×100)
  const total_reactive_energy = buffer.readUInt32BE(18) / 100

  return {
    voltage,
    current,
    frequency,
    active_power,
    reactive_power,
    apparent_power,
    power_factor,
    total_active_energy,
    total_reactive_energy,
  }
}

/**
 * Create Ex9EM device driver
 */
export const createDriver: CreateDriverFunction = (config: DriverConfig) => {
  const { transport } = config

  const driver: DeviceDriver = {
    name: 'Ex9EM',
    manufacturer: 'NOARK Electric',
    model: 'Ex9EM',
    dataPoints: DATA_POINTS,

    async readDataPoint(id: string): Promise<unknown> {
      // Configuration registers (read individually)
      if (id === 'baud_rate') {
        const buffer = await transport.readHoldingRegisters(0x002a, 1)
        const value = buffer.readUInt16BE(0)
        const decoded = BAUD_RATE_DECODE[value]
        if (decoded === undefined) {
          throw new Error(`Unknown baud rate encoding from device: ${value}`)
        }
        return decoded
      }
      if (id === 'device_address') {
        const buffer = await transport.readHoldingRegisters(0x002b, 1)
        return buffer.readUInt16BE(0)
      }
      if (id === 'password') {
        throw new Error('Password is write-only')
      }

      // Read all measurement registers at once (0x0000-0x000A = 11 registers)
      const buffer = await transport.readHoldingRegisters(0x0000, 11)
      const allValues = decodeMeasurementDataPoints(buffer)

      if (!(id in allValues)) {
        throw new Error(`Unknown data point: ${id}`)
      }

      return allValues[id]
    },

    async readDataPoints(ids: string[]): Promise<Record<string, unknown>> {
      // Check for write-only data points first
      if (ids.includes('password')) {
        throw new Error('Password is write-only')
      }

      const result: Record<string, unknown> = {}

      // Separate measurement and configuration data points
      const measurementIds = ids.filter(
        (id) => id !== 'baud_rate' && id !== 'device_address' && id !== 'password'
      )
      const configIds = ids.filter((id) => id === 'baud_rate' || id === 'device_address')

      // Read measurement registers if needed (0x0000-0x000A = 11 registers)
      if (measurementIds.length > 0) {
        const buffer = await transport.readHoldingRegisters(0x0000, 11)
        const allValues = decodeMeasurementDataPoints(buffer)
        for (const id of measurementIds) {
          if (!(id in allValues)) {
            throw new Error(`Unknown data point: ${id}`)
          }
          result[id] = allValues[id]
        }
      }

      // Read configuration registers (batch adjacent registers when possible)
      if (configIds.length === 2) {
        // Both baud_rate and device_address requested - read in single transaction
        const buffer = await transport.readHoldingRegisters(0x002a, 2)
        const baudValue = buffer.readUInt16BE(0)
        result.baud_rate = BAUD_RATE_DECODE[baudValue] ?? baudValue
        result.device_address = buffer.readUInt16BE(2)
      } else {
        // Single config register requested - read individually
        for (const id of configIds) {
          result[id] = await this.readDataPoint(id)
        }
      }

      return result
    },

    async writeDataPoint(id: string, value: unknown): Promise<void> {
      // Validate and write baud rate (register 0x002A)
      if (id === 'baud_rate') {
        if (!isValidBaudRate(value)) {
          throw new Error(
            `Invalid baud rate: must be one of ${SUPPORTED_CONFIG.validBaudRates.join(', ')}`
          )
        }
        const encoded = BAUD_RATE_ENCODE[value]
        const buffer = Buffer.allocUnsafe(2)
        buffer.writeUInt16BE(encoded, 0)
        await transport.writeMultipleRegisters(0x002a, buffer)
        return
      }

      // Validate and write device address (register 0x002B, range 1-247)
      if (id === 'device_address') {
        const [min, max] = SUPPORTED_CONFIG.validAddressRange
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
          throw new Error(`Invalid device address: must be between ${min} and ${max}`)
        }
        const buffer = Buffer.allocUnsafe(2)
        buffer.writeUInt16BE(value, 0)
        await transport.writeMultipleRegisters(0x002b, buffer)
        return
      }

      // Write password (32-bit, registers 0x002C-0x002D, range 0-4294967295)
      if (id === 'password') {
        if (
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 4294967295
        ) {
          throw new Error('Invalid password: must be between 0 and 4294967295')
        }
        const buffer = Buffer.allocUnsafe(4)
        buffer.writeUInt32BE(value, 0)
        await transport.writeMultipleRegisters(0x002c, buffer)
        return
      }

      // All other data points are read-only
      throw new Error(`Data point ${id} is read-only`)
    },
  }

  return Promise.resolve(driver)
}
