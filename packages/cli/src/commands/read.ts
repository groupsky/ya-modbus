import { formatJSON } from '../formatters/json.js'
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

  // Common options
  slaveId: number
  timeout?: number

  // Driver options
  driver?: string

  // Data point selection
  dataPoint?: string[]
  all?: boolean

  // Output options
  format: 'table' | 'json'
}

/**
 * Read command implementation
 *
 * @param options - Command options
 */
export async function readCommand(options: ReadOptions): Promise<void> {
  const startTime = performance.now()

  await withDriver(options, async (driver, mergedOptions) => {
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

    if (dataPointIds.length === 1) {
      // Single data point - use readDataPoint
      const dataPointId = dataPointIds[0] as string // length === 1, so [0] is guaranteed to exist
      const value = await driver.readDataPoint(dataPointId)
      values = { [dataPointId]: value }
    } else {
      // Multiple data points - use batch read
      values = await driver.readDataPoints(dataPointIds)
    }

    // Calculate performance metrics
    const endTime = performance.now()
    const metrics: PerformanceMetrics = {
      responseTimeMs: endTime - startTime,
      operations: dataPointIds.length,
      errors: 0, // Errors cause exceptions, so this is always 0 for successful reads
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
            : mergedOptions.port && typeof mergedOptions.port === 'string'
              ? { port: mergedOptions.port, slaveId: mergedOptions.slaveId }
              : undefined,
          performance: metrics,
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
  })
}
