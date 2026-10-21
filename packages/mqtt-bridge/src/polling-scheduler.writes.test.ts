import { describe, it, expect, afterEach, beforeEach, jest } from '@jest/globals'
import type { DeviceDriver } from '@ya-modbus/driver-types'

import { PollingScheduler } from './polling-scheduler.js'
import type { DeviceConfig } from './types.js'

/**
 * Writes to a device that is not scheduled, and the failure count of the polls around a write.
 * The other write behaviour is tested through the bridge in index.writes.test.ts.
 */
describe('PollingScheduler writeDevice', () => {
  const INTERVAL = 1000

  const config: DeviceConfig = {
    deviceId: 'thermostat',
    driver: 'test-driver',
    connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
    polling: { interval: INTERVAL, maxRetries: 3, retryBackoff: INTERVAL },
    allowWrites: true,
  }

  let onError: jest.Mock<(deviceId: string, error: Error, failureCount: number) => void>
  let scheduler: PollingScheduler
  let driver: DeviceDriver
  let readDataPoints: jest.Mock<DeviceDriver['readDataPoints']>

  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    onError = jest.fn()
    scheduler = new PollingScheduler(jest.fn(), onError)
    readDataPoints = jest.fn<DeviceDriver['readDataPoints']>().mockResolvedValue({ setpoint: 1 })
    driver = {
      name: 'test',
      manufacturer: 'Test',
      model: 'TEST-001',
      dataPoints: [{ id: 'setpoint', type: 'float', access: 'rw' }],
      readDataPoint: jest.fn<DeviceDriver['readDataPoint']>(),
      writeDataPoint: jest.fn<DeviceDriver['writeDataPoint']>().mockResolvedValue(undefined),
      readDataPoints,
    }
  })

  afterEach(() => {
    scheduler.stop()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  /** Schedule the device and let `count` polls fail */
  const failPolls = async (count: number): Promise<void> => {
    scheduler.scheduleDevice('thermostat', config, driver)
    scheduler.start()
    for (let i = 0; i < count; i++) {
      readDataPoints.mockRejectedValueOnce(new Error('Timed out'))
      await jest.advanceTimersByTimeAsync(INTERVAL)
    }
  }

  it('rejects a write to a device that is not scheduled', async () => {
    await expect(scheduler.writeDevice('thermostat', { setpoint: 23 })).rejects.toThrow(
      'Device thermostat is not polled'
    )
  })

  it.each([
    { name: 'the device is unscheduled', end: () => scheduler.unscheduleDevice('thermostat') },
    { name: 'polling stops', end: () => scheduler.stop() },
  ])('does not write when $name while the write waits for its turn', async ({ end }) => {
    let endPoll: (data: Record<string, unknown>) => void = () => undefined
    readDataPoints.mockReturnValueOnce(new Promise((resolve) => (endPoll = resolve)))
    scheduler.scheduleDevice('thermostat', config, driver)
    scheduler.start()
    await jest.advanceTimersByTimeAsync(INTERVAL)

    const write = scheduler.writeDevice('thermostat', { setpoint: 23 })
    end()
    endPoll({ setpoint: 1 })

    await expect(write).rejects.toThrow('Device thermostat is not polled')
    expect(driver.writeDataPoint).not.toHaveBeenCalled()
  })

  it('counts the failed polls from 0 again after a good read after a write', async () => {
    await failPolls(3)

    await scheduler.writeDevice('thermostat', { setpoint: 23 })
    readDataPoints.mockRejectedValueOnce(new Error('Timed out'))
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(onError).toHaveBeenLastCalledWith('thermostat', new Error('Timed out'), 1)
  })

  it('does not count a failed read after a write as a failed poll', async () => {
    await failPolls(1)

    readDataPoints.mockRejectedValueOnce(new Error('Timed out'))
    await scheduler.writeDevice('thermostat', { setpoint: 23 })
    readDataPoints.mockRejectedValueOnce(new Error('Timed out'))
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(onError.mock.calls.map(([, , failureCount]) => failureCount)).toEqual([1, 2])
  })
})
