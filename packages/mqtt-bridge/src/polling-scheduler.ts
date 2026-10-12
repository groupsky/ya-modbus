import type { DeviceDriver } from '@ya-modbus/driver-types'

import type { DeviceConfig } from './types.js'

interface ScheduledDevice {
  config: DeviceConfig
  driver: DeviceDriver
  timer?: NodeJS.Timeout | undefined
  interval: number
  dataPointIds: string[]
  lastFailureCount: number
}

type DataCallback = (deviceId: string, data: Record<string, unknown>) => void
type ErrorCallback = (deviceId: string, error: Error, failureCount: number) => void

const DEFAULT_POLLING_INTERVAL = 5000 // 5 seconds

// Longest delay setTimeout supports; it runs longer delays after 1ms
const MAX_TIMER_DELAY = 2 ** 31 - 1

/**
 * Coordinates polling across multiple devices
 */
export class PollingScheduler {
  private devices = new Map<string, ScheduledDevice>()
  private running = false

  constructor(
    private onData: DataCallback,
    private onError: ErrorCallback
  ) {}

  /**
   * Schedule a device for polling
   */
  scheduleDevice(deviceId: string, config: DeviceConfig, driver: DeviceDriver): void {
    const interval = config.polling?.interval ?? DEFAULT_POLLING_INTERVAL

    // Written as a negation so that NaN is rejected too
    if (!(interval > 0 && interval <= MAX_TIMER_DELAY)) {
      throw new Error(`Invalid polling interval for device ${deviceId}: ${interval}`)
    }

    this.devices.set(deviceId, {
      config,
      driver,
      dataPointIds: driver.dataPoints.map((dp) => dp.id),
      interval,
      lastFailureCount: 0,
    })

    if (this.running) {
      this.startDevicePolling(deviceId)
    }
  }

  /**
   * Stop polling a device and remove it from the schedule
   */
  unscheduleDevice(deviceId: string): void {
    const device = this.devices.get(deviceId)
    if (device?.timer) {
      clearTimeout(device.timer)
    }
    this.devices.delete(deviceId)
  }

  /**
   * Start polling all scheduled devices
   */
  start(): void {
    this.running = true

    for (const deviceId of this.devices.keys()) {
      this.startDevicePolling(deviceId)
    }
  }

  /**
   * Stop polling all devices
   */
  stop(): void {
    this.running = false

    for (const device of this.devices.values()) {
      if (device.timer) {
        clearTimeout(device.timer)
        device.timer = undefined
      }
    }
  }

  /**
   * Check if a device is scheduled for polling
   */
  isScheduled(deviceId: string): boolean {
    return this.devices.has(deviceId)
  }

  /**
   * Start polling for a specific device
   */
  private startDevicePolling(deviceId: string): void {
    const device = this.devices.get(deviceId)
    if (!device) return

    // Schedule first poll after the interval
    this.scheduleNextPoll(deviceId)
  }

  /**
   * Schedule the next poll for a device, with backoff if needed
   */
  private scheduleNextPoll(deviceId: string): void {
    const device = this.devices.get(deviceId)
    if (!device || !this.running) return

    const maxRetries = device.config.polling?.maxRetries ?? 3
    const retryBackoff = device.config.polling?.retryBackoff ?? device.interval * 2
    const mode = device.config.polling?.mode ?? 'interval'

    // Determine delay based on mode and failure count
    let delay: number
    if (device.lastFailureCount > 0 && device.lastFailureCount >= maxRetries) {
      // Use backoff once maxRetries failures happened in a row. It takes at least one failure,
      // so maxRetries 0 backs off after the first failure and not after a successful read.
      delay = retryBackoff
    } else if (mode === 'continuous' && device.lastFailureCount === 0) {
      // Continuous mode: poll on next event loop tick (effectively immediate)
      delay = 1
    } else {
      // Interval mode, or retry after a failed read: wait for specified interval
      // so a failing device does not flood a shared bus
      delay = device.interval
    }

    device.timer = setTimeout(() => {
      // Look the device up again: it can be removed while a timer is still pending
      const currentDevice = this.devices.get(deviceId)
      if (!currentDevice || !this.running) return

      void this.pollDevice(deviceId, currentDevice)
    }, delay)
  }

  /**
   * Poll a device once
   */
  private async pollDevice(deviceId: string, device: ScheduledDevice): Promise<void> {
    try {
      const data = await device.driver.readDataPoints(device.dataPointIds)

      // Reset failure count BEFORE callback - polling succeeded regardless of callback result
      device.lastFailureCount = 0

      try {
        this.onData(deviceId, data)
      } catch (callbackError) {
        // Data callback threw - log but don't count as polling failure
        console.error(
          `Error in data callback for device ${deviceId}:`,
          callbackError instanceof Error ? callbackError : new Error(String(callbackError))
        )
      }
    } catch (error) {
      // Increment failure count - scheduler owns this state
      device.lastFailureCount++

      try {
        this.onError(
          deviceId,
          error instanceof Error ? error : new Error(String(error)),
          device.lastFailureCount
        )
      } catch (callbackError) {
        // Error callback threw - log but state already updated
        console.error(
          `Error in error callback for device ${deviceId}:`,
          callbackError instanceof Error ? callbackError : new Error(String(callbackError))
        )
      }
    }

    this.scheduleNextPoll(deviceId)
  }
}
