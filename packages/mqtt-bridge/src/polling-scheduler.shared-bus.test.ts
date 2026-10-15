import { describe, it, expect, afterEach, beforeEach, jest } from '@jest/globals'
import type { DeviceDriver } from '@ya-modbus/driver-types'

import { PollingScheduler } from './polling-scheduler.js'
import type { DeviceConfig } from './types.js'

/**
 * Devices on one serial bus are read one at a time. A device that does not answer holds the bus
 * for the whole timeout of each poll, so it must not be polled often.
 */
describe('PollingScheduler devices on one bus', () => {
  const GOOD_READ_MS = 100
  // 3 tries of the default 1000 ms timeout
  const DEAD_READ_MS = 3000
  const WARM_UP_MS = 10 * 60 * 1000
  const WINDOW_MS = 10 * 60 * 1000

  // At the longest wait (60 s) the dead device holds the bus for 3 s of every ~63 s: 4.8 %.
  // The bound leaves room for reads that cannot fit around the 3 s block.
  const MAX_LOSS_PERCENT = 6

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  /** Runs the work of one device at a time, in the order it was asked for */
  const createBus = () => {
    let last: Promise<unknown> = Promise.resolve()
    return <T>(work: () => Promise<T>): Promise<T> => {
      const result = last.then(work)
      last = result.catch(() => undefined)
      return result
    }
  }

  const createDriver = (holdBus: () => Promise<Record<string, unknown>>): DeviceDriver => ({
    name: 'test',
    manufacturer: 'Test',
    model: 'TEST-001',
    dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: 'C' }],
    readDataPoint: jest.fn(),
    writeDataPoint: jest.fn(),
    readDataPoints: holdBus,
  })

  const config = (deviceId: string, polling: DeviceConfig['polling']): DeviceConfig => ({
    deviceId,
    driver: 'test-driver',
    connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
    polling,
  })

  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

  /** Reads of the working device in the measured window */
  const goodReadsInWindow = async (withDeadDevice: boolean): Promise<number> => {
    const onBus = createBus()
    let goodReads = 0
    const scheduler = new PollingScheduler(
      (deviceId) => {
        if (deviceId === 'good') goodReads++
      },
      () => undefined
    )

    scheduler.scheduleDevice(
      'good',
      config('good', { interval: 2000, mode: 'continuous' }),
      createDriver(() => onBus(async () => (await wait(GOOD_READ_MS), { temp: 1 })))
    )
    if (withDeadDevice) {
      scheduler.scheduleDevice(
        'dead',
        config('dead', { interval: 2000 }),
        createDriver(() =>
          onBus(async () => {
            await wait(DEAD_READ_MS)
            throw new Error('Timed out')
          })
        )
      )
    }
    scheduler.start()

    await jest.advanceTimersByTimeAsync(WARM_UP_MS)
    const before = goodReads
    await jest.advanceTimersByTimeAsync(WINDOW_MS)
    scheduler.stop()
    return goodReads - before
  }

  it(`costs the working device at most ${MAX_LOSS_PERCENT} % of its reads`, async () => {
    const alone = await goodReadsInWindow(false)
    const withDead = await goodReadsInWindow(true)
    const lossPercent = ((alone - withDead) / alone) * 100

    expect(alone).toBeGreaterThan(5000)
    expect(lossPercent).toBeGreaterThanOrEqual(0)
    expect(lossPercent).toBeLessThanOrEqual(MAX_LOSS_PERCENT)
  })
})
