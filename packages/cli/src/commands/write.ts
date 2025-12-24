import chalk from 'chalk'

import {
  confirm,
  floatsEqual,
  isReadable,
  isWritable,
  parseValue,
  validateValue,
  withDriver,
  withTransport,
} from './utils.js'

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
        if (isReadable(dataPoint)) {
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
        if (!isReadable(dataPoint)) {
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
