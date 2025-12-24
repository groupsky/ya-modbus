import readline from 'readline/promises'

import type { DataPoint, DeviceDriver, Transport } from '@ya-modbus/driver-types'

import { loadDriver } from '../driver-loader/loader.js'
import { createTransport, type TransportConfig } from '../transport/factory.js'

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
        port: typeof options.port === 'number' ? options.port : 502,
        slaveId: options.slaveId,
        timeout: options.timeout,
      }
    : {
        // RTU configuration
        port: (options.port as string | undefined) ?? '/dev/ttyUSB0',
        baudRate: (options.baudRate ?? 9600) as 9600,
        dataBits: (options.dataBits ?? 8) as 8,
        parity: (options.parity ?? 'even') as 'even',
        stopBits: (options.stopBits ?? 1) as 1,
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
