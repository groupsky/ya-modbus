/**
 * XYMD1 Temperature and Humidity Sensor Driver
 *
 * Supports XY-MD01 and XY-MD02 devices. Both models have identical Modbus interfaces
 * and cannot be distinguished programmatically - only by physical appearance.
 *
 * Device specifications are exported via DEVICE_METADATA.
 * See DEVICE_METADATA.md01 and DEVICE_METADATA.md02 for device-specific configurations.
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
  DeviceMetadata,
} from '@ya-modbus/driver-types'

/**
 * Device metadata for XYMD1 driver variants
 *
 * Single source of truth for device information and configurations.
 * XY-MD01 and XY-MD02 are identical from Modbus perspective - cannot be distinguished programmatically.
 *
 * Summaries: Referenced in README.md and AGENTS.md
 */
/**
 * Supported configuration shared by all XYMD1 devices
 * All devices support the same baud rates, parity options, etc.
 */
const SHARED_SUPPORTED_CONFIG = {
  validBaudRates: [9600, 14400, 19200],
  validParity: ['none', 'even', 'odd'],
  validDataBits: [8],
  validStopBits: [1],
  validAddressRange: [1, 247],
} as const

/**
 * Data point definitions shared by all XYMD1 devices
 * Both XY-MD01 and XY-MD02 have identical data points
 */
const SHARED_DATA_POINTS: ReadonlyArray<DataPoint> = [
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
 * Device metadata for XYMD1 driver variants
 *
 * Single source of truth for device information, data points, and configurations.
 * XY-MD01 and XY-MD02 are identical from Modbus perspective - cannot be distinguished programmatically.
 */
export const DEVICE_METADATA = {
  md01: {
    name: 'XY-MD01',
    manufacturer: 'Unknown',
    model: 'XY-MD01',
    description: 'Temperature and humidity sensor (typically configured with parity: none)',
    dataPoints: SHARED_DATA_POINTS,
    defaultConfig: {
      baudRate: 9600,
      parity: 'none',
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 1,
    },
    supportedConfig: SHARED_SUPPORTED_CONFIG,
  },
  md02: {
    name: 'XY-MD02',
    manufacturer: 'Unknown',
    model: 'XY-MD02',
    description: 'Temperature and humidity sensor (typically configured with parity: even)',
    dataPoints: SHARED_DATA_POINTS,
    defaultConfig: {
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 1,
    },
    supportedConfig: SHARED_SUPPORTED_CONFIG,
  },
} as const satisfies Record<string, DeviceMetadata>

export type XYMD1DeviceType = keyof typeof DEVICE_METADATA

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
 * Valid baud rate type extracted from device metadata
 * Both device variants support the same baud rates
 */
type ValidBaudRate = NonNullable<
  (typeof DEVICE_METADATA)['md01']['supportedConfig']
>['validBaudRates'] extends readonly (infer T)[]
  ? T
  : never

/**
 * Validate that a value is one of the supported baud rates
 *
 * This pattern extracts the literal type from the config array and uses it
 * in the type guard, providing more specific type narrowing than just 'number'.
 */
function isValidBaudRate(value: unknown): value is ValidBaudRate {
  const validBaudRates = DEVICE_METADATA.md01.supportedConfig.validBaudRates
  return typeof value === 'number' && validBaudRates.includes(value as ValidBaudRate)
}

/**
 * Encode data point value to Modbus register value(s)
 */
function encodeDataPoint(id: string, value: unknown): Buffer {
  if (id === 'device_address') {
    const [min, max] = DEVICE_METADATA.md01.supportedConfig.validAddressRange
    if (typeof value !== 'number' || value < min || value > max) {
      throw new Error(`Invalid device address: must be between ${min} and ${max}`)
    }
    const buffer = Buffer.allocUnsafe(2)
    buffer.writeUInt16BE(value, 0)
    return buffer
  }
  if (id === 'baud_rate') {
    if (!isValidBaudRate(value)) {
      const validBaudRates = DEVICE_METADATA.md01.supportedConfig.validBaudRates
      throw new Error(`Invalid baud rate: must be one of ${validBaudRates.join(', ')}`)
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
 * Determine device variant from DriverConfig
 * Defaults to md01 if not specified
 */
function determineDeviceType(config: DriverConfig): XYMD1DeviceType {
  if (config.deviceType) {
    if (config.deviceType in DEVICE_METADATA) {
      return config.deviceType as XYMD1DeviceType
    }

    const validTypes = Object.keys(DEVICE_METADATA).join(', ')
    const deviceList = Object.entries(DEVICE_METADATA)
      .map(
        ([id, meta]) => `  - ${id}: ${meta.name}${meta.description ? ` (${meta.description})` : ''}`
      )
      .join('\n')

    throw new Error(
      `Invalid deviceType: "${config.deviceType}". ` +
        `Valid types for xymd1 driver: ${validTypes}\n\n` +
        `Available devices:\n${deviceList}`
    )
  }

  // Default to md01
  return 'md01'
}

/**
 * Create XYMD1 device driver
 */
export const createDriver: CreateDriverFunction = (config: DriverConfig) => {
  try {
    const { transport } = config

    const deviceType = determineDeviceType(config)
    const metadata = DEVICE_METADATA[deviceType]

    const driver: DeviceDriver = {
      name: metadata.name,
      manufacturer: metadata.manufacturer,
      model: metadata.model,
      dataPoints: metadata.dataPoints,

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
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}
