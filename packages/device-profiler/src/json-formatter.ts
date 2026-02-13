/**
 * JSON output formatter for device profiler
 */

import type { RegisterType } from './read-tester.js'
import type { ScanResult } from './register-scanner.js'

/**
 * Options for JSON formatter
 */
export interface JSONFormatterOptions {
  /** Register type scanned */
  type: RegisterType
  /** Start address of scan */
  startAddress: number
  /** End address of scan */
  endAddress: number
  /** Batch size used for scanning */
  batchSize: number
  /** Connection port (serial or TCP) */
  port: string
}

/**
 * Format scan results as JSON
 *
 * @param results - Array of scan results
 * @param options - Scan configuration metadata
 * @returns Formatted JSON string with 2-space indentation
 */
export function formatJSON(
  results: ReadonlyArray<ScanResult>,
  options: JSONFormatterOptions
): string {
  // Calculate summary statistics
  const successful = results.filter((r) => r.success).length
  const failed = results.length - successful
  const totalTimeMs = results.reduce((sum, r) => sum + r.timing, 0)
  const averageTimeMs =
    results.length > 0 ? Math.round((totalTimeMs / results.length) * 100) / 100 : 0

  // Build output object
  const output = {
    timestamp: new Date().toISOString(),
    scan: {
      type: options.type,
      startAddress: options.startAddress,
      endAddress: options.endAddress,
      batchSize: options.batchSize,
    },
    connection: {
      port: options.port,
    },
    results: results.map((result) => ({
      address: result.address,
      type: result.type,
      success: result.success,
      value: result.value ? result.value.toString('hex') : null,
      timing: result.timing,
      ...(result.error && { error: result.error }),
      ...(result.errorType && { errorType: result.errorType }),
    })),
    summary: {
      total: results.length,
      successful,
      failed,
      totalTimeMs,
      averageTimeMs,
    },
  }

  return JSON.stringify(output, null, 2)
}
