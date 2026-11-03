import type { EventEmitter } from 'events'

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import mqtt from 'mqtt'

import { DeviceManager } from './device-manager.js'
import { DriverLoader } from './driver-loader.js'
import { PollingScheduler } from './polling-scheduler.js'
import type { MqttBridge, MqttBridgeConfig } from './types.js'

import { createBridge } from './index.js'

jest.mock('mqtt')
jest.mock('./device-manager.js')
jest.mock('./driver-loader.js')
jest.mock('./polling-scheduler.js')

const MockedDeviceManager = DeviceManager as jest.MockedClass<typeof DeviceManager>
const MockedDriverLoader = DriverLoader as jest.MockedClass<typeof DriverLoader>
const MockedPollingScheduler = PollingScheduler as jest.MockedClass<typeof PollingScheduler>

const deviceConfig = (deviceId: string): any =>
  ({
    deviceId,
    driver: 'x',
    connection: { type: 'tcp', host: 'h', slaveId: 1 },
  }) as any

describe('createBridge device stats', () => {
  let read: (deviceId: string, ms: number, ok: boolean) => void
  let publish: jest.Mock
  let connected: boolean
  let start: (config?: Partial<MqttBridgeConfig>) => Promise<MqttBridge>

  beforeEach(() => {
    jest.useFakeTimers({ now: 1_000_000 })
    jest.clearAllMocks()
    connected = true
    publish = jest.fn((_t: unknown, _p: unknown, _o: unknown, cb?: () => void) => cb?.())

    const handlers = new Map<string, (...args: unknown[]) => void>()
    const client = {
      on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
        handlers.set(event, handler)
        return client
      }),
      removeAllListeners: jest.fn(),
      end: jest.fn((_force: unknown, _opts: unknown, cb?: () => void) => cb?.()),
      publish,
      subscribe: jest.fn((_t: unknown, _o: unknown, cb?: () => void) => cb?.()),
      unsubscribe: jest.fn((_t: unknown, cb?: () => void) => cb?.()),
      get connected() {
        return connected
      },
    } as unknown as EventEmitter
    ;(mqtt as jest.Mocked<typeof mqtt>).connect.mockReturnValue(
      client as unknown as mqtt.MqttClient
    )

    MockedDeviceManager.mockReturnValue({
      getDevice: jest.fn(),
      getDeviceConfig: jest.fn(),
      listDevices: jest.fn().mockReturnValue([]),
      updateDeviceState: jest.fn(),
      addDevice: jest.fn(),
      removeDevice: jest.fn(),
      clear: jest.fn(),
    } as any)
    MockedDriverLoader.mockReturnValue({
      closeAllTransports: jest.fn(),
      getDriver: jest.fn().mockReturnValue({}),
      getConnectionError: jest.fn(),
    } as any)
    MockedPollingScheduler.mockImplementation((_onData, _onError, onRead) => {
      read = onRead as typeof read
      return {
        start: jest.fn(),
        stop: jest.fn(),
        scheduleDevice: jest.fn(),
        unscheduleDevice: jest.fn(),
      } as any
    })

    start = async (config) => {
      const bridge = createBridge({ mqtt: { url: 'mqtt://localhost:1883' }, ...config })
      const started = bridge.start()
      handlers.get('connect')?.()
      await started
      return bridge
    }
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const statsMessages = (): Array<{ topic: string; payload: any; options: any }> =>
    publish.mock.calls
      .filter(([topic]) => String(topic).endsWith('/stats'))
      .map(([topic, payload, options]) => ({
        topic: topic as string,
        payload: JSON.parse(payload as string),
        options,
      }))

  it('should publish the stats of every device each interval', async () => {
    const bridge = await start({ statsInterval: 10 })
    await bridge.addDevice(deviceConfig('meter1'))
    await bridge.addDevice(deviceConfig('meter2'))
    read('meter1', 100, true)
    read('meter1', 300, true)
    read('meter1', 50, false)

    jest.advanceTimersByTime(10_000)

    const messages = statsMessages()
    expect(messages.map((m) => m.topic)).toEqual(['modbus/meter1/stats', 'modbus/meter2/stats'])
    expect(messages[0]?.options).toEqual({ qos: 0 })
    expect(messages[0]?.payload).toEqual({
      deviceId: 'meter1',
      timestamp: 1_010_000,
      polls: 3,
      errors: 1,
      consecutiveFailures: 1,
      lastSuccess: 1_000_000,
      avgReadMs: 200,
      readsPerSecond: 0.2,
    })
    expect(messages[1]?.payload).toMatchObject({
      polls: 0,
      lastSuccess: null,
      avgReadMs: null,
      readsPerSecond: 0,
    })
  })

  it('should use the topic prefix and publish again at every interval', async () => {
    const bridge = await start({ statsInterval: 5, topicPrefix: 'home' })
    await bridge.addDevice(deviceConfig('meter1'))

    jest.advanceTimersByTime(15_000)

    expect(statsMessages().map((m) => m.topic)).toEqual(Array(3).fill('home/meter1/stats'))
  })

  it.each([undefined, 0])('should publish no stats when statsInterval is %p', async (interval) => {
    const bridge = await start(interval === undefined ? {} : { statsInterval: interval })
    await bridge.addDevice(deviceConfig('meter1'))

    jest.advanceTimersByTime(100_000)

    expect(statsMessages()).toEqual([])
  })

  it('should stop publishing stats of a removed device', async () => {
    const bridge = await start({ statsInterval: 10 })
    await bridge.addDevice(deviceConfig('meter1'))
    await bridge.removeDevice('meter1')

    jest.advanceTimersByTime(10_000)

    expect(statsMessages()).toEqual([])
  })

  it('should stop publishing stats when the bridge stops', async () => {
    const bridge = await start({ statsInterval: 10 })
    await bridge.addDevice(deviceConfig('meter1'))
    await bridge.stop()

    jest.advanceTimersByTime(100_000)

    expect(statsMessages()).toEqual([])
    expect(jest.getTimerCount()).toBe(0)
  })

  it('should not publish stats while the broker is not connected', async () => {
    const bridge = await start({ statsInterval: 10 })
    await bridge.addDevice(deviceConfig('meter1'))
    connected = false

    jest.advanceTimersByTime(10_000)

    expect(statsMessages()).toEqual([])
  })
})
