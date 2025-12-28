import readline from 'readline/promises'

import type {
  BaudRate,
  DataBits,
  DataPoint,
  DeviceDriver,
  Parity,
  StopBits,
  Transport,
} from '@ya-modbus/driver-types'

import { loadDriver, type LoadedDriver } from '../driver-loader/loader.js'
import { createTransport, type TransportConfig } from '../transport/factory.js'

/**
 * Default RTU transport configuration values
 */
export const DEFAULT_RTU_CONFIG = {
  port: '/dev/ttyUSB0',
  baudRate: 9600 as BaudRate,
  dataBits: 8 as DataBits,
  parity: 'even' as Parity,
  stopBits: 1 as StopBits,
} as const

/**
 * Default TCP port for Modbus TCP
 */
export const DEFAULT_TCP_PORT = 502

/**
 * Check if a data point is readable
 */
export function isReadable(dataPoint: DataPoint): boolean {
  const access = dataPoint.access ?? 'r'
  return access === 'r' || access === 'rw'
}

/**
 * Check if a data point is writable
 */
export function isWritable(dataPoint: DataPoint): boolean {
  const access = dataPoint.access ?? 'r'
  return access === 'w' || access === 'rw'
}

/**
 * Find a data point by ID
 *
 * @param driver - Device driver instance
 * @param id - Data point ID
 * @returns Data point definition
 * @throws Error if data point not found
 */
export function findDataPoint(driver: DeviceDriver, id: string): DataPoint {
  const dataPoint = driver.dataPoints.find((dp) => dp.id === id)

  if (!dataPoint) {
    throw new Error(`Data point not found: ${id}`)
  }

  return dataPoint
}

/**
 * Find and validate a readable data point
 *
 * @param driver - Device driver instance
 * @param id - Data point ID
 * @returns Data point definition
 * @throws Error if data point not found or not readable
 */
export function findReadableDataPoint(driver: DeviceDriver, id: string): DataPoint {
  const dataPoint = findDataPoint(driver, id)

  if (!isReadable(dataPoint)) {
    throw new Error(`Data point is write-only: ${id}`)
  }

  return dataPoint
}

/**
 * Find and validate a writable data point
 *
 * @param driver - Device driver instance
 * @param id - Data point ID
 * @returns Data point definition
 * @throws Error if data point not found or not writable
 */
export function findWritableDataPoint(driver: DeviceDriver, id: string): DataPoint {
  const dataPoint = findDataPoint(driver, id)

  if (!isWritable(dataPoint)) {
    throw new Error(`Data point is read-only: ${id}`)
  }

  return dataPoint
}

/**
 * Compare two floating point numbers for approximate equality
 *
 * Uses relative error to handle both very small and very large values correctly.
 * Also checks absolute error to handle values near zero.
 *
 * @param a - First value
 * @param b - Second value
 * @param relativeEpsilon - Relative error tolerance (default: 1e-6, or 0.0001%)
 * @param absoluteEpsilon - Absolute error tolerance for values near zero (default: 1e-9)
 * @returns True if values are approximately equal
 */
export function floatsEqual(
  a: number,
  b: number,
  relativeEpsilon = 1e-6,
  absoluteEpsilon = 1e-9
): boolean {
  const absoluteError = Math.abs(a - b)

  // Check absolute error first (handles values near zero)
  if (absoluteError < absoluteEpsilon) {
    return true
  }

  // Check relative error (handles large and small values)
  const largestMagnitude = Math.max(Math.abs(a), Math.abs(b))
  const relativeError = absoluteError / largestMagnitude

  return relativeError < relativeEpsilon
}

/**
 * Parse value string based on data point type
 */
export function parseValue(valueStr: string, dataPoint: DataPoint): unknown {
  switch (dataPoint.type) {
    case 'float':
      return parseFloat(valueStr)

    case 'integer':
      return parseInt(valueStr, 10)

    case 'boolean':
      return valueStr.toLowerCase() === 'true' || valueStr === '1'

    case 'string':
      return valueStr

    case 'enum': {
      // Try to parse as number first, otherwise use string
      const num = parseInt(valueStr, 10)
      return isNaN(num) ? valueStr : num
    }

    default:
      return valueStr
  }
}

/**
 * Validate value against data point constraints
 */
export function validateValue(value: unknown, dataPoint: DataPoint): void {
  // Check min/max for numeric types
  if ((dataPoint.type === 'float' || dataPoint.type === 'integer') && typeof value === 'number') {
    if (dataPoint.min !== undefined && value < dataPoint.min) {
      throw new Error(
        `Value ${value} is outside valid range [${dataPoint.min}, ${dataPoint.max ?? '∞'}]`
      )
    }

    if (dataPoint.max !== undefined && value > dataPoint.max) {
      throw new Error(
        `Value ${value} is outside valid range [${dataPoint.min ?? '-∞'}, ${dataPoint.max}]`
      )
    }
  }

  // Validate enum values
  if (dataPoint.type === 'enum' && dataPoint.enumValues) {
    const validKeys = Object.keys(dataPoint.enumValues)
    const valueStr = String(value)

    if (!validKeys.includes(valueStr)) {
      throw new Error(`Invalid enum value: ${String(value)}. Valid values: ${validKeys.join(', ')}`)
    }
  }
}

