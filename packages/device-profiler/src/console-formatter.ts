/**
 * Console output formatting for register scanning
 */

import Table from 'cli-table3'

import type { ScanResult } from './register-scanner.js'

function formatError(error: unknown): string {
  if (error == null) return '-'
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error) return String(error.message)
  try {
    return JSON.stringify(error)
  } catch {
    // Fallback for circular references or BigInt - return type name
    return `[${typeof error}]`
  }
}

/**
 * Format progress message
 *
 * @param current - Current count
 * @param total - Total count
 * @returns Formatted progress string
 */
export function formatProgress(current: number, total: number): string {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0
  return `Progress: ${current}/${total} (${percentage}%)`
}

/**
 * Format summary table of scan results
 *
 * @param results - Scan results
 * @returns Formatted table string
 */
export function formatSummary(results: ScanResult[]): string {
  const table = new Table({
    head: ['Address', 'Type', 'Status', 'Value', 'Timing (ms)', 'Error'],
    style: { head: [] },
  })

  for (const result of results) {
    const value = result.success && result.value ? result.value.toString('hex').toUpperCase() : '-'

    const status = result.success ? 'OK' : 'FAIL'
    const error = formatError(result.error)
    const timing = result.timing.toFixed(1)

    table.push([result.address.toString(), result.type, status, value, timing, error])
  }

  return table.toString()
}
