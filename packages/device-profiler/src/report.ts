/**
 * Scan report shared by the machine-readable output formats
 */

import type { RegisterType } from './read-tester.js'
import type { ScanResult } from './register-scanner.js'

/**
 * Scan configuration and connection details stored in a report
 */
export interface ReportOptions {
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
 * Build the report of a scan: metadata, one entry per register and summary statistics
 *
 * @param results - Array of scan results
 * @param options - Scan configuration metadata
 * @returns Plain object that serializes to JSON or YAML
 */
export function buildReport(results: ReadonlyArray<ScanResult>, options: ReportOptions): object {
  // Calculate summary statistics
  const successful = results.filter((r) => r.success).length
  const failed = results.length - successful
  const totalTimeMs = results.reduce((sum, r) => sum + r.timing, 0)
  const averageTimeMs =
    results.length > 0 ? Math.round((totalTimeMs / results.length) * 100) / 100 : 0

  return {
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
      value: result.value ? result.value.readUInt16BE(0) : null,
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
}
