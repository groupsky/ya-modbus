/**
 * XYMD1 Temperature and Humidity Sensor Driver
 *
 * Factory default device specifications are exported via the DEFAULT_CONFIG constant.
 * See DEFAULT_CONFIG for baud rate, parity, data bits, stop bits, and default address.
 *
 * Register mapping:
 * - Input registers 1-2: Temperature (×10) and Humidity (×10)
 * - Holding register 0x101: Device address configuration
 * - Holding register 0x102: Baud rate configuration
 * - Holding register 0x103: Temperature correction (signed, ×10, -100 to +100)
 * - Holding register 0x104: Humidity correction (signed, ×10, -100 to +100)
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
 * Supported configuration values for XYMD1
 *
 * The device supports:
 * - Baud rates: 9600, 14400, 19200 bps
 * - Parity: even, none
 * - Data bits: 8 only
 * - Stop bits: 1 only
 * - Slave address: 1-247 (standard Modbus range)
 *
 * See DEFAULT_CONFIG for factory defaults.
 */
export const SUPPORTED_CONFIG = {
  validBaudRates: [9600, 14400, 19200],
  validParity: ['even', 'none'],
  validDataBits: [8],
  validStopBits: [1],
  validAddressRange: [1, 247],
} as const satisfies SupportedSerialConfig

/**
 * Default XYMD1 device configuration
 *
 * Use these values when connecting to a factory-default XYMD1 device.
 * These are the settings the device ships with from the manufacturer.
 *
 * @example
 * ```typescript
 * import { DEFAULT_CONFIG } from '@ya-modbus/driver-xymd1'
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
 * Data point definitions for XYMD1
 */
const DATA_POINTS: ReadonlyArray<DataPoint> = [
  {
    id: 'temperature',
    name: 'Temperature',
    type: 'float',
    unit: '°C',
    access: 'r',
    description: 'Temperature in degrees Celsius',
    decimals: 1,
  },
  {
    id: 'humidity',
    name: 'Relative Humidity',
    type: 'float',
    unit: '%',
    access: 'r',
    description: 'Relative humidity percentage',
    decimals: 1,
    min: 0,
    max: 100,
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
      9600: '9600 bps',
      14400: '14400 bps',
      19200: '19200 bps',
    },
  },
  {
    id: 'temperature_correction',
    name: 'Temperature Correction',
    type: 'float',
    unit: '°C',
    access: 'rw',
    pollType: 'on-demand',
    description: 'Temperature correction offset (-10.0 to +10.0°C)',
    decimals: 1,
    min: -10.0,
    max: 10.0,
  },
  {
    id: 'humidity_correction',
    name: 'Humidity Correction',
    type: 'float',
    unit: '%',
    access: 'rw',
    pollType: 'on-demand',
    description: 'Humidity correction offset (-10.0 to +10.0%RH)',
    decimals: 1,
    min: -10.0,
    max: 10.0,
  },
]

/**
 * Decode raw Modbus value to data point value
 */
function decodeDataPoint(id: string, rawValue: Buffer): unknown {
  if (id === 'temperature') {
    const temp = rawValue.readUInt16BE(0)
    return temp / 10
  }
  if (id === 'humidity') {
    const humidity = rawValue.readUInt16BE(2)
    return humidity / 10
  }
  if (id === 'device_address') {
    return rawValue.readUInt16BE(0)
  }
  if (id === 'baud_rate') {
    return rawValue.readUInt16BE(0)
  }
  // Both correction values use the same signed 16-bit encoding
  if (id === 'temperature_correction' || id === 'humidity_correction') {
    return rawValue.readInt16BE(0) / 10
  }
  throw new Error(`Unknown data point: ${id}`)
}

/**
 * Encode data point value to Modbus register value(s)
 */
function encodeDataPoint(id: string, value: unknown): Buffer {
  if (id === 'device_address') {
    if (typeof value !== 'number' || value < 1 || value > 247) {
      throw new Error('Invalid device address: must be between 1 and 247')
    }
    const buffer = Buffer.allocUnsafe(2)
    buffer.writeUInt16BE(value, 0)
    return buffer
  }
  if (id === 'baud_rate') {
    if (typeof value !== 'number' || !SUPPORTED_CONFIG.validBaudRates.includes(value)) {
      throw new Error(
        `Invalid baud rate: must be one of ${SUPPORTED_CONFIG.validBaudRates.join(', ')}`
      )
    }
    const buffer = Buffer.allocUnsafe(2)
    buffer.writeUInt16BE(value, 0)
    return buffer
  }
  // Both correction values use the same validation and encoding
  if (id === 'temperature_correction' || id === 'humidity_correction') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < -10.0 || value > 10.0) {
      const fieldName = id === 'temperature_correction' ? 'temperature' : 'humidity'
      throw new Error(`Invalid ${fieldName} correction: must be between -10.0 and 10.0`)
    }
    const buffer = Buffer.allocUnsafe(2)
    // Use Math.trunc for predictable rounding toward zero (avoids floating-point precision issues)
    const intValue = Math.trunc(value * 10)
    buffer.writeInt16BE(intValue, 0)
    return buffer
  }
  throw new Error(`Data point ${id} is read-only`)
}

