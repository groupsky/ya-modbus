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
  subscribe: jest.Mock<
    (topic: string | string[], opts: object, cb?: (error?: Error) => void) => void
  >
  unsubscribe: jest.Mock<(topic: string | string[], cb?: (error?: Error) => void) => void>
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
      subscribe: jest.fn((topic, opts, cb) => {
        if (typeof cb === 'function') {
          cb()
        }
      }),
      unsubscribe: jest.fn((topic, cb) => {
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

  describe('subscribe', () => {
    it('should subscribe to topic with prefix', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      const handler = jest.fn()
      await bridge.subscribe('config/devices/add', handler)

      expect(mockClient.subscribe).toHaveBeenCalledWith(
        'modbus/config/devices/add',
        { qos: 0 },
        expect.any(Function)
      )
    })

    it('should subscribe with custom topic prefix', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
        topicPrefix: 'custom',
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      const handler = jest.fn()
      await bridge.subscribe('config/devices/add', handler)

      expect(mockClient.subscribe).toHaveBeenCalledWith(
        'custom/config/devices/add',
        { qos: 0 },
        expect.any(Function)
      )
    })

    it('should subscribe with QoS option', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      const handler = jest.fn()
      await bridge.subscribe('device1/data', handler, { qos: 1 })

      expect(mockClient.subscribe).toHaveBeenCalledWith(
        'modbus/device1/data',
        { qos: 1 },
        expect.any(Function)
      )
    })

    it('should call handler when message received', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      const handler = jest.fn()
      await bridge.subscribe('device1/data', handler)

      const payload = Buffer.from('test message')
      const packet = { qos: 1, retain: false }
      emitEvent('message', 'modbus/device1/data', payload, packet)

      expect(handler).toHaveBeenCalledWith({
        topic: 'modbus/device1/data',
        payload,
        qos: 1,
        retain: false,
      })
    })

    it('should not call handler for unsubscribed topic', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      const handler1 = jest.fn()
      const handler2 = jest.fn()
      await bridge.subscribe('device1/data', handler1)
      await bridge.subscribe('device2/data', handler2)

      const payload = Buffer.from('test message')
      const packet = { qos: 0, retain: false }
      emitEvent('message', 'modbus/device1/data', payload, packet)

      expect(handler1).toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    it('should reject when client not initialized', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const handler = jest.fn()
      await expect(bridge.subscribe('device1/data', handler)).rejects.toThrow(
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

      const handler = jest.fn()
      await expect(bridge.subscribe('device1/data', handler)).rejects.toThrow(
        'MQTT client not connected'
      )
    })

    it('should reject when subscribe fails', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      const subscribeError = new Error('Subscribe failed')
      mockClient.subscribe.mockImplementationOnce((topic, opts, cb) => {
        if (typeof cb === 'function') {
          cb(subscribeError)
        }
      })

      const handler = jest.fn()
      await expect(bridge.subscribe('device1/data', handler)).rejects.toThrow('Subscribe failed')
    })
  })

  describe('unsubscribe', () => {
    it('should unsubscribe from topic with prefix', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      const handler = jest.fn()
      await bridge.subscribe('device1/data', handler)
      await bridge.unsubscribe('device1/data')

      expect(mockClient.unsubscribe).toHaveBeenCalledWith(
        'modbus/device1/data',
        expect.any(Function)
      )
    })

    it('should not call handler after unsubscribe', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      const handler = jest.fn()
      await bridge.subscribe('device1/data', handler)
      await bridge.unsubscribe('device1/data')

      const payload = Buffer.from('test message')
      const packet = { qos: 0, retain: false }
      emitEvent('message', 'modbus/device1/data', payload, packet)

      expect(handler).not.toHaveBeenCalled()
    })

    it('should reject when client not initialized', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      await expect(bridge.unsubscribe('device1/data')).rejects.toThrow(
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

      await expect(bridge.unsubscribe('device1/data')).rejects.toThrow('MQTT client not connected')
    })

    it('should reject when unsubscribe fails', async () => {
      const bridge = createBridge({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })

      const startPromise = bridge.start()
      emitEvent('connect')
      await startPromise

      const unsubscribeError = new Error('Unsubscribe failed')
      mockClient.unsubscribe.mockImplementationOnce((topic, cb) => {
        if (typeof cb === 'function') {
          cb(unsubscribeError)
        }
      })

      await expect(bridge.unsubscribe('device1/data')).rejects.toThrow('Unsubscribe failed')
    })
  })
})
