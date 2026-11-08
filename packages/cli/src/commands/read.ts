import type { DeviceDriver } from '@ya-modbus/driver-types'

import { formatJSON, type DataPointError } from '../formatters/json.js'
import { formatPerformance, type PerformanceMetrics } from '../formatters/performance.js'
import { formatTable } from '../formatters/table.js'
import { isReadable, withDriver } from '../utils/commands.js'

/**
 * Read command options
 */
export interface ReadOptions {
  // Connection options (RTU)
  port?: string
  baudRate?: number
  dataBits?: number
  parity?: string
  stopBits?: number

  // Connection options (TCP)
  host?: string
  tcpPort?: number

  // Common options
  slaveId?: number
  timeout?: number
  attempts?: number
  retryDelay?: number
  verbose?: boolean

  // Driver options
  driver?: string
  device?: string

  // Data point selection
  dataPoint?: string[]
  all?: boolean

  // Output options
  format: 'table' | 'json'
}

/** Single reads that may fail, with no success yet, before giving up */
const MAX_LEADING_FAILURES = 3

/**
 * Read several data points at once. If that fails, read each one on its own
 * so the good values are not lost.
 *
 * @throws The batch error when no single read worked, or the first
 *   MAX_LEADING_FAILURES single reads all failed
 */
async function readMany(
  driver: DeviceDriver,
  ids: string[]
): Promise<{ values: Record<string, unknown>; errors: DataPointError[] }> {
  try {
    return { values: await driver.readDataPoints(ids), errors: [] }
  } catch (batchError) {
    console.error(
      `Reading all data points at once failed (${errorMessage(batchError)}); reading each one on its own`
    )

    const values: Record<string, unknown> = {}
    const errors: DataPointError[] = []
    for (const id of ids) {
      try {
        values[id] = await driver.readDataPoint(id)
      } catch (error) {
        errors.push({ id, error: errorMessage(error) })
        if (errors.length === MAX_LEADING_FAILURES && Object.keys(values).length === 0) {
          throw batchError
        }
      }
    }
    if (errors.length === ids.length) {
      throw batchError
    }
    return { values, errors }
  }
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/**
 * Read command implementation
 *
 * @param options - Command options
 */
export async function readCommand(options: ReadOptions): Promise<void> {
  const startTime = performance.now()

  await withDriver(options, async (driver, mergedOptions, stats) => {
    // Determine which data points to read
    let dataPointIds: string[]

    if (options.all) {
      // Read all readable data points
      dataPointIds = driver.dataPoints.filter(isReadable).map((dp) => dp.id)
    } else if (options.dataPoint && options.dataPoint.length > 0) {
      dataPointIds = options.dataPoint
    } else {
      throw new Error('Either --data-point or --all must be specified')
    }

    // Validate data points exist and are readable (O(N) using Map lookup)
    const dataPointMap = new Map(driver.dataPoints.map((dp) => [dp.id, dp]))
    for (const id of dataPointIds) {
      const dataPoint = dataPointMap.get(id)
      if (!dataPoint) {
        throw new Error(`Data point not found: ${id}`)
      }
      if (!isReadable(dataPoint)) {
        throw new Error(`Data point is write-only: ${id}`)
      }
    }

    // Read data points
    let values: Record<string, unknown>
    let errors: DataPointError[] = []

    if (dataPointIds.length === 1) {
      // Single data point - use readDataPoint
      const dataPointId = dataPointIds[0] as string // length === 1, so [0] is guaranteed to exist
      const value = await driver.readDataPoint(dataPointId)
      values = { [dataPointId]: value }
    } else {
      // Multiple data points - use batch read
      ;({ values, errors } = await readMany(driver, dataPointIds))
    }

    // Calculate performance metrics
    const endTime = performance.now()
    const metrics: PerformanceMetrics = {
      responseTimeMs: endTime - startTime,
      requests: stats.requests,
      retries: stats.retries,
      dataPoints: dataPointIds.length,
    }

    // Format output
    if (options.format === 'json') {
      const output = formatJSON(
        driver.dataPoints.filter((dp) => dp.id in values),
        values,
        {
          driver: options.driver,
          connection: options.host
            ? { host: options.host, slaveId: mergedOptions.slaveId }
            : mergedOptions.port
              ? { port: mergedOptions.port, slaveId: mergedOptions.slaveId }
              : undefined,
          errors,
          performance: {
            ...metrics,
            errors: errors.length,
            operations: metrics.dataPoints,
          },
        }
      )
      console.log(output)
    } else {
      // Table format (default)
      const table = formatTable(
        driver.dataPoints.filter((dp) => dp.id in values),
        values
      )
      console.log(table)
      console.log(formatPerformance(metrics))
    }

    if (errors.length > 0) {
      if (options.format !== 'json') {
        console.error(
          ['Failed data points:', ...errors.map((e) => `  ${e.id}: ${e.error}`)].join('\n')
        )
      }
      process.exitCode = 1
    }
  })
}