/**
 * Create XYMD1 device driver
 */
export const createDriver: CreateDriverFunction = (config: DriverConfig) => {
  const { transport } = config

  const driver: DeviceDriver = {
    name: 'XY-MD1',
    manufacturer: 'Unknown',
    model: 'XY-MD1',
    dataPoints: DATA_POINTS,

    async readDataPoint(id: string): Promise<unknown> {
      if (id === 'device_address') {
        const buffer = await transport.readHoldingRegisters(0x101, 1)
        return decodeDataPoint(id, buffer)
      }
      if (id === 'baud_rate') {
        const buffer = await transport.readHoldingRegisters(0x102, 1)
        return decodeDataPoint(id, buffer)
      }
      if (id === 'temperature_correction') {
        const buffer = await transport.readHoldingRegisters(0x103, 1)
        return decodeDataPoint(id, buffer)
      }
      if (id === 'humidity_correction') {
        const buffer = await transport.readHoldingRegisters(0x104, 1)
        return decodeDataPoint(id, buffer)
      }
      // Always read both input registers for temperature and humidity
      const buffer = await transport.readInputRegisters(1, 2)
      return decodeDataPoint(id, buffer)
    },

    async writeDataPoint(id: string, value: unknown): Promise<void> {
      // Encode and validate the value (will throw if read-only or invalid)
      const buffer = encodeDataPoint(id, value)

      // Route to appropriate register address
      if (id === 'device_address') {
        await transport.writeMultipleRegisters(0x101, buffer)
      } else if (id === 'baud_rate') {
        await transport.writeMultipleRegisters(0x102, buffer)
      } else if (id === 'temperature_correction') {
        await transport.writeMultipleRegisters(0x103, buffer)
      } else if (id === 'humidity_correction') {
        await transport.writeMultipleRegisters(0x104, buffer)
      }
    },

    async readDataPoints(ids: string[]): Promise<Record<string, unknown>> {
      const result: Record<string, unknown> = {}

      // Separate data points by register type
      const inputRegisterPoints = ids.filter((id) => id === 'temperature' || id === 'humidity')
      const holdingRegisterPoints = ids.filter(
        (id) =>
          id === 'device_address' ||
          id === 'baud_rate' ||
          id === 'temperature_correction' ||
          id === 'humidity_correction'
      )

      // Read input registers (temperature and humidity) if needed
      if (inputRegisterPoints.length > 0) {
        const buffer = await transport.readInputRegisters(1, 2)
        for (const id of inputRegisterPoints) {
          result[id] = decodeDataPoint(id, buffer)
        }
      }

      // Optimize holding register reads by batching adjacent registers
      // All 4 holding registers are sequential: 0x101, 0x102, 0x103, 0x104
      if (holdingRegisterPoints.length === 4) {
        // Read all 4 registers in a single transaction (0x101-0x104)
        const buffer = await transport.readHoldingRegisters(0x101, 4)
        result['device_address'] = buffer.readUInt16BE(0)
        result['baud_rate'] = buffer.readUInt16BE(2)
        result['temperature_correction'] = buffer.readInt16BE(4) / 10
        result['humidity_correction'] = buffer.readInt16BE(6) / 10
      } else {
        // Batch by adjacent register groups
        const configPoints = holdingRegisterPoints.filter(
          (id) => id === 'device_address' || id === 'baud_rate'
        )
        const correctionPoints = holdingRegisterPoints.filter(
          (id) => id === 'temperature_correction' || id === 'humidity_correction'
        )

        // Read device_address and baud_rate together if both requested (registers 0x101-0x102)
        if (configPoints.length === 2) {
          const buffer = await transport.readHoldingRegisters(0x101, 2)
          result['device_address'] = buffer.readUInt16BE(0)
          result['baud_rate'] = buffer.readUInt16BE(2)
        } else {
          // Read individually if only one is requested
          for (const id of configPoints) {
            if (id === 'device_address') {
              const buffer = await transport.readHoldingRegisters(0x101, 1)
              result[id] = decodeDataPoint(id, buffer)
            } else if (id === 'baud_rate') {
              const buffer = await transport.readHoldingRegisters(0x102, 1)
              result[id] = decodeDataPoint(id, buffer)
            }
          }
        }

        // Read temperature_correction and humidity_correction together if both requested (registers 0x103-0x104)
        if (correctionPoints.length === 2) {
          const buffer = await transport.readHoldingRegisters(0x103, 2)
          result['temperature_correction'] = buffer.readInt16BE(0) / 10
          result['humidity_correction'] = buffer.readInt16BE(2) / 10
        } else {
          // Read individually if only one is requested
          for (const id of correctionPoints) {
            if (id === 'temperature_correction') {
              const buffer = await transport.readHoldingRegisters(0x103, 1)
              result[id] = decodeDataPoint(id, buffer)
            } else if (id === 'humidity_correction') {
              const buffer = await transport.readHoldingRegisters(0x104, 1)
              result[id] = decodeDataPoint(id, buffer)
            }
          }
        }
      }

      return result
    },
  }

  return Promise.resolve(driver)
}
