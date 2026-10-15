import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
import type { DataPoint, DeviceDriver } from '@ya-modbus/driver-types'

import { PollingScheduler } from './polling-scheduler.js'
import type { DeviceConfig, DeviceConnection } from './types.js'

/**
 * Devices that share a connection are polled one at a time, in turn: the whole poll of a device
 * runs before the poll of the next one. Then a pause between requests to different devices on
 * a serial port is paid once per device, not once per request (#655).
 */
describe('PollingScheduler with devices on one connection', () => {
  const READ_MS = 50

  let scheduler: PollingScheduler
  // Start and end of each read: '<device> <points> start' and '<device> end'
  let log: string[]

  const rtu = (port: string, baudRate = 9600): DeviceConnection => ({
    type: 'rtu',
    port,
    baudRate,
    slaveId: 1,
  })

  const tcp = (host: string, port?: number): DeviceConnection => ({
    type: 'tcp',
    host,
    ...(port !== undefined && { port }),
    slaveId: 1,
  })

  const config = (
    deviceId: string,
    connection: DeviceConnection,
    mode: 'interval' | 'continuous' = 'interval'
  ): DeviceConfig => ({
    deviceId,
    driver: 'test-driver',
    connection,
    polling: { interval: 100, mode },
  })

  // Driver whose reads take READ_MS
  const createDriver = (deviceId: string, dataPoints: DataPoint[] = []): DeviceDriver => ({
    name: 'test',
    manufacturer: 'Test',
    model: 'TEST-001',
    dataPoints: [{ id: 'value', name: 'Value', type: 'number' }, ...dataPoints],
    readDataPoint: jest.fn<DeviceDriver['readDataPoint']>(),
    writeDataPoint: jest.fn<DeviceDriver['writeDataPoint']>(),
    readDataPoints: jest.fn((ids: string[]) => {
      log.push(`${deviceId} ${ids.join(',')} start`)
      return new Promise((resolve) =>
        setTimeout(() => {
          log.push(`${deviceId} end`)
          resolve(Object.fromEntries(ids.map((id) => [id, 1])))
        }, READ_MS)
      )
    }),
  })

  const schedule = (...configs: DeviceConfig[]): void => {
    for (const device of configs) {
      scheduler.scheduleDevice(device.deviceId, device, createDriver(device.deviceId))
    }
  }

  beforeEach(() => {
    jest.useFakeTimers()
    scheduler = new PollingScheduler(jest.fn(), jest.fn())
    log = []
  })

  afterEach(() => {
    scheduler.stop()
    jest.useRealTimers()
  })

  it('should read the static points of a device before the next device on the connection', async () => {
    const serial: DataPoint = { id: 'serial', name: 'Serial', type: 'integer', pollType: 'static' }
    const meter1 = config('meter1', rtu('/dev/ttyUSB0'))
    scheduler.scheduleDevice('meter1', meter1, createDriver('meter1', [serial]))
    schedule(config('meter2', rtu('/dev/ttyUSB0')))
    scheduler.start()

    await jest.advanceTimersByTimeAsync(100 + 3 * READ_MS)

    expect(log).toEqual([
      'meter1 value start',
      'meter1 end',
      'meter1 serial start',
      'meter1 end',
      'meter2 value start',
      'meter2 end',
    ])
  })

  it('should poll every device on the connection in turn in continuous mode', async () => {
    schedule(
      config('meter1', rtu('/dev/ttyUSB0'), 'continuous'),
      config('meter2', rtu('/dev/ttyUSB0'), 'continuous'),
      config('meter3', rtu('/dev/ttyUSB0'), 'continuous')
    )
    scheduler.start()

    // Until the 9th read is in flight. The device that has just been read waits behind the others.
    await jest.advanceTimersByTimeAsync(9 * READ_MS)

    const rounds = [1, 2, 3].flatMap(() => ['meter1', 'meter2', 'meter3'])
    expect(log).toEqual(
      rounds.flatMap((deviceId) => [`${deviceId} value start`, `${deviceId} end`]).slice(0, -1)
    )
  })

  it.each([
    ['the same serial port', rtu('/dev/ttyUSB0'), rtu('/dev/ttyUSB0', 19200)],
    ['the same TCP host and port', tcp('192.0.2.1'), tcp('192.0.2.1', 502)],
  ])('should poll devices on %s one at a time', async (_name, connection1, connection2) => {
    schedule(config('meter1', connection1), config('meter2', connection2))
    scheduler.start()

    await jest.advanceTimersByTimeAsync(100 + 2 * READ_MS)

    expect(log).toEqual(['meter1 value start', 'meter1 end', 'meter2 value start', 'meter2 end'])
  })

  it.each([
    ['another serial port', rtu('/dev/ttyUSB0'), rtu('/dev/ttyUSB1')],
    ['another TCP host', tcp('192.0.2.1'), tcp('192.0.2.2')],
    ['another TCP port', tcp('192.0.2.1'), tcp('192.0.2.1', 503)],
    ['a serial port and TCP', rtu('192.0.2.1'), tcp('192.0.2.1')],
  ])(
    'should not make a device wait for a device on %s',
    async (_name, connection1, connection2) => {
      schedule(config('meter1', connection1), config('meter2', connection2))
      scheduler.start()

      await jest.advanceTimersByTimeAsync(100)

      expect(log).toEqual(['meter1 value start', 'meter2 value start'])
    }
  )

  it.each([
    ['the device is unscheduled', (): void => scheduler.unscheduleDevice('meter2')],
    ['polling stops', (): void => scheduler.stop()],
  ])('should not read a device that waits for its turn when %s', async (_name, action) => {
    schedule(config('meter1', rtu('/dev/ttyUSB0')), config('meter2', rtu('/dev/ttyUSB0')))
    scheduler.start()
    await jest.advanceTimersByTimeAsync(100)

    action()
    await jest.advanceTimersByTimeAsync(READ_MS)

    expect(log).toEqual(['meter1 value start', 'meter1 end'])
  })
})
