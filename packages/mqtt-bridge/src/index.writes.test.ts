import { EventEmitter } from 'events'

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import type { DataPoint, DeviceDriver } from '@ya-modbus/driver-types'
import mqtt from 'mqtt'

import type { DeviceManager } from './device-manager.js'
import type { DriverLoader } from './driver-loader.js'
import type { DeviceConfig, MqttBridge } from './types.js'

import { createBridge } from './index.js'

jest.mock('mqtt')

const mockedMqtt = mqtt as jest.Mocked<typeof mqtt>

/**
 * Writes on {topicPrefix}/{deviceId}/set. The real polling scheduler is used, so a write takes its
 * turn on the bus like a poll.
 */
describe('createBridge writes', () => {
  const INTERVAL = 1000
  const WRITE_TOPIC = 'modbus/thermostat/set'

  const readOnlyThermostat: DeviceConfig = {
    deviceId: 'thermostat',
    driver: 'ya-modbus-driver-test',
    connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
    polling: { interval: INTERVAL },
  }
  const thermostat: DeviceConfig = { ...readOnlyThermostat, allowWrites: true }

  /** Driver of a device whose points hold the values in `registers`. It rejects a value above `max`. */
  const createDriver = (
    dataPoints: DataPoint[],
    registers: Record<string, unknown>
  ): DeviceDriver & {
    writeDataPoint: jest.Mock<DeviceDriver['writeDataPoint']>
    readDataPoints: jest.Mock<DeviceDriver['readDataPoints']>
  } => ({
    name: 'test',
    manufacturer: 'Test',
    model: 'TEST-001',
    dataPoints,
    readDataPoint: jest.fn<DeviceDriver['readDataPoint']>(),
    writeDataPoint: jest.fn((id: string, value: unknown) => {
      const max = dataPoints.find((dp) => dp.id === id)?.max
      if (max !== undefined && Number(value) > max) {
        return Promise.reject(new Error('Illegal data value'))
      }
      registers[id] = value
      return Promise.resolve()
    }),
    readDataPoints: jest.fn((ids: string[]) =>
      Promise.resolve(Object.fromEntries(ids.map((id) => [id, registers[id]])))
    ),
  })

  let client: EventEmitter & {
    connected: boolean
    publish: jest.Mock<(topic: string, payload: string, opts: object, cb: () => void) => void>
    subscribe: jest.Mock<(topic: string, opts: object, cb: (error?: Error) => void) => void>
    unsubscribe: jest.Mock<(topic: string, cb: () => void) => void>
    end: jest.Mock<(force: boolean, opts: object, cb: () => void) => void>
  }
  let drivers: Map<string, ReturnType<typeof createDriver>>
  let driver: ReturnType<typeof createDriver>
  let deviceManager: { updateDeviceState: jest.Mock }
  let bridge: MqttBridge

  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)

    client = Object.assign(new EventEmitter(), {
      connected: false,
      publish: jest.fn((_topic: string, _payload: string, _opts: object, cb: () => void) => cb()),
      subscribe: jest.fn<(topic: string, opts: object, cb: (error?: Error) => void) => void>(),
      unsubscribe: jest.fn<(topic: string, cb: () => void) => void>(),
      end: jest.fn((_force: boolean, _opts: object, cb: () => void) => cb()),
    })
    mockedMqtt.connect.mockReturnValue(client as unknown as mqtt.MqttClient)

    driver = createDriver(
      [
        { id: 'temperature', type: 'float' },
        { id: 'version', type: 'string', access: 'r' },
        { id: 'setpoint', type: 'float', access: 'rw', max: 30 },
        { id: 'mode', type: 'integer', access: 'rw' },
        { id: 'reset', type: 'boolean', access: 'w' },
      ],
      { temperature: 21, version: '1.0', setpoint: 20, mode: 1 }
    )
    drivers = new Map([['thermostat', driver]])
    deviceManager = { updateDeviceState: jest.fn() }

    bridge = createBridge(
      { mqtt: { url: 'mqtt://localhost:1883' } },
      {
        driverLoader: {
          getDriver: (deviceId: string) => drivers.get(deviceId),
          getConnectionError: jest.fn(),
          closeAllTransports: jest.fn(),
        } as unknown as DriverLoader,
        deviceManager: {
          ...deviceManager,
          addDevice: jest.fn(),
          removeDevice: jest.fn(),
          getDevice: jest.fn(),
          getDeviceConfig: jest.fn(),
          clear: jest.fn(),
        } as unknown as DeviceManager,
      }
    )
  })

  afterEach(async () => {
    await bridge.stop()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  const start = async (): Promise<void> => {
    const started = bridge.start()
    client.connected = true
    client.emit('connect')
    await started
  }

  const startWith = async (config: Partial<DeviceConfig> = {}): Promise<void> => {
    await start()
    await bridge.addDevice({ ...thermostat, ...config })
  }

  /** Send a message on the write topic and wait until the bridge has handled it */
  const send = async (payload: unknown, retain = false): Promise<void> => {
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload)
    client.emit('message', WRITE_TOPIC, Buffer.from(text), { qos: 0, retain })
    await jest.advanceTimersByTimeAsync(0)
  }

  /** Messages that the bridge published on a topic of the thermostat */
  const published = (topic: 'data' | 'set/result'): unknown[] =>
    client.publish.mock.calls
      .filter(([t]) => t === `modbus/thermostat/${topic}`)
      .map(([, payload]) => JSON.parse(payload))

  describe('topic', () => {
    it('subscribes to the write topic of a polled device', async () => {
      await startWith()

      expect(client.subscribe).toHaveBeenCalledWith(WRITE_TOPIC, { qos: 0 }, expect.any(Function))
    })

    it('does not subscribe for a disabled device', async () => {
      await startWith({ enabled: false })

      expect(client.subscribe).not.toHaveBeenCalled()
    })

    it('subscribes to the write topic of a device added before the start', async () => {
      await bridge.addDevice(thermostat)
      expect(client.subscribe).not.toHaveBeenCalled()

      await start()

      expect(client.subscribe).toHaveBeenCalledWith(WRITE_TOPIC, { qos: 0 }, expect.any(Function))
    })

    it('logs a failed subscribe', async () => {
      client.subscribe.mockImplementation((_topic, _opts, cb) => cb(new Error('Not authorized')))

      await startWith()

      expect(console.error).toHaveBeenCalledWith(
        `Failed to subscribe to ${WRITE_TOPIC}:`,
        new Error('Not authorized')
      )
    })

    it('unsubscribes and stops writing when the device is removed', async () => {
      await startWith()

      await bridge.removeDevice('thermostat')
      await send({ setpoint: 23 })

      expect(client.unsubscribe).toHaveBeenCalledWith(WRITE_TOPIC, expect.any(Function))
      expect(driver.writeDataPoint).not.toHaveBeenCalled()
      expect(published('set/result')).toEqual([])
    })
  })

  it('writes one point and publishes an ok result', async () => {
    await startWith()

    await send({ setpoint: 23 })

    expect(driver.writeDataPoint.mock.calls).toEqual([['setpoint', 23]])
    expect(published('set/result')).toEqual([
      { deviceId: 'thermostat', timestamp: expect.any(Number), ok: true, values: { setpoint: 23 } },
    ])
  })

  it('writes several points in the order of the message', async () => {
    await startWith()

    await send({ mode: 2, setpoint: 23, reset: true })

    expect(driver.writeDataPoint.mock.calls).toEqual([
      ['mode', 2],
      ['setpoint', 23],
      ['reset', true],
    ])
    expect(published('set/result')).toEqual([
      expect.objectContaining({ ok: true, values: { mode: 2, setpoint: 23, reset: true } }),
    ])
  })

  it('reads the device right after the write and publishes the data', async () => {
    await startWith()

    await send({ setpoint: 23 })

    // No poll was due: the interval has not passed
    expect(published('data')).toEqual([
      {
        deviceId: 'thermostat',
        timestamp: expect.any(Number),
        data: { temperature: 21, version: '1.0', setpoint: 23, mode: 1 },
      },
    ])
  })

  it.each([
    {
      name: 'an unknown point',
      values: { setpoint: 23, fan: 1 },
      error: 'Data point fan does not exist',
    },
    {
      name: 'a point without access',
      values: { setpoint: 23, temperature: 30 },
      error: 'Data point temperature is read-only',
    },
    {
      name: 'a read-only point',
      values: { setpoint: 23, version: '2.0' },
      error: 'Data point version is read-only',
    },
  ])('writes nothing when the message has $name', async ({ values, error }) => {
    await startWith()

    await send(values)

    expect(driver.writeDataPoint).not.toHaveBeenCalled()
    expect(published('set/result')).toEqual([
      {
        deviceId: 'thermostat',
        timestamp: expect.any(Number),
        ok: false,
        error,
        written: [],
        values,
      },
    ])
  })

  it.each([
    { name: 'without allowWrites', config: readOnlyThermostat },
    { name: 'with allowWrites false', config: { ...readOnlyThermostat, allowWrites: false } },
  ])('writes nothing to a device $name', async ({ config }) => {
    await start()
    await bridge.addDevice(config)

    await send({ setpoint: 23 })

    expect(driver.writeDataPoint).not.toHaveBeenCalled()
    expect(published('set/result')).toEqual([
      expect.objectContaining({
        ok: false,
        error: 'Device thermostat does not allow writes (allowWrites is not true)',
        written: [],
      }),
    ])
  })

  it('writes nothing more after a driver error on the first point, and still reads the device', async () => {
    await startWith()

    await send({ setpoint: 99, mode: 2 })

    expect(driver.writeDataPoint.mock.calls).toEqual([['setpoint', 99]])
    expect(published('set/result')).toEqual([
      expect.objectContaining({
        ok: false,
        error: 'Failed to write data point setpoint: Illegal data value',
        written: [],
      }),
    ])
    expect(published('data')).toEqual([
      expect.objectContaining({ data: expect.objectContaining({ mode: 1, setpoint: 20 }) }),
    ])
  })

  it('stops at a driver error, names the point, and still reads the device', async () => {
    await startWith()

    await send({ mode: 2, setpoint: 99, reset: true })

    // The point after the failed one is not written
    expect(driver.writeDataPoint.mock.calls).toEqual([
      ['mode', 2],
      ['setpoint', 99],
    ])
    expect(published('set/result')).toEqual([
      expect.objectContaining({
        ok: false,
        error: 'Failed to write data point setpoint: Illegal data value',
        written: ['mode'],
        values: { mode: 2, setpoint: 99, reset: true },
      }),
    ])
    // The data shows the real state: mode is written, setpoint is not
    expect(published('data')).toEqual([
      expect.objectContaining({ data: expect.objectContaining({ mode: 2, setpoint: 20 }) }),
    ])
  })

  it('leaves a failed read after a write to the next poll', async () => {
    await startWith()
    driver.readDataPoints.mockRejectedValueOnce(new Error('Timed out'))

    await send({ setpoint: 23 })

    expect(published('set/result')).toEqual([expect.objectContaining({ ok: true })])
    expect(console.warn).toHaveBeenCalledWith(
      'Failed to read device thermostat after a write, the next poll reads it: Timed out'
    )
    // Not a failed poll
    expect(deviceManager.updateDeviceState).not.toHaveBeenCalledWith(
      'thermostat',
      expect.objectContaining({ consecutiveFailures: expect.any(Number) })
    )
  })

  it('waits until a running poll of another device on the same port has ended', async () => {
    const meter = createDriver([{ id: 'energy', type: 'float' }], { energy: 5 })
    let endPoll: (data: Record<string, unknown>) => void = () => undefined
    meter.readDataPoints.mockReturnValueOnce(new Promise((resolve) => (endPoll = resolve)))
    drivers.set('meter', meter)
    await startWith()
    await bridge.addDevice({
      ...thermostat,
      deviceId: 'meter',
      connection: { ...thermostat.connection, slaveId: 2 },
      polling: { interval: INTERVAL / 2 },
    })
    await jest.advanceTimersByTimeAsync(INTERVAL / 2)
    expect(meter.readDataPoints).toHaveBeenCalledTimes(1)

    await send({ setpoint: 23 })
    expect(driver.writeDataPoint).not.toHaveBeenCalled()

    endPoll({ energy: 5 })
    await jest.advanceTimersByTimeAsync(0)
    expect(driver.writeDataPoint).toHaveBeenCalledWith('setpoint', 23)
  })

  it('ignores a retained message', async () => {
    await startWith()

    await send({ setpoint: 23 }, true)

    expect(driver.writeDataPoint).not.toHaveBeenCalled()
    expect(published('set/result')).toEqual([])
    expect(console.warn).toHaveBeenCalledWith(
      'Ignored a retained write message for device thermostat'
    )
  })

  it.each([
    { payload: 'setpoint=23', error: 'The message is not valid JSON' },
    ...['[23]', 'null', '23', '"23"', '{}'].map((payload) => ({
      payload,
      error: 'The message must be a JSON object of data point IDs and values',
    })),
  ])('answers $payload with an error and writes nothing', async ({ payload, error }) => {
    await startWith()

    await send(payload)

    expect(driver.writeDataPoint).not.toHaveBeenCalled()
    expect(published('set/result')).toEqual([
      { deviceId: 'thermostat', timestamp: expect.any(Number), ok: false, error, written: [] },
    ])
  })
})
