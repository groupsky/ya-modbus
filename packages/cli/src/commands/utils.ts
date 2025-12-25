import readline from 'readline/promises'

import type { DataPoint, DeviceDriver, Transport } from '@ya-modbus/driver-types'

import { loadDriver } from '../driver-loader/loader.js'
import { createTransport, type TransportConfig } from '../transport/factory.js'

/**
 * Default RTU transport configuration values
 */
export const DEFAULT_RTU_CONFIG = {
  port: '/dev/ttyUSB0',
  baudRate: 9600 as const,
  dataBits: 8 as const,
  parity: 'even' as const,
  stopBits: 1 as const,
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
        baudRate: (options.baudRate ?? DEFAULT_RTU_CONFIG.baudRate) as 9600,
        dataBits: (options.dataBits ?? DEFAULT_RTU_CONFIG.dataBits) as 8,
        parity: (options.parity ?? DEFAULT_RTU_CONFIG.parity) as 'even',
        stopBits: (options.stopBits ?? DEFAULT_RTU_CONFIG.stopBits) as 1,
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
 * Execute a function with a driver instance, ensuring cleanup
 *
 * @param transport - Transport to use for driver communication
 * @param options - Driver loading options
 * @param fn - Function to execute with the driver
 * @returns Result of the function
 */
export async function withDriver<T>(
  transport: Transport,
  options: DriverOptions,
  fn: (driver: DeviceDriver) => Promise<T>
): Promise<T> {
  // Load driver
  const createDriver = await loadDriver(
    options.driver ? { driverPackage: options.driver } : { localPackage: true }
  )

  // Create driver instance
  const driver = await createDriver({
    transport,
    slaveId: options.slaveId,
  })

  return await fn(driver)
}
