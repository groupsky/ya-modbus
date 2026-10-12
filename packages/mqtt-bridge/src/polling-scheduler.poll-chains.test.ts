import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
import type { DeviceDriver } from '@ya-modbus/driver-types'

import { PollingScheduler } from './polling-scheduler.js'
import type { DeviceConfig } from './types.js'

/**
 * A device must have at most one poll chain at any time. A second chain reads the device
 * twice per interval, which doubles the traffic on a shared RS-485 bus.
 */
describe('PollingScheduler poll chains', () => {
  const INTERVAL = 100

  let scheduler: PollingScheduler
  let readDataPoints: jest.Mock<DeviceDriver['readDataPoints']>
  let finishReads: Array<(data: Record<string, unknown>) => void>

  const config: DeviceConfig = {
    deviceId: 'device1',
    driver: 'test-driver',
    connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
    polling: { interval: INTERVAL },
  }

  const createDriver = (): DeviceDriver => ({
    name: 'test',
    manufacturer: 'Test',
    model: 'TEST-001',
    dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
    readDataPoint: jest.fn(),
    writeDataPoint: jest.fn(),
    readDataPoints,
  })

  beforeEach(() => {
    jest.useFakeTimers()
    scheduler = new PollingScheduler(jest.fn(), jest.fn())
    finishReads = []
    // Reads stay pending until the test finishes them, so a read can be in flight
    readDataPoints = jest.fn<DeviceDriver['readDataPoints']>().mockImplementation(
      () =>
        new Promise((resolve) => {
          finishReads.push(resolve)
        })
    )
  })

  afterEach(() => {
    scheduler.stop()
    jest.useRealTimers()
  })

  // Finish the oldest read that is still pending
  const finishRead = async (): Promise<void> => {
    finishReads.shift()?.({ temp: 25.5 })
    await jest.advanceTimersByTimeAsync(0)
  }

  describe('start', () => {
    it('should not add a poll chain when called again, as on every MQTT reconnect', async () => {
      scheduler.scheduleDevice('device1', config, createDriver())

      scheduler.start()
      scheduler.start()
      scheduler.start()
      expect(jest.getTimerCount()).toBe(1)

      await jest.advanceTimersByTimeAsync(INTERVAL)
      await finishRead()
      expect(readDataPoints).toHaveBeenCalledTimes(1)

      await jest.advanceTimersByTimeAsync(INTERVAL)
      await finishRead()
      expect(readDataPoints).toHaveBeenCalledTimes(2)
    })

    it('should keep the pending poll when called again before it fires', async () => {
      scheduler.scheduleDevice('device1', config, createDriver())
      scheduler.start()

      await jest.advanceTimersByTimeAsync(INTERVAL - 1)
      scheduler.start()

      // The first start() set the timer, so the poll is not pushed back by the second one
      await jest.advanceTimersByTimeAsync(1)
      expect(readDataPoints).toHaveBeenCalledTimes(1)
    })

    it('should add no poll chain when called again while a read is in flight', async () => {
      scheduler.scheduleDevice('device1', config, createDriver())
      scheduler.start()

      await jest.advanceTimersByTimeAsync(INTERVAL)
      expect(readDataPoints).toHaveBeenCalledTimes(1)

      scheduler.start()
      expect(jest.getTimerCount()).toBe(0)

      await finishRead()
      expect(jest.getTimerCount()).toBe(1)
    })
  })

  describe('stop and start during a read', () => {
    it('should continue with one poll chain after the read finishes', async () => {
      scheduler.scheduleDevice('device1', config, createDriver())
      scheduler.start()

      // The first read is in flight when the scheduler restarts
      await jest.advanceTimersByTimeAsync(INTERVAL)
      expect(readDataPoints).toHaveBeenCalledTimes(1)
      scheduler.stop()
      scheduler.start()
      await finishRead()

      // One read per interval, not two
      await jest.advanceTimersByTimeAsync(INTERVAL)
      await finishRead()
      expect(readDataPoints).toHaveBeenCalledTimes(2)

      await jest.advanceTimersByTimeAsync(INTERVAL)
      await finishRead()
      expect(readDataPoints).toHaveBeenCalledTimes(3)
    })

    it('should not start a second read while the first one is still in flight', async () => {
      scheduler.scheduleDevice('device1', config, createDriver())
      scheduler.start()

      await jest.advanceTimersByTimeAsync(INTERVAL)
      scheduler.stop()
      scheduler.start()

      await jest.advanceTimersByTimeAsync(INTERVAL * 5)
      expect(readDataPoints).toHaveBeenCalledTimes(1)
    })

    it('should leave no timer behind when the device is unscheduled afterwards', async () => {
      scheduler.scheduleDevice('device1', config, createDriver())
      scheduler.start()

      await jest.advanceTimersByTimeAsync(INTERVAL)
      scheduler.stop()
      scheduler.start()
      await finishRead()

      scheduler.unscheduleDevice('device1')
      expect(jest.getTimerCount()).toBe(0)

      await jest.advanceTimersByTimeAsync(INTERVAL * 2)
      expect(readDataPoints).toHaveBeenCalledTimes(1)
    })

    it('should not schedule a poll when the read finishes while stopped', async () => {
      scheduler.scheduleDevice('device1', config, createDriver())
      scheduler.start()

      await jest.advanceTimersByTimeAsync(INTERVAL)
      scheduler.stop()
      await finishRead()

      expect(jest.getTimerCount()).toBe(0)
      await jest.advanceTimersByTimeAsync(INTERVAL * 2)
      expect(readDataPoints).toHaveBeenCalledTimes(1)
    })

    it('should poll again when started after the read finished while stopped', async () => {
      scheduler.scheduleDevice('device1', config, createDriver())
      scheduler.start()

      await jest.advanceTimersByTimeAsync(INTERVAL)
      scheduler.stop()
      await finishRead()

      scheduler.start()
      expect(jest.getTimerCount()).toBe(1)

      await jest.advanceTimersByTimeAsync(INTERVAL)
      expect(readDataPoints).toHaveBeenCalledTimes(2)
    })
  })

  it('should replace the pending poll of a device scheduled twice', async () => {
    scheduler.scheduleDevice('device1', config, createDriver())
    scheduler.start()
    scheduler.scheduleDevice('device1', config, createDriver())
    expect(jest.getTimerCount()).toBe(1)

    await jest.advanceTimersByTimeAsync(INTERVAL)
    await finishRead()
    expect(readDataPoints).toHaveBeenCalledTimes(1)
  })

  it('should not continue the old poll chain when a device is removed and added during a read', async () => {
    scheduler.scheduleDevice('device1', config, createDriver())
    scheduler.start()

    // The read of the removed device is still in flight when the same id is added again
    await jest.advanceTimersByTimeAsync(INTERVAL)
    scheduler.unscheduleDevice('device1')
    scheduler.scheduleDevice('device1', config, createDriver())
    await finishRead()

    await jest.advanceTimersByTimeAsync(INTERVAL)
    await finishRead()
    expect(readDataPoints).toHaveBeenCalledTimes(2)

    await jest.advanceTimersByTimeAsync(INTERVAL)
    await finishRead()
    expect(readDataPoints).toHaveBeenCalledTimes(3)
  })
})
