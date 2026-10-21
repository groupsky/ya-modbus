import type { DeviceDriver } from '@ya-modbus/driver-types'

import { checkWrites, WriteError } from './device-writes.js'
import type { DeviceConfig, DeviceConnection } from './types.js'

interface ScheduledDevice {
  config: DeviceConfig
  driver: DeviceDriver
  // Devices with the same key share a bus, and are polled and written one at a time
  connectionKey: string
  // Pending timer of the poll chain, undefined while a read is in flight or polling is stopped
  timer?: NodeJS.Timeout | undefined
  // True from the start of a read until its poll chain continues or ends
  readInFlight: boolean
  interval: number
  retryBackoff: number
  maxRetryBackoff: number
  // Read on every poll: readable points with pollType 'dynamic' (the default)
  dynamicIds: string[]
  // Read until one read works, then sent from staticValues in every data message
  staticIds: string[]
  staticValues?: Record<string, unknown> | undefined
  lastFailureCount: number
}

type DataCallback = (deviceId: string, data: Record<string, unknown>) => void
type ErrorCallback = (deviceId: string, error: Error, failureCount: number) => void

/** Failed reads in a row before polling slows down to `retryBackoff` */
export const DEFAULT_MAX_RETRIES = 3
const DEFAULT_POLLING_INTERVAL = 5000 // 5 seconds
/** Longest wait between polls of a failing device, unless `retryBackoff` is longer */
const DEFAULT_MAX_RETRY_BACKOFF = 60000

// Longest delay setTimeout supports; it runs longer delays after 1ms
const MAX_TIMER_DELAY = 2 ** 31 - 1

// NaN compares false with everything, so it is rejected too
const isValidTimerDelay = (ms: number): boolean => ms > 0 && ms <= MAX_TIMER_DELAY

// The serial port, or the TCP host and port. Other serial settings do not make another bus.
const connectionKey = (connection: DeviceConnection): string =>
  connection.type === 'rtu'
    ? `rtu:${connection.port}`
    : `tcp:${connection.host}:${connection.port ?? 502}`

/**
 * Coordinates polling across multiple devices
 */
export class PollingScheduler {
  private devices = new Map<string, ScheduledDevice>()
  private running = false
  // Per connection: settles when the last poll or write that waits for its turn has ended
  private lastPolls = new Map<string, Promise<unknown>>()

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

    const maxRetryBackoff =
      config.polling?.maxRetryBackoff ?? Math.max(DEFAULT_MAX_RETRY_BACKOFF, retryBackoff)
    if (!isValidTimerDelay(maxRetryBackoff)) {
      throw new Error(`Invalid max retry backoff for device ${deviceId}: ${maxRetryBackoff}`)
    }
    if (maxRetryBackoff < retryBackoff) {
      throw new Error(
        `Invalid max retry backoff for device ${deviceId}: ${maxRetryBackoff} is below the retry backoff ${retryBackoff}`
      )
    }

    // A device scheduled again must not keep the timer of its previous schedule
    this.unscheduleDevice(deviceId)

    // Write-only and on-demand points are never polled
    const polled = driver.dataPoints.filter(
      (dp) => dp.access !== 'w' && dp.pollType !== 'on-demand'
    )

