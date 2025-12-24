import readline from 'readline/promises'

import type { DataPoint } from '@ya-modbus/driver-types'
import chalk from 'chalk'

import { isWritable, withDriver, withTransport } from './utils.js'

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
function floatsEqual(
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
function validateValue(value: unknown, dataPoint: DataPoint): void {
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
  await withTransport(options, async (transport) => {
    await withDriver(transport, options, async (driver) => {
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
        const access = dataPoint.access ?? 'r'
        const isReadable = access === 'r' || access === 'rw'

        if (isReadable) {
          try {
            const currentValue = await driver.readDataPoint(options.dataPoint)
            console.log(chalk.cyan(`Current value: ${String(currentValue)}`))
          } catch {
            console.log(chalk.yellow('Could not read current value'))
          }
        }

        console.log(chalk.cyan(`New value: ${String(parsedValue)}`))

        const confirmed = await confirm(
          chalk.bold(`Write ${String(parsedValue)} to ${options.dataPoint}?`)
        )

        if (!confirmed) {
          console.log('Write aborted')
          return
        }
      }

      // Write value
      await driver.writeDataPoint(options.dataPoint, parsedValue)

      console.log(chalk.green(`Successfully wrote ${String(parsedValue)} to ${options.dataPoint}`))

      // Verify if requested
      if (options.verify) {
        const access = dataPoint.access ?? 'r'
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
              ? floatsEqual(readValue as number, parsedValue as number)
              : readValue === parsedValue

          if (match) {
            console.log(chalk.green(`Verification: OK (read back ${String(readValue)})`))
          } else {
            console.log(
              chalk.red(
                `Verification: MISMATCH (expected ${String(parsedValue)}, got ${String(readValue)})`
              )
            )
          }
        } catch (error) {
          console.log(chalk.red(`Verification failed: ${(error as Error).message}`))
        }
      }
    })
  })
}
