export interface DeviceStatsPayload {
  /** Polls since the device was added */
  polls: number
  /** Failed polls since the device was added */
  errors: number
  consecutiveFailures: number
  /** Time of the last successful poll (ms since epoch), null before the first one */
  lastSuccess: number | null
  /** Average duration of the successful polls since the last report, null when there was none */
  avgReadMs: number | null
  /** Successful polls per second since the last report */
  readsPerSecond: number
}

interface Counters extends DeviceStatsPayload {
  windowStart: number
  windowReads: number
  windowReadMs: number
}

const fresh = (now: number): Counters => ({
  polls: 0,
  errors: 0,
  consecutiveFailures: 0,
  lastSuccess: null,
  avgReadMs: null,
  readsPerSecond: 0,
  windowStart: now,
  windowReads: 0,
  windowReadMs: 0,
})

/** One line for the log, e.g. `Stats of meter1: 12 polls, 1 errors, ...` */
export function formatStatsLine(deviceId: string, stats: DeviceStatsPayload): string {
  const avg = stats.avgReadMs === null ? 'n/a' : `${Math.round(stats.avgReadMs)} ms`
  const last = stats.lastSuccess === null ? 'never' : new Date(stats.lastSuccess).toISOString()
  return (
    `Stats of device ${deviceId}: ${stats.polls} polls, ${stats.errors} errors, ` +
    `${stats.consecutiveFailures} failures in a row, last success ${last}, ` +
    `average read ${avg}, ${Number(stats.readsPerSecond.toFixed(2))} reads/s`
  )
}

/**
 * Poll counters of the devices. `polls`, `errors` and `consecutiveFailures` run from the time a
 * device is added; `avgReadMs` and `readsPerSecond` cover the time since the last report.
 */
export class DeviceStats {
  private devices = new Map<string, Counters>()

  add(deviceId: string, now = Date.now()): void {
    this.devices.set(deviceId, fresh(now))
  }

  remove(deviceId: string): void {
    this.devices.delete(deviceId)
  }

  /** A poll that took `ms` milliseconds. Polls of devices that are not added are ignored. */
  record(deviceId: string, ms: number, ok: boolean, now = Date.now()): void {
    const stats = this.devices.get(deviceId)
    if (!stats) return
    stats.polls++
    if (ok) {
      stats.consecutiveFailures = 0
      stats.lastSuccess = now
      stats.windowReads++
      stats.windowReadMs += ms
    } else {
      stats.errors++
      stats.consecutiveFailures++
    }
  }

  /** The stats of every device; starts a new window for the average and the rate */
  report(now = Date.now()): Map<string, DeviceStatsPayload> {
    const reports = new Map<string, DeviceStatsPayload>()
    for (const [deviceId, stats] of this.devices) {
      const seconds = (now - stats.windowStart) / 1000
      reports.set(deviceId, {
        polls: stats.polls,
        errors: stats.errors,
        consecutiveFailures: stats.consecutiveFailures,
        lastSuccess: stats.lastSuccess,
        avgReadMs: stats.windowReads > 0 ? stats.windowReadMs / stats.windowReads : null,
        readsPerSecond: seconds > 0 ? stats.windowReads / seconds : 0,
      })
      stats.windowStart = now
      stats.windowReads = 0
      stats.windowReadMs = 0
    }
    return reports
  }
}
