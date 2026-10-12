/**
 * YAML output formatter for device profiler
 */

import yaml from 'js-yaml'

import type { ScanResult } from './register-scanner.js'
import { buildReport, type ReportOptions } from './report.js'

/**
 * Options for YAML formatter
 */
export type YAMLFormatterOptions = ReportOptions

/**
 * Format scan results as YAML
 *
 * The document has the same data as the JSON output.
 *
 * @param results - Array of scan results
 * @param options - Scan configuration metadata
 * @returns Formatted YAML string with 2-space indentation and no trailing newline
 */
export function formatYAML(
  results: ReadonlyArray<ScanResult>,
  options: YAMLFormatterOptions
): string {
  // lineWidth -1 keeps long error messages on one line
  return yaml.dump(buildReport(results, options), { lineWidth: -1 }).trimEnd()
}
