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
