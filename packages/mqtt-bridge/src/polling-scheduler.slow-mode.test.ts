import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import type { DeviceDriver } from '@ya-modbus/driver-types'

import { PollingScheduler } from './polling-scheduler.js'
import type { DeviceConfig, PollingConfig } from './types.js'

/**
 * A device that keeps failing is polled less often: the wait grows from retryBackoff, doubling
 * with every failed poll, up to maxRetryBackoff.
 */
describe('PollingScheduler slow mode', () => {
  let scheduler: PollingScheduler
  let onData: jest.Mock
  let onError: jest.Mock

  const createDriver = (readDataPoints: DeviceDriver['readDataPoints']): DeviceDriver => ({
    name: 'test',
    manufacturer: 'Test',
    model: 'TEST-001',
    dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: 'C' }],
    readDataPoint: jest.fn(),
    writeDataPoint: jest.fn(),
    readDataPoints,
  })

  const createConfig = (polling: PollingConfig): DeviceConfig => ({
    deviceId: 'device1',
    driver: 'test-driver',
    connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
    polling,
  })

  beforeEach(() => {
    jest.useFakeTimers()
    onData = jest.fn()
    onError = jest.fn()
    scheduler = new PollingScheduler(onData, onError)
  })

  afterEach(() => {
    scheduler.stop()
    jest.useRealTimers()
  })

  /** Start a device that always fails and return the waits between its reads, in ms */
  const failureWaits = async (polling: PollingConfig, reads: number): Promise<number[]> => {
    const readDataPoints = jest
      .fn<DeviceDriver['readDataPoints']>()
      .mockRejectedValue(new Error('x'))
    scheduler.scheduleDevice('device1', createConfig(polling), createDriver(readDataPoints))
    scheduler.start()

    const waits: number[] = []
    for (let i = 0; i < reads; i++) {
      const before = Date.now()
      // Jump from timer to timer to find when the next read starts. Stepping 1 ms at a time
      // takes hundreds of thousands of steps for the long waits and can time out on a busy runner.
      const calls = readDataPoints.mock.calls.length
      while (readDataPoints.mock.calls.length === calls) {
        await jest.advanceTimersToNextTimerAsync()
      }
      waits.push(Date.now() - before)
    }
    return waits
  }

  it('doubles the wait with every failed poll, from retryBackoff up to maxRetryBackoff', async () => {
    const waits = await failureWaits(
      { interval: 100, maxRetries: 2, retryBackoff: 200, maxRetryBackoff: 1000 },
      8
    )

    // first read, then interval after failure 1, then retryBackoff from failure 2 on
    expect(waits).toEqual([100, 100, 200, 400, 800, 1000, 1000, 1000])
  })

  it('doubles the wait in continuous mode too', async () => {
    const waits = await failureWaits(
      { interval: 100, mode: 'continuous', maxRetries: 2, retryBackoff: 200, maxRetryBackoff: 500 },
      6
    )

    // continuous mode starts the first read after 1 ms
    expect(waits).toEqual([1, 100, 200, 400, 500, 500])
  })

  it('treats maxRetries 0 like 1', async () => {
    const waits = await failureWaits(
      { interval: 100, maxRetries: 0, retryBackoff: 200, maxRetryBackoff: 500 },
      5
    )

    expect(waits).toEqual([100, 200, 400, 500, 500])
  })

  it('goes back to the normal interval after a good read', async () => {
    const readDataPoints = jest
      .fn<DeviceDriver['readDataPoints']>()
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValue({ temp: 1 })
    scheduler.scheduleDevice(
      'device1',
      createConfig({ interval: 100, maxRetries: 1, retryBackoff: 200, maxRetryBackoff: 1000 }),
      createDriver(readDataPoints)
    )
    scheduler.start()

    await jest.advanceTimersByTimeAsync(100) // read 1 fails, waits 200
    await jest.advanceTimersByTimeAsync(200) // read 2 fails, waits 400
    await jest.advanceTimersByTimeAsync(400) // read 3 fails, waits 800
    await jest.advanceTimersByTimeAsync(799)
    expect(readDataPoints).toHaveBeenCalledTimes(3)
    await jest.advanceTimersByTimeAsync(1) // read 4 works
    expect(readDataPoints).toHaveBeenCalledTimes(4)
    expect(onData).toHaveBeenCalledTimes(1)

    await jest.advanceTimersByTimeAsync(99)
    expect(readDataPoints).toHaveBeenCalledTimes(4)
    await jest.advanceTimersByTimeAsync(1)
    expect(readDataPoints).toHaveBeenCalledTimes(5)
  })

  describe('maxRetryBackoff default', () => {
    it('is 60 seconds', async () => {
      const waits = await failureWaits({ interval: 10000, maxRetries: 1, retryBackoff: 20000 }, 5)

      expect(waits).toEqual([10000, 20000, 40000, 60000, 60000])
    })

    it('is not below a configured retryBackoff', async () => {
      const waits = await failureWaits({ interval: 10000, maxRetries: 1, retryBackoff: 90000 }, 4)

      expect(waits).toEqual([10000, 90000, 90000, 90000])
    })
  })

  describe('invalid maxRetryBackoff', () => {
    const schedule = (polling: PollingConfig): void =>
      scheduler.scheduleDevice('device1', createConfig(polling), createDriver(jest.fn()))

    it.each([0, -1, NaN, 2 ** 31])('rejects %p', (maxRetryBackoff) => {
      expect(() => schedule({ interval: 1000, retryBackoff: 500, maxRetryBackoff })).toThrow(
        `Invalid max retry backoff for device device1: ${maxRetryBackoff}`
      )
      expect(scheduler.isScheduled('device1')).toBe(false)
    })

    it('rejects a value below the configured retryBackoff', () => {
      expect(() => schedule({ interval: 1000, retryBackoff: 5000, maxRetryBackoff: 4999 })).toThrow(
        'Invalid max retry backoff for device device1: 4999 is below the retry backoff 5000'
      )
    })

    it('rejects a value below the default retryBackoff (2 x interval)', () => {
      expect(() => schedule({ interval: 1000, maxRetryBackoff: 1999 })).toThrow(
        'Invalid max retry backoff for device device1: 1999 is below the retry backoff 2000'
      )
    })

    it('accepts a value equal to retryBackoff', () => {
      expect(() =>
        schedule({ interval: 1000, retryBackoff: 5000, maxRetryBackoff: 5000 })
      ).not.toThrow()
    })
  })
})
