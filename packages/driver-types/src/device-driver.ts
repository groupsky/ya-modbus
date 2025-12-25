/**
 * Core device driver interface
 */

import type { DataPoint } from './data-types.js'
import type { Transport } from './transport.js'

/**
 * Device driver factory function configuration
 */
export interface DriverConfig {
  /** Optional device type within driver package */
  deviceType?: string

  /** Modbus transport layer */
  transport: Transport

  /** Modbus slave ID (1-247) */
  slaveId: number

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
 * Factory-default serial port configuration for RTU devices
 *
 * Driver packages should export a DEFAULT_CONFIG constant implementing this interface
 * to provide sensible defaults for connecting to factory-default devices.
 *
 * @example
 * ```typescript
 * export const DEFAULT_CONFIG: DefaultSerialConfig = {
 *   baudRate: 9600,
 *   parity: 'even',
 *   dataBits: 8,
 *   stopBits: 1,
 *   defaultAddress: 1,
 * } as const
 * ```
 */
export interface DefaultSerialConfig {
  /** Default baud rate (e.g., 9600, 19200) */
  readonly baudRate: number

  /** Default parity setting */
  readonly parity: 'none' | 'even' | 'odd'

  /** Default data bits (7 or 8) */
  readonly dataBits: 7 | 8

  /** Default stop bits (1 or 2) */
  readonly stopBits: 1 | 2

  /** Default Modbus slave address (1-247) */
  readonly defaultAddress: number
}

/**
 * Factory-default TCP configuration for Modbus TCP devices
 *
 * @example
 * ```typescript
 * export const DEFAULT_CONFIG: DefaultTCPConfig = {
 *   defaultAddress: 1,
 *   defaultPort: 502,
 * } as const
 * ```
 */
export interface DefaultTCPConfig {
  /** Default Modbus unit ID (1-247) */
  readonly defaultAddress: number

  /** Default TCP port (typically 502) */
  readonly defaultPort: number
}

/**
 * Union type for default device configuration
 *
 * Drivers should export DEFAULT_CONFIG matching one of these types
 */
export type DefaultConfig = DefaultSerialConfig | DefaultTCPConfig
