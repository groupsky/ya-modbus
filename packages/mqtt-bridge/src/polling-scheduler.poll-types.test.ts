import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
import type { DataPoint, DeviceDriver } from '@ya-modbus/driver-types'

import { PollingScheduler } from './polling-scheduler.js'
import type { DeviceConfig } from './types.js'

/**
 * Each poll reads only the data points that should be polled. Reading on-demand or write-only
 * points on every poll costs bus time, and a device that does not answer one of them made every
 * poll fail, so no data was published at all.
 */
describe('PollingScheduler poll types', () => {
  const INTERVAL = 100

  let scheduler: PollingScheduler
  let onData: jest.Mock
  let onError: jest.Mock
  let warn: jest.SpiedFunction<typeof console.warn>

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

  const createDriver = (
    dataPoints: DataPoint[],
    readDataPoints: DeviceDriver['readDataPoints']
  ): DeviceDriver => ({
    name: 'test',
    manufacturer: 'Test',
    model: 'TEST-001',
    dataPoints,
    readDataPoint: jest.fn<DeviceDriver['readDataPoint']>(),
    writeDataPoint: jest.fn<DeviceDriver['writeDataPoint']>(),
    readDataPoints,
  })

  // Answers with a value for each id, like a device that answers every register
  const answerAll = (ids: string[]): Promise<Record<string, unknown>> =>
    Promise.resolve(Object.fromEntries(ids.map((id) => [id, `${id}-value`])))

  beforeEach(() => {
    jest.useFakeTimers()
    onData = jest.fn()
    onError = jest.fn()
    scheduler = new PollingScheduler(onData, onError)
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    scheduler.stop()
    warn.mockRestore()
    jest.useRealTimers()
  })

  it('should not read on-demand or write-only data points', async () => {
    const readDataPoints = jest.fn<DeviceDriver['readDataPoints']>(answerAll)
    const driver = createDriver(
      [
        point('voltage'),
        point('current', { pollType: 'dynamic' }),
        point('cycle_time', { access: 'rw', pollType: 'on-demand' }),
        point('reset', { access: 'w' }),
      ],
      readDataPoints
    )

    scheduler.scheduleDevice('device1', config, driver)
    scheduler.start()
    await jest.advanceTimersByTimeAsync(INTERVAL * 2)

    expect(readDataPoints).toHaveBeenCalledTimes(2)
    expect(readDataPoints).toHaveBeenNthCalledWith(1, ['voltage', 'current'])
    expect(readDataPoints).toHaveBeenNthCalledWith(2, ['voltage', 'current'])
  })

  it('should read static data points once and add them to every data message', async () => {
    const readDataPoints = jest.fn<DeviceDriver['readDataPoints']>(answerAll)
    const driver = createDriver(
      [point('serial_number', { pollType: 'static' }), point('voltage')],
      readDataPoints
    )

    scheduler.scheduleDevice('device1', config, driver)
    scheduler.start()
    await jest.advanceTimersByTimeAsync(INTERVAL * 3)

    expect(readDataPoints.mock.calls).toEqual([
      [['voltage']],
      [['serial_number']],
      [['voltage']],
      [['voltage']],
    ])
    const expected = { serial_number: 'serial_number-value', voltage: 'voltage-value' }
    expect(onData.mock.calls).toEqual([
      ['device1', expected],
      ['device1', expected],
      ['device1', expected],
    ])
  })

  it('should read static data points again when the device is scheduled again', async () => {
    const readDataPoints = jest.fn<DeviceDriver['readDataPoints']>(answerAll)
    const driver = createDriver(
      [point('serial_number', { pollType: 'static' }), point('voltage')],
      readDataPoints
    )

    scheduler.scheduleDevice('device1', config, driver)
    scheduler.start()
    await jest.advanceTimersByTimeAsync(INTERVAL)
    scheduler.scheduleDevice('device1', config, driver)
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(readDataPoints.mock.calls).toEqual([
      [['voltage']],
      [['serial_number']],
      [['voltage']],
      [['serial_number']],
    ])
  })

  it('should publish dynamic data when the static read fails, and retry it on the next poll', async () => {
    const staticError = new Error('Timed out')
    const readDataPoints = jest
      .fn<DeviceDriver['readDataPoints']>(answerAll)
      .mockImplementationOnce(answerAll)
      .mockRejectedValueOnce(staticError)
    const driver = createDriver(
      [point('serial_number', { pollType: 'static' }), point('voltage')],
      readDataPoints
    )

    scheduler.scheduleDevice('device1', config, driver)
    scheduler.start()
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(onData).toHaveBeenLastCalledWith('device1', { voltage: 'voltage-value' })
    expect(onError).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/device1.*serial_number/), staticError)

    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(readDataPoints.mock.calls).toEqual([
      [['voltage']],
      [['serial_number']],
      [['voltage']],
      [['serial_number']],
    ])
    expect(onData).toHaveBeenLastCalledWith('device1', {
      serial_number: 'serial_number-value',
      voltage: 'voltage-value',
    })
  })

  it('should not read static data points in a poll whose dynamic read failed', async () => {
    // A device that does not answer must cost one timeout per poll, not two
    const readDataPoints = jest
      .fn<DeviceDriver['readDataPoints']>()
      .mockRejectedValue(new Error('Timed out'))
    const driver = createDriver(
      [point('serial_number', { pollType: 'static' }), point('voltage')],
      readDataPoints
    )

    scheduler.scheduleDevice('device1', config, driver)
    scheduler.start()
    await jest.advanceTimersByTimeAsync(INTERVAL * 2)

    expect(readDataPoints.mock.calls).toEqual([[['voltage']], [['voltage']]])
    expect(onError).toHaveBeenCalledTimes(2)
    expect(warn).not.toHaveBeenCalled()
  })

  it('should publish static data without a dynamic read when the device has no dynamic points', async () => {
    const readDataPoints = jest.fn<DeviceDriver['readDataPoints']>(answerAll)
    const driver = createDriver([point('serial_number', { pollType: 'static' })], readDataPoints)

    scheduler.scheduleDevice('device1', config, driver)
    scheduler.start()
    await jest.advanceTimersByTimeAsync(INTERVAL * 2)

    expect(readDataPoints.mock.calls).toEqual([[['serial_number']]])
    expect(onData).toHaveBeenCalledTimes(2)
    expect(onData).toHaveBeenLastCalledWith('device1', { serial_number: 'serial_number-value' })
  })

  it('should publish data for a device with a silent on-demand register', async () => {
    // Like the OR-WE-516 with firmware 1.02: it never answers one config register. When every
    // poll read all data points, every poll timed out and no data message was published.
    const readDataPoints = jest
      .fn<DeviceDriver['readDataPoints']>()
      .mockImplementation((ids) =>
        ids.includes('combined_code') ? Promise.reject(new Error('Timed out')) : answerAll(ids)
      )
    const driver = createDriver(
      [point('voltage'), point('combined_code', { access: 'rw', pollType: 'on-demand' })],
      readDataPoints
    )

    scheduler.scheduleDevice('device1', config, driver)
    scheduler.start()
    await jest.advanceTimersByTimeAsync(INTERVAL * 2)

    expect(onData).toHaveBeenCalledTimes(2)
    expect(onData).toHaveBeenLastCalledWith('device1', { voltage: 'voltage-value' })
    expect(onError).not.toHaveBeenCalled()
  })
})
