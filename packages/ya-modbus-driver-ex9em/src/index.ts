/**
 * NOARK Ex9EM Energy Meter Driver
 *
 * Factory default device specifications are exported via the DEFAULT_CONFIG constant.
 * See DEFAULT_CONFIG for baud rate, parity, data bits, stop bits, and default address.
 *
 * Register mapping (based on working device implementation):
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
 * Note: The official PDF register map (docs/ex9em-1p-1m-80a-mo-mt-register-map.pdf)
 * shows a different layout with gaps and tariff-specific energy registers.
 * This implementation is based on verified working code with the actual device.
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
 * - Baud rates: 9600, 19200 bps (typical Modbus RTU rates)
 * - Parity: even, none
 * - Data bits: 8 only
 * - Stop bits: 1 only
 * - Slave address: 1-247 (standard Modbus range)
 *
 * See DEFAULT_CONFIG for factory defaults.
 */
export const SUPPORTED_CONFIG = {
  validBaudRates: [9600, 19200],
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
    access: 'r',
    description: 'Total reactive energy in kilovolt-amperes reactive hours (kVArh)',
    decimals: 2,
  },
]

/**
 * Decode raw Modbus buffer to data point values
 */
function decodeAllDataPoints(buffer: Buffer): Record<string, unknown> {
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
  // Total active energy (registers 7-8, 32-bit, ×100)
  const total_active_energy = ((buffer.readUInt16BE(14) << 16) + buffer.readUInt16BE(16)) / 100
  // Total reactive energy (registers 9-10, 32-bit, ×100)
  const total_reactive_energy = ((buffer.readUInt16BE(18) << 16) + buffer.readUInt16BE(20)) / 100

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
      // Read all registers at once (0x0000-0x000A = 11 registers)
      const buffer = await transport.readHoldingRegisters(0x0000, 11)
      const allValues = decodeAllDataPoints(buffer)

      if (!(id in allValues)) {
        throw new Error(`Unknown data point: ${id}`)
      }

      return allValues[id]
    },

    async readDataPoints(ids: string[]): Promise<Record<string, unknown>> {
      // Read all registers at once (0x0000-0x000A = 11 registers)
      const buffer = await transport.readHoldingRegisters(0x0000, 11)
      const allValues = decodeAllDataPoints(buffer)

      // Return only the requested data points
      const result: Record<string, unknown> = {}
      for (const id of ids) {
        if (!(id in allValues)) {
          throw new Error(`Unknown data point: ${id}`)
        }
        result[id] = allValues[id]
      }

      return result
    },

    // eslint-disable-next-line @typescript-eslint/require-await
    async writeDataPoint(_id: string, _value: unknown): Promise<void> {
      throw new Error('All data points are read-only')
    },
  }

  return Promise.resolve(driver)
}
