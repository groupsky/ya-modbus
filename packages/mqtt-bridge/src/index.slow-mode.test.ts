import type { EventEmitter } from 'events'

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import mqtt from 'mqtt'

import { DeviceManager } from './device-manager.js'
import { DriverLoader } from './driver-loader.js'
import { PollingScheduler } from './polling-scheduler.js'

import { createBridge } from './index.js'

jest.mock('mqtt')
jest.mock('./device-manager.js')
jest.mock('./driver-loader.js')
jest.mock('./polling-scheduler.js')

const MockedDeviceManager = DeviceManager as jest.MockedClass<typeof DeviceManager>
const MockedDriverLoader = DriverLoader as jest.MockedClass<typeof DriverLoader>
const MockedPollingScheduler = PollingScheduler as jest.MockedClass<typeof PollingScheduler>

describe('createBridge slow mode log', () => {
  let errorCallback: (deviceId: string, error: Error, failureCount: number) => void
  let mockDeviceManager: any
  let warnSpy: jest.SpyInstance
  let errorSpy: jest.SpyInstance

  beforeEach(async () => {
    jest.clearAllMocks()
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const handlers = new Map<string, (...args: unknown[]) => void>()
    const client = {
      on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
        handlers.set(event, handler)
        return client
      }),
      removeAllListeners: jest.fn(),
      end: jest.fn((_force: unknown, _opts: unknown, cb?: () => void) => cb?.()),
      publish: jest.fn((_t: unknown, _p: unknown, _o: unknown, cb?: () => void) => cb?.()),
      subscribe: jest.fn((_t: unknown, _o: unknown, cb?: () => void) => cb?.()),
      unsubscribe: jest.fn((_t: unknown, cb?: () => void) => cb?.()),
      connected: true,
    } as unknown as EventEmitter
    ;(mqtt as jest.Mocked<typeof mqtt>).connect.mockReturnValue(
      client as unknown as mqtt.MqttClient
    )

    mockDeviceManager = {
      getDevice: jest.fn(),
      getDeviceConfig: jest.fn(),
      updateDeviceState: jest.fn(),
    }
    MockedDeviceManager.mockReturnValue(mockDeviceManager)
    MockedDriverLoader.mockReturnValue({ closeAllTransports: jest.fn() } as any)
    MockedPollingScheduler.mockImplementation((_onData, onError) => {
      errorCallback = onError
      return { start: jest.fn(), stop: jest.fn() } as any
    })

    const startPromise = createBridge({ mqtt: { url: 'mqtt://localhost:1883' } }).start()
    handlers.get('connect')?.()
    await startPromise
  })

  afterEach(() => {
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('should log one line when the failure count reaches maxRetries, and no other', () => {
    for (let failure = 1; failure <= 6; failure++) {
      errorCallback('device1', new Error('Timed out'), failure)
    }

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith(
      'Device device1 failed 3 polls in a row and is now polled less often: ' +
        'the wait starts at polling.retryBackoff and doubles up to polling.maxRetryBackoff'
    )
  })

  it.each([0, 1])('should log at the first failure with maxRetries %i', (maxRetries) => {
    mockDeviceManager.getDeviceConfig.mockReturnValue({ polling: { interval: 1000, maxRetries } })

    errorCallback('device1', new Error('Timed out'), 1)
    errorCallback('device1', new Error('Timed out'), 2)

    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('failed 1 poll in a row'))
  })
})
