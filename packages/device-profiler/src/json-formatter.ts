/**
 * JSON output formatter for device profiler
 */

import type { ScanResult } from './register-scanner.js'
import { buildReport, type ReportOptions } from './report.js'

/**
 * Options for JSON formatter
 */
export type JSONFormatterOptions = ReportOptions

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
  return JSON.stringify(buildReport(results, options), null, 2)
}
