import type { DataPoint } from '@ya-modbus/driver-types'

import type { PerformanceMetrics } from './performance.js'

/**
 * A data point that could not be read
 */
export interface DataPointError {
  id: string
  error: string
}

/**
 * Metadata for JSON output
 */
export interface JSONMetadata {
  /** Data points that failed to read (listed as `errors`, empty when none) */
  errors?: ReadonlyArray<DataPointError> | undefined
  /** Driver package name */
  driver?: string | undefined
  /** Connection details */
  connection?:
    | {
        port?: string | undefined
        host?: string | undefined
        slaveId?: number | undefined
      }
    | undefined
  /** Performance metrics */
  performance?:
    | (PerformanceMetrics & {
        /** Data points that failed to read */
        errors?: number
        /** @deprecated Same as `dataPoints`; kept for one release */
        operations?: number
      })
    | undefined
}

/**
 * Format data point results as JSON
 *
 * @param dataPoints - Data point definitions
 * @param values - Data point values (keyed by ID)
 * @param metadata - Additional metadata to include
 * @returns Formatted JSON string with 2-space indentation
 */
export function formatJSON(
  dataPoints: ReadonlyArray<DataPoint>,
  values: Record<string, unknown>,
  metadata: JSONMetadata
): string {
  // Build data points array with values
  const dataPointsWithValues = dataPoints
    .filter((dp) => dp.id in values)
    .map((dp) => ({
      id: dp.id,
      name: dp.name,
      value: values[dp.id],
      type: dp.type,
      unit: dp.unit,
      access: dp.access,
      pollType: dp.pollType,
    }))

  // Build output object
  const output = {
    timestamp: new Date().toISOString(),
    ...(metadata.driver && { driver: metadata.driver }),
    ...(metadata.connection && { connection: metadata.connection }),
    dataPoints: dataPointsWithValues,
    errors: metadata.errors ?? [],
    ...(metadata.performance && { performance: metadata.performance }),
  }

  // Return pretty-printed JSON with 2-space indentation
  return JSON.stringify(output, null, 2)
}
