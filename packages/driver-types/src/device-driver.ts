/**
 * Core device driver interface
 */

import type { DataPoint } from './data-types.js'
import type { Transport } from './transport.js'

/**
 * Modbus slave/device ID
 *
 * Valid range: 1-247 (0 is broadcast, 248-255 reserved)
 */
export type SlaveId = number

/**
 * Device driver factory function configuration
 *
 * For multi-device drivers, the deviceType field selects which device variant
 * to create. Device selection is manual (no auto-detection).
 *
 * @example
 * ```typescript
 * // Explicit device selection for multi-device driver
 * const driver = await createDriver({
 *   transport,
 *   slaveId: 1,
 *   deviceType: 'md02',  // Select specific device variant
 * })
 *
 * // Auto-selection (driver chooses default variant)
 * const driver = await createDriver({
 *   transport,
 *   slaveId: 1,
 *   // deviceType omitted - driver uses default device
 * })
 * ```
 */
export interface DriverConfig {
  /** Optional device type within driver package (for multi-device drivers) */
  deviceType?: string

  /** Modbus transport layer */
  transport: Transport

  /** Modbus slave ID (1-247) */
  slaveId: SlaveId

  /** Optional custom poll interval in milliseconds */
  pollInterval?: number
}

/**
 * Device driver interface
 *
 * Drivers are created using factory functions that return objects
 * implementing this interface.
 */
export interface DeviceDriver {
  /** Unique device name/identifier */
  readonly name: string

  /** Device manufacturer */
  readonly manufacturer: string

  /** Device model identifier */
  readonly model: string

  /** Available data points (semantic interface) */
  readonly dataPoints: ReadonlyArray<DataPoint>

  /**
   * Read data point value from device
   *
   * @param id - Data point identifier
   * @returns Current value
   */
  readDataPoint(id: string): Promise<unknown>

  /**
   * Write data point value to device
   *
   * @param id - Data point identifier
   * @param value - Value to write
   */
  writeDataPoint(id: string, value: unknown): Promise<void>

  /**
   * Read multiple data points atomically
   *
   * @param ids - Data point identifiers
   * @returns Map of data point values
   */
  readDataPoints(ids: string[]): Promise<Record<string, unknown>>

  /**
   * Optional device initialization
   * Called once after driver creation
   */
  initialize?(): Promise<void>

  /**
   * Optional cleanup
   * Called when driver is being destroyed
   */
  destroy?(): Promise<void>
}

/**
 * Factory function signature for creating device drivers
 */
export type CreateDriverFunction = (config: DriverConfig) => Promise<DeviceDriver>

/**
 * Serial port parity setting
 */
export type Parity = 'none' | 'even' | 'odd'

/**
 * Serial port data bits
 */
export type DataBits = 7 | 8

/**
 * Serial port stop bits
 */
export type StopBits = 1 | 2

/**
 * Serial port baud rate
 *
 * Common values: 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200
 */
export type BaudRate = number

/**
 * Factory-default serial port configuration for RTU devices
 *
 * Driver packages should export a DEFAULT_CONFIG constant implementing this interface
 * to provide sensible defaults for connecting to factory-default devices.
 *
 * @example
 * ```typescript
 * export const DEFAULT_CONFIG = {
 *   baudRate: 9600,
 *   parity: 'even',
 *   dataBits: 8,
 *   stopBits: 1,
 *   defaultAddress: 1,
 * } as const satisfies DefaultSerialConfig
 * ```
 */
export interface DefaultSerialConfig {
  /** Default baud rate (e.g., 9600, 19200) */
  readonly baudRate: BaudRate

  /** Default parity setting */
  readonly parity: Parity

  /** Default data bits (7 or 8) */
  readonly dataBits: DataBits

  /** Default stop bits (1 or 2) */
  readonly stopBits: StopBits

  /** Default Modbus slave address (1-247) */
  readonly defaultAddress: SlaveId
}

/**
 * Factory-default TCP configuration for Modbus TCP devices
 *
 * @example
 * ```typescript
 * export const DEFAULT_CONFIG = {
 *   defaultAddress: 1,
 *   defaultPort: 502,
 * } as const satisfies DefaultTCPConfig
 * ```
 */
