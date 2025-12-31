import type { EventEmitter } from 'events'

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import mqtt from 'mqtt'

import { createBridge } from './index.js'

jest.mock('mqtt')

const mockedMqtt = mqtt as jest.Mocked<typeof mqtt>

interface MockMqttClient extends EventEmitter {
  end: jest.Mock<(force?: boolean, opts?: object, cb?: () => void) => void>
  publish: jest.Mock<
    (topic: string, payload: string | Buffer, opts: object, cb?: (error?: Error) => void) => void
  >
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
      publish: jest.fn((topic, payload, opts, cb) => {
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

  describe('publish', () => {
    it('should publish message to topic with prefix', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      await bridge.publish('device1/data', 'test payload')

      expect(mockClient.publish).toHaveBeenCalledWith(
        'modbus/device1/data',
        'test payload',
        {},
        expect.any(Function)
      )
    })

    it('should publish message with custom topic prefix', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
        topicPrefix: 'custom',
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      await bridge.publish('device1/status', 'status payload')

      expect(mockClient.publish).toHaveBeenCalledWith(
        'custom/device1/status',
        'status payload',
        {},
        expect.any(Function)
      )
    })

    it('should publish message with QoS option', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      await bridge.publish('device1/data', 'test payload', { qos: 1 })

      expect(mockClient.publish).toHaveBeenCalledWith(
        'modbus/device1/data',
        'test payload',
        { qos: 1 },
        expect.any(Function)
      )
    })

    it('should publish message with retain option', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      await bridge.publish('device1/status', 'status', { retain: true })

      expect(mockClient.publish).toHaveBeenCalledWith(
        'modbus/device1/status',
        'status',
        { retain: true },
        expect.any(Function)
      )
    })

    it('should publish message with QoS and retain options', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      await bridge.publish('bridge/status', 'online', {
        qos: 2,
        retain: true,
      })

      expect(mockClient.publish).toHaveBeenCalledWith(
        'modbus/bridge/status',
        'online',
        { qos: 2, retain: true },
        expect.any(Function)
      )
    })

    it('should publish Buffer payload', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      const buffer = Buffer.from('binary data')
      await bridge.publish('device1/data', buffer)

      expect(mockClient.publish).toHaveBeenCalledWith(
        'modbus/device1/data',
        buffer,
        {},
        expect.any(Function)
      )
    })

    it('should reject when client not initialized', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      await expect(bridge.publish('device1/data', 'payload')).rejects.toThrow(
        'MQTT client not initialized'
      )
    })

    it('should reject when client not connected', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      emitEvent('disconnect')

      await expect(bridge.publish('device1/data', 'payload')).rejects.toThrow(
        'MQTT client not connected'
      )
    })

    it('should reject when publish fails', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      const publishError = new Error('Publish failed')
      mockClient.publish.mockImplementationOnce((topic, payload, opts, cb) => {
        if (typeof cb === 'function') {
          cb(publishError)
        }
      })

      await expect(bridge.publish('device1/data', 'payload')).rejects.toThrow('Publish failed')
    })
  })
})
