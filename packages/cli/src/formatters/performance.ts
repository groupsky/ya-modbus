import chalk from 'chalk'

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /** Total response time in milliseconds */
  responseTimeMs: number
  /** Modbus requests sent (a retried request counts once) */
  requests: number
  /** Extra attempts sent after a failed attempt */
  retries: number
  /** Data points read */
  dataPoints: number
}

/**
 * Format performance metrics for display
 *
 * @param metrics - Performance metrics
 * @returns Formatted string with performance info
 */
export function formatPerformance(metrics: PerformanceMetrics): string {
  const { responseTimeMs, requests, retries, dataPoints } = metrics
  const retriesLine = `  Retries: ${retries}`

  return [
    chalk.bold('\nPerformance:'),
    `  Response time: ${responseTimeMs.toFixed(1)}ms`,
    `  Requests: ${requests}`,
    retries > 0 ? chalk.yellow(retriesLine) : retriesLine,
    `  Data points: ${dataPoints}`,
  ].join('\n')
}
