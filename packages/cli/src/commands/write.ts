import type { DataPoint } from '@ya-modbus/driver-types'
import { createTransport, type TransportConfig } from '../transport/factory.js'
import { loadDriver } from '../driver-loader/loader.js'
import chalk from 'chalk'
import readline from 'readline/promises'

/**
 * Write command options
 */
export interface WriteOptions {
  // Connection options (RTU)
  port?: string
  baudRate?: number
  dataBits?: number
  parity?: string
  stopBits?: number

  // Connection options (TCP)
  host?: string

  // Common options
  slaveId: number
  timeout?: number

  // Driver options
  driver?: string

  // Write options
  dataPoint: string
  value: string
  yes?: boolean
  verify?: boolean
}

/**
 * Check if a data point is writable
 */
function isWritable(dataPoint: DataPoint): boolean {
  const access = dataPoint.access || 'r'
  return access === 'w' || access === 'rw'
}

/**
 * Parse value string based on data point type
 */
function parseValue(valueStr: string, dataPoint: DataPoint): unknown {
  switch (dataPoint.type) {
    case 'float':
      return parseFloat(valueStr)

    case 'integer':
      return parseInt(valueStr, 10)

    case 'boolean':
      return valueStr.toLowerCase() === 'true' || valueStr === '1'

    case 'string':
      return valueStr

    case 'enum':
      // Try to parse as number first, otherwise use string
      const num = parseInt(valueStr, 10)
      return isNaN(num) ? valueStr : num

    default:
      return valueStr
  }
}

/**
 * Validate value against data point constraints
 */
function validateValue(value: unknown, dataPoint: DataPoint): void {
  // Check min/max for numeric types
  if (
    (dataPoint.type === 'float' || dataPoint.type === 'integer') &&
    typeof value === 'number'
  ) {
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
      throw new Error(
        `Invalid enum value: ${value}. Valid values: ${validKeys.join(', ')}`
      )
    }
  }
}

/**
 * Prompt user for confirmation
 */
async function confirm(message: string): Promise<boolean> {
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
 * Write command implementation
 *
 * @param options - Command options
 */
export async function writeCommand(options: WriteOptions): Promise<void> {
  // Build transport configuration
  const transportConfig: TransportConfig = options.host
    ? {
        host: options.host,
        port: (typeof options.port === 'number' ? options.port : 502),
        slaveId: options.slaveId,
        timeout: options.timeout,
      }
    : {
        port: options.port!,
        baudRate: (options.baudRate ?? 9600) as 9600,
        dataBits: (options.dataBits ?? 8) as 8,
        parity: (options.parity ?? 'even') as 'even',
        stopBits: (options.stopBits ?? 1) as 1,
        slaveId: options.slaveId,
        timeout: options.timeout,
      }

  // Create transport
  const transport = await createTransport(transportConfig)

  // Load driver
  const createDriver = await loadDriver(
    options.driver ? { driverPackage: options.driver } : { localPackage: true }
  )

  // Create driver instance
  const driver = await createDriver({
    transport,
    slaveId: options.slaveId,
  })

  // Find data point
  const dataPoint = driver.dataPoints.find((dp) => dp.id === options.dataPoint)

  if (!dataPoint) {
    throw new Error(`Data point not found: ${options.dataPoint}`)
  }

  // Check if writable
  if (!isWritable(dataPoint)) {
    throw new Error(`Data point is read-only: ${options.dataPoint}`)
  }

  // Parse and validate value
  const parsedValue = parseValue(options.value, dataPoint)
  validateValue(parsedValue, dataPoint)

  // Show current value if readable and request confirmation
  if (!options.yes) {
    const access = dataPoint.access || 'r'
    const isReadable = access === 'r' || access === 'rw'

    if (isReadable) {
      try {
        const currentValue = await driver.readDataPoint(options.dataPoint)
        console.log(chalk.cyan(`Current value: ${currentValue}`))
      } catch (error) {
        console.log(chalk.yellow('Could not read current value'))
      }
    }

    console.log(chalk.cyan(`New value: ${parsedValue}`))

    const confirmed = await confirm(
      chalk.bold(`Write ${parsedValue} to ${options.dataPoint}?`)
    )

    if (!confirmed) {
      console.log('Write aborted')
      return
    }
  }

  // Write value
  await driver.writeDataPoint(options.dataPoint, parsedValue)

  console.log(chalk.green(`Successfully wrote ${parsedValue} to ${options.dataPoint}`))

  // Verify if requested
  if (options.verify) {
    const access = dataPoint.access || 'r'
    const isReadable = access === 'r' || access === 'rw'

    if (!isReadable) {
      console.log(chalk.yellow('Cannot verify write-only data point'))
      return
    }

    try {
      const readValue = await driver.readDataPoint(options.dataPoint)

      // Compare values (handle floating point precision)
      const match =
        dataPoint.type === 'float'
          ? Math.abs((readValue as number) - (parsedValue as number)) < 0.01
          : readValue === parsedValue

      if (match) {
        console.log(chalk.green(`Verification: OK (read back ${readValue})`))
      } else {
        console.log(
          chalk.red(
            `Verification: MISMATCH (expected ${parsedValue}, got ${readValue})`
          )
        )
      }
    } catch (error) {
      console.log(chalk.red(`Verification failed: ${(error as Error).message}`))
    }
  }
}