/**
 * Prompt user for confirmation
 */
export async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const answer = await rl.question(`${message} (y/N): `)
    return answer.toLowerCase() === 'y'
  } finally {
    rl.close()
  }
}

/**
 * Options for creating a transport
 */
export interface TransportOptions {
  // TCP options
  host?: string
  port?: string | number

  // RTU options
  baudRate?: number
  dataBits?: number
  parity?: string
  stopBits?: number

  // Common options
  slaveId: number
  timeout?: number
}

/**
 * Options for loading a driver
 */
export interface DriverOptions {
  driver?: string
  device?: string
  slaveId: number
}

/**
 * Execute a function with a transport, ensuring cleanup
 *
 * @param options - Transport configuration options
 * @param fn - Function to execute with the transport
 * @returns Result of the function
 */
export async function withTransport<T>(
  options: TransportOptions,
  fn: (transport: Transport) => Promise<T>
): Promise<T> {
  // Build transport configuration
  const transportConfig: TransportConfig = options.host
    ? {
        // TCP configuration
        host: options.host,
        port: typeof options.port === 'number' ? options.port : DEFAULT_TCP_PORT,
        slaveId: options.slaveId,
        timeout: options.timeout,
      }
    : {
        // RTU configuration
        port: (options.port as string | undefined) ?? DEFAULT_RTU_CONFIG.port,
        baudRate: options.baudRate ?? DEFAULT_RTU_CONFIG.baudRate,
        dataBits: (options.dataBits ?? DEFAULT_RTU_CONFIG.dataBits) as DataBits,
        parity: (options.parity ?? DEFAULT_RTU_CONFIG.parity) as Parity,
        stopBits: (options.stopBits ?? DEFAULT_RTU_CONFIG.stopBits) as StopBits,
        slaveId: options.slaveId,
        timeout: options.timeout,
      }

  // Create transport
  const transport = await createTransport(transportConfig)

  try {
    return await fn(transport)
  } finally {
    // Always close the transport to release resources and allow process to exit
    await transport.close()
  }
}

/**
 * Load driver metadata without creating an instance
 *
 * @param driverName - Optional driver package name
 * @returns Loaded driver metadata
 */
export async function loadDriverMetadata(driverName?: string): Promise<LoadedDriver> {
  return await loadDriver(driverName ? { driverPackage: driverName } : { localPackage: true })
}

/**
 * Pass through transport options unchanged
 *
 * Device configuration is now handled at the device level via DEVICE_METADATA.
 * Connection parameters must be explicitly specified by the user.
 *
 * @param options - Transport options
 * @returns Transport options unchanged
 */
export function applyDriverDefaults(
  options: TransportOptions,
  _driverMetadata?: LoadedDriver
): TransportOptions {
  return options
}

/**
 * Execute a function with a driver instance, ensuring cleanup
 *
 * @param transport - Transport to use for driver communication
 * @param driverMetadata - Loaded driver metadata
 * @param slaveId - Modbus slave ID
 * @param fn - Function to execute with the driver
 * @returns Result of the function
 */
export async function withDriverInstance<T>(
  transport: Transport,
  driverMetadata: LoadedDriver,
  slaveId: number,
  deviceType: string | undefined,
  fn: (driver: DeviceDriver) => Promise<T>
): Promise<T> {
  // Create driver instance
  const driver = await driverMetadata.createDriver({
    transport,
    slaveId,
    ...(deviceType && { deviceType }),
  })

  return await fn(driver)
}

/**
 * Execute a function with a driver instance, handling the complete workflow
 *
 * This is a convenience function that:
 * 1. Loads driver metadata (DEFAULT_CONFIG, SUPPORTED_CONFIG)
 * 2. Validates user options against driver constraints (SUPPORTED_CONFIG)
 * 3. Applies driver defaults to user options
 * 4. Validates merged options (catches invalid third-party driver defaults)
 * 5. Creates transport with merged configuration
 * 6. Creates driver instance
 * 7. Executes callback with driver and merged options
 * 8. Ensures cleanup (closes transport)
 *
 * @param options - Combined transport and driver options
 * @param fn - Function to execute with the driver (and optionally merged config)
 * @returns Result of the function
 * @throws ValidationError if user options or driver defaults violate constraints
 */
export async function withDriver<T>(
  options: TransportOptions & { driver?: string; device?: string },
  fn: (driver: DeviceDriver, mergedOptions: TransportOptions) => Promise<T>
): Promise<T> {
  // Load driver metadata first
  const driverMetadata = await loadDriverMetadata(options.driver)

  // Apply driver defaults to options (currently a pass-through)
  const mergedOptions = applyDriverDefaults(options, driverMetadata)

  // Create transport with merged options
  return await withTransport(mergedOptions, async (transport) => {
    // Create driver instance
    return await withDriverInstance(
      transport,
      driverMetadata,
      mergedOptions.slaveId,
      options.device,
      async (driver) => {
        // Execute callback with driver and merged options
        return await fn(driver, mergedOptions)
      }
    )
  })
}
