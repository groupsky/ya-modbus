import type { EventEmitter } from 'events'

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import mqtt from 'mqtt'

import { createBridge } from './index.js'

jest.mock('mqtt')

const mockedMqtt = mqtt as jest.Mocked<typeof mqtt>

interface MockMqttClient extends EventEmitter {
  end: jest.Mock<(force?: boolean, opts?: object, cb?: () => void) => void>
  connected: boolean
}

describe('createBridge', () => {
  let mockClient: MockMqttClient
  let eventHandlers: Map<string, ((...args: unknown[]) => void)[]>

  beforeEach(() => {
    eventHandlers = new Map()

    mockClient = {
      on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!eventHandlers.has(event)) {
          eventHandlers.set(event, [])
        }
        eventHandlers.get(event)?.push(handler)
        return mockClient
      }),
      end: jest.fn((force, opts, cb) => {
        if (typeof cb === 'function') {
          cb()
        }
      }),
      connected: false,
    } as unknown as MockMqttClient

    mockedMqtt.connect.mockReturnValue(mockClient as unknown as mqtt.MqttClient)
  })

  const emitEvent = (event: string, ...args: unknown[]): void => {
    const handlers = eventHandlers.get(event) ?? []
    handlers.forEach((handler) => handler(...args))
  }

  it('should create a bridge instance', () => {
    const bridge = createBridge({
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
    })

    expect(bridge).toBeDefined()
    expect(bridge.start).toBeInstanceOf(Function)
    expect(bridge.stop).toBeInstanceOf(Function)
    expect(bridge.getStatus).toBeInstanceOf(Function)
  })

  it('should have initial status as stopped and not connected', () => {
    const bridge = createBridge({
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
    })

    const status = bridge.getStatus()
    expect(status.state).toBe('stopped')
    expect(status.deviceCount).toBe(0)
    expect(status.mqttConnected).toBe(false)
  })

  it('should connect to MQTT broker when started', async () => {
    const bridge = createBridge({
      mqtt: {
        url: 'mqtt://test-broker:1883',
        clientId: 'test-client',
        username: 'user',
        password: 'pass',
      },
    })

    const startPromise = bridge.start()
    emitEvent('connect')
    await startPromise

    expect(mockedMqtt.connect).toHaveBeenCalledWith('mqtt://test-broker:1883', {
      clientId: 'test-client',
      username: 'user',
      password: 'pass',
      clean: true,
      reconnectPeriod: 5000,
    })

    const status = bridge.getStatus()
    expect(status.state).toBe('running')
    expect(status.mqttConnected).toBe(true)
  })

  it('should handle MQTT connection errors', async () => {
    const bridge = createBridge({
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
    })

    const startPromise = bridge.start()
    const error = new Error('Connection failed')
    emitEvent('error', error)

    await expect(startPromise).rejects.toThrow('Connection failed')

    const status = bridge.getStatus()
    expect(status.state).toBe('error')
    expect(status.mqttConnected).toBe(false)
    expect(status.errors).toEqual(['Connection failed'])
  })

  it('should disconnect from MQTT broker when stopped', async () => {
    const bridge = createBridge({
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
    })

    const startPromise = bridge.start()
    emitEvent('connect')
    await startPromise

    await bridge.stop()

    expect(mockClient.end).toHaveBeenCalled()

    const status = bridge.getStatus()
    expect(status.state).toBe('stopped')
    expect(status.mqttConnected).toBe(false)
  })

  it('should handle stop when not connected', async () => {
    const bridge = createBridge({
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
    })

    await bridge.stop()

    const status = bridge.getStatus()
    expect(status.state).toBe('stopped')
    expect(status.mqttConnected).toBe(false)
  })

  it('should update status when MQTT disconnects', async () => {
    const bridge = createBridge({
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
    })

    const startPromise = bridge.start()
    emitEvent('connect')
    await startPromise

    emitEvent('disconnect')

    const status = bridge.getStatus()
    expect(status.mqttConnected).toBe(false)
  })

  it('should update status when MQTT goes offline', async () => {
    const bridge = createBridge({
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
    })

    const startPromise = bridge.start()
    emitEvent('connect')
    await startPromise

    emitEvent('offline')

    const status = bridge.getStatus()
    expect(status.mqttConnected).toBe(false)
  })
})