export interface DefaultTCPConfig {
  /** Default Modbus unit ID (1-247) */
  readonly defaultAddress: SlaveId

  /** Default TCP port (typically 502) */
  readonly defaultPort: number
}

/**
 * Union type for default device configuration
 *
 * Drivers should export DEFAULT_CONFIG matching one of these types
 */
export type DefaultConfig = DefaultSerialConfig | DefaultTCPConfig

/**
 * Supported serial port configuration values
 *
 * Serial driver packages should export a SUPPORTED_CONFIG constant implementing this interface
 * to define device-specific serial configuration constraints.
 *
 * All properties are optional - only specify values that are device-specific.
 * Omit properties if your device supports all standard Modbus values for that setting.
 * For example, omit `validParity` if your device supports all parity options (none/even/odd).
 *
 * @example
 * ```typescript
 * import type { SupportedSerialConfig } from '@ya-modbus/driver-types'
 *
 * export const SUPPORTED_CONFIG = {
 *   validBaudRates: [9600, 14400, 19200],
 *   validParity: ['even', 'none'],
 *   validDataBits: [8],
 *   validStopBits: [1],
 *   validAddressRange: [1, 247],
 * } as const satisfies SupportedSerialConfig
 * ```
 */
export interface SupportedSerialConfig {
  /**
   * Supported baud rates
   * Common values: 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200
   */
  readonly validBaudRates?: readonly BaudRate[]

  /**
   * Supported parity settings
   * Values: 'none', 'even', 'odd'
   */
  readonly validParity?: readonly Parity[]

  /**
   * Supported data bits
   * Common values: 7, 8
   */
  readonly validDataBits?: readonly DataBits[]

  /**
   * Supported stop bits
   * Common values: 1, 2
   */
  readonly validStopBits?: readonly StopBits[]

  /**
   * Supported slave address range
   * Typically 1-247 for Modbus
   */
  readonly validAddressRange?: readonly [min: number, max: number]
}

/**
 * Supported TCP configuration values
 *
 * TCP driver packages should export a SUPPORTED_CONFIG constant implementing this interface
 * to define device-specific TCP configuration constraints.
 *
 * @example
 * ```typescript
 * import type { SupportedTCPConfig } from '@ya-modbus/driver-types'
 *
 * export const SUPPORTED_CONFIG = {
 *   validPorts: [502, 503],
 *   validAddressRange: [1, 247],
 * } as const satisfies SupportedTCPConfig
 * ```
 */
export interface SupportedTCPConfig {
  /**
   * Supported TCP ports
   * Typically [502] for standard Modbus TCP
   */
  readonly validPorts?: readonly number[]

  /**
   * Supported device address range
   * For Modbus TCP, this is the unit ID (typically 1-247)
   */
  readonly validAddressRange?: readonly [min: number, max: number]
}

/**
 * Union type for supported device configuration
 *
 * Drivers should export SUPPORTED_CONFIG matching one of these types
 */
export type SupportedConfig = SupportedSerialConfig | SupportedTCPConfig

/**
 * Metadata for a device variant within a multi-device driver package
 *
 * Device ID is the object key in the metadata record.
 * Configs are embedded directly in the metadata for single source of truth.
 *
 * @example
 * ```typescript
 * export const DEVICE_METADATA = {
 *   md01: {
 *     name: 'XY-MD01',
 *     manufacturer: 'Unknown',
 *     model: 'XY-MD01',
 *     description: 'Temperature sensor',
 *     defaultConfig: { baudRate: 9600, parity: 'none', ... },
 *     supportedConfig: { validBaudRates: [9600, 14400, 19200], ... },
 *   },
 * } as const satisfies Record<string, DeviceMetadata>
 * ```
 */
export interface DeviceMetadata {
  /** Human-readable device name (e.g., 'XY-MD01') */
  readonly name: string

  /** Manufacturer name */
  readonly manufacturer: string

  /** Model identifier */
  readonly model: string

  /** Brief description (optional) */
  readonly description?: string

  /** Device-specific data points */
  readonly dataPoints: ReadonlyArray<DataPoint>

  /** Device-specific default configuration (optional) */
  readonly defaultConfig?: DefaultConfig

  /** Device-specific configuration constraints (optional) */
  readonly supportedConfig?: SupportedConfig
}
