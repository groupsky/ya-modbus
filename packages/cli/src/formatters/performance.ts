import chalk from 'chalk'

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Total response time in milliseconds */
  responseTimeMs: number
  /** Number of operations performed */
  operations: number
  /** Number of errors encountered */
  errors: number
}

/**
 * Format performance metrics for display
 *
 * @param metrics - Performance metrics
 * @returns Formatted string with performance info
 */
export function formatPerformance(metrics: PerformanceMetrics): string {
  const { responseTimeMs, operations, errors } = metrics

  const lines = [
    chalk.bold('\nPerformance:'),
    `  Response time: ${responseTimeMs.toFixed(1)}ms`,
    `  Operations: ${operations}`,
  ]

  // Highlight errors if present
  if (errors > 0) {
    lines.push(chalk.red(`  Errors: ${errors}`))
  } else {
    lines.push(chalk.green(`  Errors: ${errors}`))
  }

  return lines.join('\n')
}
