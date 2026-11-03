import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import type { DeviceDriver } from '@ya-modbus/driver-types'

import { PollingScheduler } from './polling-scheduler.js'
import type { DeviceConfig } from './types.js'

describe('PollingScheduler read time callback', () => {
  const config: DeviceConfig = {
    deviceId: 'device1',
    driver: 'test-driver',
    connection: { type: 'tcp', host: 'localhost', slaveId: 1 },
    polling: { interval: 1000 },
  }

  let scheduler: PollingScheduler
  let onRead: jest.Mock<(deviceId: string, ms: number, ok: boolean) => void>

  beforeEach(() => {
    jest.useFakeTimers()
    onRead = jest.fn()
    scheduler = new PollingScheduler(jest.fn(), jest.fn(), onRead)
  })

  afterEach(() => {
    scheduler.stop()
    jest.useRealTimers()
  })

  const driverWithRead = (takes: number, fails: boolean): DeviceDriver =>
    ({
      name: 'test',
      manufacturer: 'Test',
      model: 'T',
      dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
      readDataPoint: jest.fn(),
      writeDataPoint: jest.fn(),
      readDataPoints: () =>
        new Promise((resolve, reject) =>
          setTimeout(() => (fails ? reject(new Error('Timed out')) : resolve({ temp: 1 })), takes)
        ),
    }) as unknown as DeviceDriver

  it.each([true, false])('should report how long the read took (ok: %p)', async (ok) => {
    scheduler.scheduleDevice('device1', config, driverWithRead(250, !ok))
    scheduler.start()

    await jest.advanceTimersByTimeAsync(1000 + 250)

    expect(onRead).toHaveBeenCalledTimes(1)
    expect(onRead).toHaveBeenCalledWith('device1', 250, ok)
  })

  it('should pass the read time with the data of a poll and of the read after a write', async () => {
    const onData = jest.fn()
    scheduler = new PollingScheduler(onData, jest.fn())
    scheduler.scheduleDevice(
      'device1',
      { ...config, allowWrites: true },
      driverWithRead(250, false)
    )
    scheduler.start()

    await jest.advanceTimersByTimeAsync(1000 + 250)
    expect(onData).toHaveBeenLastCalledWith('device1', { temp: 1 }, { readMs: 250 })

    const write = scheduler.writeDevice('device1', {})
    await jest.advanceTimersByTimeAsync(250)
    await write
    expect(onData).toHaveBeenLastCalledWith(
      'device1',
      { temp: 1 },
      { readMs: 250, afterWrite: true }
    )
  })
})
