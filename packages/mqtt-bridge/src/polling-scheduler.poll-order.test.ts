import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import type { DeviceDriver } from '@ya-modbus/driver-types'

import { PollingScheduler } from './polling-scheduler.js'
import type { DeviceConfig, PollingConfig, RTUConnection } from './types.js'

/**
 * With connection.pollOrder 'fixed' the devices on one line take turns in config order. A device
 * that is not due skips its turn (#682).
 */
describe('PollingScheduler fixed poll order', () => {
  let scheduler: PollingScheduler
  // The device id of each read, in the order the reads started
  let reads: string[]

  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

  /** A device whose read takes `ms` and then fails, or returns a value */
  const createDriver = (deviceId: string, ms: number, fails = false): DeviceDriver => ({
    name: 'test',
    manufacturer: 'Test',
    model: 'TEST-001',
    dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: 'C' }],
    readDataPoint: jest.fn(),
    writeDataPoint: jest.fn(),
    readDataPoints: async () => {
      reads.push(deviceId)
      await wait(ms)
      if (fails) throw new Error(`${deviceId} timed out`)
      return { temp: 1 }
    },
  })

  const config = (
    deviceId: string,
    polling: PollingConfig,
    pollOrder: RTUConnection['pollOrder']
  ): DeviceConfig => ({
    deviceId,
    driver: 'test-driver',
    connection: { type: 'rtu', port: '/dev/ttyUSB0', slaveId: 1, ...(pollOrder && { pollOrder }) },
    polling,
  })

  const schedule = (deviceId: string, ms: number, polling: PollingConfig, fails = false): void =>
    scheduler.scheduleDevice(
      deviceId,
      config(deviceId, polling, 'fixed'),
      createDriver(deviceId, ms, fails)
    )

  beforeEach(() => {
    jest.useFakeTimers()
    reads = []
    scheduler = new PollingScheduler(
      () => undefined,
      () => undefined
    )
  })

  afterEach(() => {
    scheduler.stop()
    jest.useRealTimers()
  })

  it('should keep the config order after slow and failed reads', async () => {
    schedule('a', 10, { interval: 100 })
    schedule('slow', 3000, { interval: 100 })
    schedule('failing', 1000, { interval: 100, maxRetries: 100 }, true)
    schedule('d', 10, { interval: 100, mode: 'continuous' })
    scheduler.start()

    await jest.advanceTimersByTimeAsync(5 * 4100)

    // d is due first, 1 ms after the start, and reads alone until the others are due
    const rounds = reads.slice(reads.indexOf('a'))
    expect(rounds.length).toBeGreaterThanOrEqual(16)
    const order = ['a', 'slow', 'failing', 'd']
    expect(rounds).toEqual(rounds.map((_, i) => order[i % order.length]))
  })

  it('should poll the other devices on time while one device is in backoff', async () => {
    schedule('a', 100, { interval: 1000 })
    schedule('dead', 1000, { interval: 1000, maxRetries: 0, retryBackoff: 60000 }, true)
    schedule('c', 100, { interval: 1000 })
    scheduler.start()

    // The first round: a, the failed read of dead, c
    await jest.advanceTimersByTimeAsync(2150)
    expect(reads).toEqual(['a', 'dead', 'c'])

    // dead waits 60 s; a and c each take 100 ms and then wait 1000 ms
    reads = []
    await jest.advanceTimersByTimeAsync(55000)
    expect(reads.filter((id) => id === 'dead')).toEqual([])
    expect(reads.filter((id) => id === 'a').length).toBeGreaterThanOrEqual(48)
    expect(reads.filter((id) => id === 'c').length).toBeGreaterThanOrEqual(48)
  })

  it('should skip an interval device that is not due while a continuous device polls', async () => {
    schedule('slowly', 10, { interval: 1000 })
    schedule('fast', 10, { interval: 100, mode: 'continuous' })
    scheduler.start()

    await jest.advanceTimersByTimeAsync(10100)

    // fast reads about every 11 ms, slowly about every 1010 ms
    expect(reads.filter((id) => id === 'slowly').length).toBeGreaterThanOrEqual(9)
    expect(reads.filter((id) => id === 'fast').length).toBeGreaterThan(500)
  })

  it('should add a device at the end of the order, and drop a removed device', async () => {
    schedule('a', 10, { interval: 100 })
    schedule('b', 10, { interval: 100 })
    scheduler.start()
    await jest.advanceTimersByTimeAsync(150)
    expect(reads).toEqual(['a', 'b'])

    // c is due 100 ms after it is added, so it reads after a and b once
    schedule('c', 10, { interval: 100 })
    reads = []
    await jest.advanceTimersByTimeAsync(500)
    expect(reads.slice(0, 6)).toEqual(['a', 'b', 'c', 'a', 'b', 'c'])

    scheduler.unscheduleDevice('b')
    reads = []
    await jest.advanceTimersByTimeAsync(500)
    expect(reads.join(' ')).toMatch(/^(c )?(a c ?)+(a)?$/)
    expect(reads.length).toBeGreaterThanOrEqual(4)
  })

  it('should not read a device removed while it waits for its turn', async () => {
    schedule('slow', 1000, { interval: 100 })
    schedule('b', 10, { interval: 100 })
    scheduler.start()
    await jest.advanceTimersByTimeAsync(500)
    expect(reads).toEqual(['slow'])

    scheduler.unscheduleDevice('b')
    await jest.advanceTimersByTimeAsync(3000)

    expect(reads).not.toContain('b')
  })

  it('should keep one poll chain per device after stop and start during a read', async () => {
    schedule('a', 1000, { interval: 100 })
    schedule('b', 10, { interval: 100 })
    scheduler.start()
    await jest.advanceTimersByTimeAsync(500)

    scheduler.stop()
    scheduler.start()
    scheduler.start()
    await jest.advanceTimersByTimeAsync(5 * 1120)

    expect(reads.length).toBeGreaterThanOrEqual(10)
    expect(reads).toEqual(reads.map((_, i) => ['a', 'b'][i % 2]))
  })

  it('should not poll after stop', async () => {
    schedule('a', 10, { interval: 100 })
    scheduler.start()
    await jest.advanceTimersByTimeAsync(150)

    scheduler.stop()
    reads = []
    await jest.advanceTimersByTimeAsync(1000)

    expect(reads).toEqual([])
  })

  it.each([
    ['arrival', 'fixed', "a has 'fixed', b has 'arrival'"],
    ['fixed', undefined, "a has 'arrival' (not set), b has 'fixed'"],
  ] as const)('should refuse a device with %p on a line with %p', (pollOrder, others, message) => {
    scheduler.scheduleDevice('a', config('a', { interval: 100 }, others), createDriver('a', 10))

    expect(() =>
      scheduler.scheduleDevice(
        'b',
        config('b', { interval: 100 }, pollOrder),
        createDriver('b', 10)
      )
    ).toThrow(`The devices on rtu:/dev/ttyUSB0 must have the same connection.pollOrder: ${message}`)
    expect(scheduler.isScheduled('b')).toBe(false)
  })

  it('should let a device be scheduled again with another poll order', () => {
    schedule('a', 10, { interval: 100 })

    expect(() =>
      scheduler.scheduleDevice(
        'a',
        config('a', { interval: 100 }, 'arrival'),
        createDriver('a', 10)
      )
    ).not.toThrow()
  })
})
