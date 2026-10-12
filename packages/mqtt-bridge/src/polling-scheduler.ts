import type { DeviceDriver } from '@ya-modbus/driver-types'

import type { DeviceConfig } from './types.js'

interface ScheduledDevice {
  config: DeviceConfig
  driver: DeviceDriver
  // Pending timer of the poll chain, undefined while a read is in flight or polling is stopped
  timer?: NodeJS.Timeout | undefined
  // True from the start of a read until its poll chain continues or ends
  readInFlight: boolean
  interval: number
  retryBackoff: number
  dataPointIds: string[]
  lastFailureCount: number
}

type DataCallback = (deviceId: string, data: Record<string, unknown>) => void
type ErrorCallback = (deviceId: string, error: Error, failureCount: number) => void

/** Failed reads in a row before polling slows down to `retryBackoff` */
export const DEFAULT_MAX_RETRIES = 3
const DEFAULT_POLLING_INTERVAL = 5000 // 5 seconds

// Longest delay setTimeout supports; it runs longer delays after 1ms
const MAX_TIMER_DELAY = 2 ** 31 - 1

// NaN compares false with everything, so it is rejected too
const isValidTimerDelay = (ms: number): boolean => ms > 0 && ms <= MAX_TIMER_DELAY

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

    if (!isValidTimerDelay(interval)) {
      throw new Error(`Invalid polling interval for device ${deviceId}: ${interval}`)
    }

    const retryBackoff = config.polling?.retryBackoff ?? Math.min(interval * 2, MAX_TIMER_DELAY)
    if (!isValidTimerDelay(retryBackoff)) {
      throw new Error(`Invalid retry backoff for device ${deviceId}: ${retryBackoff}`)
    }

    // A device scheduled again must not keep the timer of its previous schedule
    this.unscheduleDevice(deviceId)

    this.devices.set(deviceId, {
      config,
      driver,
      dataPointIds: driver.dataPoints.map((dp) => dp.id),
      interval,
      retryBackoff,
      lastFailureCount: 0,
      readInFlight: false,
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
   * Start polling all scheduled devices. Devices that already have a poll chain are left alone,
   * so it is safe to call this again, for example on every MQTT reconnect.
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

    // A device has one poll chain: a pending timer or a read in flight. A read that was in flight
    // when polling stopped continues the chain when it finishes.
    if (device.timer || device.readInFlight) return

    // Schedule first poll after the interval
    this.scheduleNextPoll(deviceId, device)
  }

  /**
   * Schedule the next poll for a device, with backoff if needed
   */
  private scheduleNextPoll(deviceId: string, device: ScheduledDevice): void {
    if (!this.running) return

    const maxRetries = device.config.polling?.maxRetries ?? DEFAULT_MAX_RETRIES
    const mode = device.config.polling?.mode ?? 'interval'

    // Determine delay based on mode and failure count
    let delay: number
    if (device.lastFailureCount > 0 && device.lastFailureCount >= maxRetries) {
      // Use backoff once maxRetries failures happened in a row. It takes at least one failure,
      // so maxRetries 0 backs off after the first failure and not after a successful read.
      delay = device.retryBackoff
    } else if (mode === 'continuous' && device.lastFailureCount === 0) {
      // Continuous mode: poll on next event loop tick (effectively immediate)
      delay = 1
    } else {
      // Interval mode, or retry after a failed read: wait for specified interval
      // so a failing device does not flood a shared bus
      delay = device.interval
    }

    // stop(), unscheduleDevice() and scheduleDevice() clear the timer, so it only fires for a
    // device that is still scheduled while polling runs
    device.timer = setTimeout(() => {
      device.timer = undefined
      void this.pollDevice(deviceId, device)
    }, delay)
  }

  /**
   * Poll a device once
   */
  private async pollDevice(deviceId: string, device: ScheduledDevice): Promise<void> {
    device.readInFlight = true

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

    device.readInFlight = false

    // The device can be unscheduled during the read, and scheduled again under the same id.
    // Only the device that was polled continues its own chain.
    if (this.devices.get(deviceId) === device) {
      this.scheduleNextPoll(deviceId, device)
    }
  }
}
