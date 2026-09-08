import type { DeviceDriver } from '@ya-modbus/driver-types'

import type { DeviceConfig } from './types.js'

interface ScheduledDevice {
  config: DeviceConfig
  driver: DeviceDriver
  timer?: NodeJS.Timeout
  interval: number
  lastFailureCount: number
}

type DataCallback = (deviceId: string, data: Record<string, unknown>) => void
type ErrorCallback = (deviceId: string, error: Error, failureCount: number) => void

const DEFAULT_POLLING_INTERVAL = 5000 // 5 seconds

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

    this.devices.set(deviceId, {
      config,
      driver,
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
        delete device.timer
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
    if (device.lastFailureCount >= maxRetries) {
      // Use backoff if we've exceeded max retries
      delay = retryBackoff
    } else if (mode === 'continuous') {
      // Continuous mode: poll on next event loop tick (effectively immediate)
      delay = 1
    } else {
      // Interval mode: wait for specified interval
      delay = device.interval
    }

    device.timer = setTimeout(() => {
      const currentDevice = this.devices.get(deviceId)
      if (!currentDevice || !this.running) return

      void this.pollDevice(deviceId)
    }, delay)
  }

  /**
   * Poll a device once
   */
  private async pollDevice(deviceId: string): Promise<void> {
    const device = this.devices.get(deviceId)
    if (!device || !this.running) return

    try {
      const dataPointIds = device.driver.dataPoints.map((dp) => dp.id)
      const data = await device.driver.readDataPoints(dataPointIds)

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
