/**
 * Simple progress tracker for discovery operations
 */
export class ProgressTracker {
  private startTime: number
  private lastUpdateTime: number = 0
  private readonly updateIntervalMs: number = 1000 // Update every second

  constructor(private readonly totalCombinations: number) {
    this.startTime = Date.now()
  }

  /**
   * Update progress and return formatted status string
   * Only returns a new string if enough time has passed since last update
   *
   * @param current - Current combination index
   * @param devicesFound - Number of devices found so far
   * @returns Progress string or null if no update needed
   */
  update(current: number, devicesFound: number): string | null {
    const now = Date.now()

    // Throttle updates to avoid excessive console output
    if (now - this.lastUpdateTime < this.updateIntervalMs && current < this.totalCombinations) {
      return null
    }

    this.lastUpdateTime = now

    const percentage = Math.round((current / this.totalCombinations) * 100)
    const elapsed = Math.floor((now - this.startTime) / 1000)

    // Calculate ETA
    let eta = ''
    if (current > 0 && current < this.totalCombinations) {
      const rate = current / elapsed
      const remaining = this.totalCombinations - current
      const etaSeconds = Math.round(remaining / rate)
      eta = ` | ETA: ${this.formatDuration(etaSeconds)}`
    }

    return `Progress: ${percentage}% (${current}/${this.totalCombinations}) | Devices found: ${devicesFound} | Elapsed: ${this.formatDuration(elapsed)}${eta}`
  }

  /**
   * Format duration in seconds to human-readable string
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}s`
    }

    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`
    }

    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }
}
