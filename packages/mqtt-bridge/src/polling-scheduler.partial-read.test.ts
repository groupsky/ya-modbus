import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
import type { DataPoint, DeviceDriver } from '@ya-modbus/driver-types'

import { PollingScheduler } from './polling-scheduler.js'
import type { DeviceConfig } from './types.js'

/**
 * A driver that reads two register blocks in one call fails the whole call when the device
 * refuses one block. The device answered, so the data points of the other block are published.
 */
describe('PollingScheduler partial reads', () => {
  const INTERVAL = 100

  let scheduler: PollingScheduler
  let onData: jest.Mock
  let onError: jest.Mock

  const config: DeviceConfig = {
    deviceId: 'device1',
    driver: 'test-driver',
    connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
    polling: { interval: INTERVAL },
  }

  const point = (id: string, extra: Partial<DataPoint> = {}): DataPoint => ({
    id,
    name: id,
    type: 'float',
    access: 'r',
    ...extra,
  })

  const modbusException = (): Error =>
    Object.assign(new Error('Modbus exception 2: Illegal data address'), { modbusCode: 2 })

  // Block 1 holds voltage and current, block 2 holds energy and frequency. The device refuses
  // block 2 while energyFails is true.
  let energyFails: boolean
  let readDataPoints: jest.Mock<DeviceDriver['readDataPoints']>

  const schedule = (
    dataPoints = ['voltage', 'current', 'energy', 'frequency'].map((id) => point(id))
  ): void => {
    const driver: DeviceDriver = {
      name: 'test',
      manufacturer: 'Test',
      model: 'TEST-001',
      dataPoints,
      readDataPoint: jest.fn<DeviceDriver['readDataPoint']>(),
      writeDataPoint: jest.fn<DeviceDriver['writeDataPoint']>(),
      readDataPoints,
    }
    scheduler.scheduleDevice('device1', config, driver)
    scheduler.start()
  }

  beforeEach(() => {
    jest.useFakeTimers()
    onData = jest.fn()
    onError = jest.fn()
    scheduler = new PollingScheduler(onData, onError)
    energyFails = true
    readDataPoints = jest.fn<DeviceDriver['readDataPoints']>((ids) =>
      energyFails && ids.some((id) => id === 'energy' || id === 'frequency')
        ? Promise.reject(modbusException())
        : Promise.resolve(Object.fromEntries(ids.map((id) => [id, `${id}-value`])))
    )
  })

  afterEach(() => {
    scheduler.stop()
    jest.useRealTimers()
  })

  it('should publish the points of the block that works and name the failed points', async () => {
    schedule()
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(readDataPoints.mock.calls).toEqual([
      [['voltage', 'current', 'energy', 'frequency']],
      [['voltage']],
      [['current']],
      [['energy']],
      [['frequency']],
    ])
    expect(onData).toHaveBeenCalledWith(
      'device1',
      { voltage: 'voltage-value', current: 'current-value' },
      { failedDataPoints: ['energy', 'frequency'] }
    )
    expect(onError).not.toHaveBeenCalled()
  })

  it('should read the good points in one call and retry the failed points in another', async () => {
    schedule()
    await jest.advanceTimersByTimeAsync(INTERVAL)
    readDataPoints.mockClear()
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(readDataPoints.mock.calls).toEqual([[['voltage', 'current']], [['energy', 'frequency']]])
    expect(onData).toHaveBeenLastCalledWith(
      'device1',
      { voltage: 'voltage-value', current: 'current-value' },
      { failedDataPoints: ['energy', 'frequency'] }
    )
  })

  it('should publish the failed points again when the retry works', async () => {
    schedule()
    await jest.advanceTimersByTimeAsync(INTERVAL)
    energyFails = false
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(onData).toHaveBeenLastCalledWith('device1', {
      voltage: 'voltage-value',
      current: 'current-value',
      energy: 'energy-value',
      frequency: 'frequency-value',
    })

    readDataPoints.mockClear()
    await jest.advanceTimersByTimeAsync(INTERVAL)
    expect(readDataPoints.mock.calls).toEqual([[['voltage', 'current', 'energy', 'frequency']]])
  })

  it('should fail the whole poll on an error without a Modbus exception', async () => {
    readDataPoints.mockRejectedValue(new Error('Timed out'))
    schedule()
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(readDataPoints).toHaveBeenCalledTimes(1)
    expect(onData).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('device1', new Error('Timed out'), 1)
  })

  it.each([4, 5, 6])(
    'should fail the whole poll and mark nothing on Modbus exception %i',
    async (modbusCode) => {
      // 4 device failure, 5 acknowledge, 6 busy: the device did not refuse the points
      const busy = Object.assign(new Error('Slave device busy'), { modbusCode })
      readDataPoints.mockRejectedValueOnce(busy)
      schedule()
      await jest.advanceTimersByTimeAsync(INTERVAL)

      expect(readDataPoints).toHaveBeenCalledTimes(1)
      expect(onData).not.toHaveBeenCalled()
      expect(onError).toHaveBeenCalledWith('device1', busy, 1)

      energyFails = false
      readDataPoints.mockClear()
      await jest.advanceTimersByTimeAsync(INTERVAL)

      expect(readDataPoints.mock.calls).toEqual([[['voltage', 'current', 'energy', 'frequency']]])
      expect(onData).toHaveBeenCalledTimes(1)
    }
  )

  it('should fail the whole poll when the device refuses every point', async () => {
    readDataPoints.mockImplementation(() => Promise.reject(modbusException()))
    schedule()
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(onData).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('should read the refused points in one request until a read works again', async () => {
    let refuseAll = true
    readDataPoints.mockImplementation((ids) =>
      refuseAll
        ? Promise.reject(modbusException())
        : Promise.resolve(Object.fromEntries(ids.map((id) => [id, `${id}-value`])))
    )
    schedule()
    await jest.advanceTimersByTimeAsync(INTERVAL)
    expect(readDataPoints).toHaveBeenCalledTimes(5)

    readDataPoints.mockClear()
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(readDataPoints.mock.calls).toEqual([[['voltage', 'current', 'energy', 'frequency']]])
    expect(onError).toHaveBeenCalledTimes(2)
    expect(onData).not.toHaveBeenCalled()

    refuseAll = false
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(onData).toHaveBeenCalledWith('device1', {
      voltage: 'voltage-value',
      current: 'current-value',
      energy: 'energy-value',
      frequency: 'frequency-value',
    })
  })

  it('should fail the whole poll when the device stops answering during the scan', async () => {
    readDataPoints
      .mockRejectedValueOnce(modbusException())
      .mockRejectedValueOnce(new Error('Timed out'))
    schedule()
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(readDataPoints).toHaveBeenCalledTimes(2)
    expect(onData).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('device1', new Error('Timed out'), 1)
  })

  it('should publish the static points that work and retry only the failed ones', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    schedule([
      point('voltage'),
      point('serial_number', { pollType: 'static' }),
      point('energy', { pollType: 'static' }),
    ])
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(onData).toHaveBeenLastCalledWith(
      'device1',
      { serial_number: 'serial_number-value', voltage: 'voltage-value' },
      { failedDataPoints: ['energy'] }
    )

    readDataPoints.mockClear()
    energyFails = false
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(readDataPoints.mock.calls).toEqual([[['voltage']], [['energy']]])
    expect(onData).toHaveBeenLastCalledWith('device1', {
      serial_number: 'serial_number-value',
      energy: 'energy-value',
      voltage: 'voltage-value',
    })
    warn.mockRestore()
  })

  it('should name every static point when the device refuses them all, and retry in one request', async () => {
    schedule([
      point('voltage'),
      point('energy', { pollType: 'static' }),
      point('frequency', { pollType: 'static' }),
    ])
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(onData).toHaveBeenLastCalledWith(
      'device1',
      { voltage: 'voltage-value' },
      { failedDataPoints: ['energy', 'frequency'] }
    )

    readDataPoints.mockClear()
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(readDataPoints.mock.calls).toEqual([[['voltage']], [['energy', 'frequency']]])
    expect(onError).not.toHaveBeenCalled()
  })
})