    this.devices.set(deviceId, {
      config,
      driver,
      connectionKey: connectionKey(config.connection),
      dynamicIds: polled.filter((dp) => dp.pollType !== 'static').map((dp) => dp.id),
      staticIds: polled.filter((dp) => dp.pollType === 'static').map((dp) => dp.id),
      interval,
      retryBackoff,
      maxRetryBackoff,
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
   * Write data points of a device in the order of `values`, then read the device at once and
   * pass the data to onData. The write takes its turn on the connection like a poll, so it never
   * runs in the middle of another poll or write.
   *
   * Nothing is written when the device does not allow writes, or a point does not exist or is
   * read-only. A driver error stops the writes: the points before it are written, the points after
   * it are not, and the device is still read. The error names the point and why. After a driver
   * error it is a WriteError that lists the written points.
   *
   * A failed read after the writes is left to the next poll and is not a failed poll.
   */
  async writeDevice(deviceId: string, values: Record<string, unknown>): Promise<void> {
    const device = this.devices.get(deviceId)
    if (!device) {
      throw new Error(`Device ${deviceId} is not polled`)
    }
    checkWrites(device.config, device.driver.dataPoints, values)

    await this.inTurn(device.connectionKey, async () => {
      // The device can be unscheduled, or polling stopped, while the write waits for its turn
      if (!this.running || this.devices.get(deviceId) !== device) {
        throw new Error(`Device ${deviceId} is not polled`)
      }

      const written: string[] = []
      try {
        for (const [id, value] of Object.entries(values)) {
          try {
            await device.driver.writeDataPoint(id, value)
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            throw new WriteError(`Failed to write data point ${id}: ${reason}`, written, {
              cause: error,
            })
          }
          written.push(id)
        }
      } finally {
        try {
          const data = await this.readDevice(deviceId, device)
          device.lastFailureCount = 0
          this.onData(deviceId, data)
        } catch (error) {
          console.warn(
            `Failed to read device ${deviceId} after a write, the next poll reads it: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }
    })
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
      // Slow mode, once maxRetries failures happened in a row. It takes at least one failure,
      // so maxRetries 0 backs off after the first failure and not after a successful read.
      // Every further failure doubles the wait, up to maxRetryBackoff.
      const slowFailures = device.lastFailureCount - Math.max(maxRetries, 1)
      delay = Math.min(device.retryBackoff * 2 ** slowFailures, device.maxRetryBackoff)
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
   * Read the static points of a device. A failed read is not a poll failure: the dynamic data
   * is still published, and the next poll tries the static points again.
   */
  private async readStaticPoints(deviceId: string, device: ScheduledDevice): Promise<void> {
    try {
      device.staticValues = await device.driver.readDataPoints(device.staticIds)
    } catch (error) {
      console.warn(
        `Failed to read static data points of device ${deviceId} (${device.staticIds.join(', ')}), trying again on the next poll:`,
        error
      )
    }
  }

  /**
   * Run the polls and writes of the devices on one connection one at a time, in the order they
   * come. A device that polls again waits behind the devices that are waiting already, so every
   * device gets its turn, also in continuous mode.
   */
  private inTurn<T>(key: string, poll: () => Promise<T>): Promise<T> {
    const previous = this.lastPolls.get(key)
    // A poll on a free connection starts at once
    const result = previous ? previous.then(poll) : poll()
    const last = result.catch(() => undefined)
    this.lastPolls.set(key, last)
    void last.then(() => {
      if (this.lastPolls.get(key) === last) this.lastPolls.delete(key)
    })
    return result
  }

  /**
   * Read the dynamic points of a device, and its static points until one read of them works
   */
  private async readDevice(
    deviceId: string,
    device: ScheduledDevice
  ): Promise<Record<string, unknown>> {
    const data =
      device.dynamicIds.length > 0 ? await device.driver.readDataPoints(device.dynamicIds) : {}

    // Only after a dynamic read worked, so a device that does not answer costs one timeout
    if (device.staticIds.length > 0 && !device.staticValues) {
      await this.readStaticPoints(deviceId, device)
    }

    return { ...device.staticValues, ...data }
  }

  /**
   * Poll a device once
   */
  private async pollDevice(deviceId: string, device: ScheduledDevice): Promise<void> {
    device.readInFlight = true

    try {
      // The whole poll of a device runs before the poll of the next device on its connection.
      // When the device is unscheduled or polling stops while the poll waits for its turn, the
      // device is not read.
      const data = await this.inTurn(device.connectionKey, async () =>
        this.running && this.devices.get(deviceId) === device
          ? this.readDevice(deviceId, device)
          : undefined
      )
      if (data === undefined) {
        device.readInFlight = false
        return
      }

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
