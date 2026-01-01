import type { MqttBridgeConfig } from './types.js'
import {
  startTestBroker,
  waitForAllClientsToDisconnect,
  waitForClientDisconnect,
  waitForClientReady,
  waitForPublish,
  waitForSubscribe,
  waitForUnsubscribe,
  type TestBroker,
} from './utils/test-utils.js'

import { createBridge } from './index.js'

describe('MQTT Bridge Integration Tests', () => {
  let broker: TestBroker

  beforeEach(async () => {
    // Start a fresh Aedes broker for each test with dynamic port
    broker = await startTestBroker()
  })

  afterEach(async () => {
    // Clean up broker
    await broker.close()
  })

  describe('Bridge Lifecycle', () => {
    test('should start and stop bridge successfully', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
      }

      const bridge = createBridge(config)

      // Start bridge
      await bridge.start()
      const status = bridge.getStatus()
      expect(status.state).toBe('running')
      expect(status.mqttConnected).toBe(true)

      // Stop bridge
      await bridge.stop()
      const stoppedStatus = bridge.getStatus()
      expect(stoppedStatus.state).toBe('stopped')
      expect(stoppedStatus.mqttConnected).toBe(false)
    })

    test('should connect with client ID', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
          clientId: 'test-client-123',
        },
      }

      const bridge = createBridge(config)
      await bridge.start()

      const status = bridge.getStatus()
      expect(status.mqttConnected).toBe(true)

      await bridge.stop()
    })

    test('should connect with authentication', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
          username: 'testuser',
          password: 'testpass',
        },
      }

      const bridge = createBridge(config)
      await bridge.start()

      const status = bridge.getStatus()
      expect(status.mqttConnected).toBe(true)

      await bridge.stop()
    })

    test('should handle multiple start/stop cycles', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
      }

      const bridge = createBridge(config)

      // First cycle
      await bridge.start()
      expect(bridge.getStatus().state).toBe('running')
      await bridge.stop()
      expect(bridge.getStatus().state).toBe('stopped')

      // Second cycle - should work without issues
      await bridge.start()
      expect(bridge.getStatus().state).toBe('running')
      await bridge.stop()
      expect(bridge.getStatus().state).toBe('stopped')
    })
  })

  describe('Publish/Subscribe Operations', () => {
    test('should publish and receive messages', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
      }

      const bridge = createBridge(config)
      await bridge.start()

      const receivedMessages: string[] = []

      // Set up subscription listener before subscribing
      const subscribePromise = waitForSubscribe(broker, 'modbus/test/topic')
      await bridge.subscribe('test/topic', (message) => {
        receivedMessages.push(message.payload.toString())
      })
      await subscribePromise

      // Set up publish listener before publishing
      const publishPromise = waitForPublish(broker, 'modbus/test/topic')
      await bridge.publish('test/topic', 'Hello, MQTT!')
      await publishPromise

      expect(receivedMessages).toContain('Hello, MQTT!')

      await bridge.stop()
    })

    test('should handle multiple subscriptions', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
      }

      const bridge = createBridge(config)
      await bridge.start()

      const topic1Messages: string[] = []
      const topic2Messages: string[] = []

      const subscribe1Promise = waitForSubscribe(broker, 'modbus/topic1')
      await bridge.subscribe('topic1', (message) => {
        topic1Messages.push(message.payload.toString())
      })
      await subscribe1Promise

      const subscribe2Promise = waitForSubscribe(broker, 'modbus/topic2')
      await bridge.subscribe('topic2', (message) => {
        topic2Messages.push(message.payload.toString())
      })
      await subscribe2Promise

      const publish1Promise = waitForPublish(broker, 'modbus/topic1')
      await bridge.publish('topic1', 'Message 1')
      await publish1Promise

      const publish2Promise = waitForPublish(broker, 'modbus/topic2')
      await bridge.publish('topic2', 'Message 2')
      await publish2Promise

      expect(topic1Messages).toContain('Message 1')
      expect(topic2Messages).toContain('Message 2')
      expect(topic1Messages).not.toContain('Message 2')
      expect(topic2Messages).not.toContain('Message 1')

      await bridge.stop()
    })

    test('should unsubscribe from topics', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
      }

      const bridge = createBridge(config)
      await bridge.start()

      const receivedMessages: string[] = []

      const subscribePromise = waitForSubscribe(broker, 'modbus/test/topic')
      await bridge.subscribe('test/topic', (message) => {
        receivedMessages.push(message.payload.toString())
      })
      await subscribePromise

      const publish1Promise = waitForPublish(broker, 'modbus/test/topic')
      await bridge.publish('test/topic', 'Before unsubscribe')
      await publish1Promise

      const unsubscribePromise = waitForUnsubscribe(broker, 'modbus/test/topic')
      await bridge.unsubscribe('test/topic')
      await unsubscribePromise

      const publish2Promise = waitForPublish(broker, 'modbus/test/topic')
      await bridge.publish('test/topic', 'After unsubscribe')
      await publish2Promise

      expect(receivedMessages).toContain('Before unsubscribe')
      expect(receivedMessages).not.toContain('After unsubscribe')
      expect(receivedMessages).toHaveLength(1)

      await bridge.stop()
    })

    test('should respect topic prefix', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
        topicPrefix: 'custom',
      }

      const bridge = createBridge(config)
      await bridge.start()

      const receivedMessages: Array<{ topic: string; payload: string }> = []

      // Subscribe to the full topic to verify prefix
      const subscribePromise = waitForSubscribe(broker, 'custom/test')
      await bridge.subscribe('test', (message) => {
        receivedMessages.push({
          topic: message.topic,
          payload: message.payload.toString(),
        })
      })
      await subscribePromise

      const publishPromise = waitForPublish(broker, 'custom/test')
      await bridge.publish('test', 'Test message')
      await publishPromise

      expect(receivedMessages).toHaveLength(1)
      expect(receivedMessages[0]!.topic).toBe('custom/test')
      expect(receivedMessages[0]!.payload).toBe('Test message')

      await bridge.stop()
    })

    test('should handle QoS levels', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
      }

      const bridge = createBridge(config)
      await bridge.start()

      let messageCount = 0
      const receivedMessages: Array<{ qos: 0 | 1 | 2; payload: string }> = []
      const subscribePromise = waitForSubscribe(broker, 'modbus/qos/test')

      const messagesPromise = new Promise<void>((resolve) => {
        const checkMessages = (): void => {
          if (messageCount === 2) resolve()
        }
        void bridge.subscribe(
          'qos/test',
          (message) => {
            receivedMessages.push({
              qos: message.qos,
              payload: message.payload.toString(),
            })
            messageCount++
            checkMessages()
          },
          { qos: 1 }
        )
      })

      await subscribePromise

      const publish1Promise = waitForPublish(broker, 'modbus/qos/test')
      await bridge.publish('qos/test', 'QoS 0 message', { qos: 0 })
      await publish1Promise

      const publish2Promise = waitForPublish(broker, 'modbus/qos/test')
      await bridge.publish('qos/test', 'QoS 1 message', { qos: 1 })
      await publish2Promise

      await messagesPromise

      expect(receivedMessages).toHaveLength(2)

      await bridge.stop()
    })

    test('should handle retained messages', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
      }

      const bridge = createBridge(config)
      await bridge.start()

      // Publish a retained message before subscribing
      const publish1Promise = waitForPublish(broker, 'modbus/retained/test')
      await bridge.publish('retained/test', 'Retained message', { retain: true })
      await publish1Promise

      const receivedMessages: Array<{ retain: boolean; payload: string }> = []
      const subscribePromise = waitForSubscribe(broker, 'modbus/retained/test')

      // Subscribe and receive the retained message
      // Use a promise to wait for the message to be received
      const messagePromise = new Promise<void>((resolve) => {
        void bridge.subscribe('retained/test', (message) => {
          receivedMessages.push({
            retain: message.retain,
            payload: message.payload.toString(),
          })
          resolve()
        })
      })

      await subscribePromise
      await messagePromise

      expect(receivedMessages).toHaveLength(1)
      expect(receivedMessages[0]!.retain).toBe(true)
      expect(receivedMessages[0]!.payload).toBe('Retained message')

      await bridge.stop()
    })
  })

  describe('Message Handler Error Handling', () => {
    test('should not crash bridge when handler throws error', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
      }

      const bridge = createBridge(config)
      await bridge.start()

      const errorMessages: string[] = []
      const goodMessages: string[] = []

      // Subscribe with a handler that throws
      const subscribe1Promise = waitForSubscribe(broker, 'modbus/error/test')
      await bridge.subscribe('error/test', (message) => {
        const msg = message.payload.toString()
        errorMessages.push(msg)
        throw new Error('Handler error')
      })
      await subscribe1Promise

      // Subscribe to another topic with a good handler
      const subscribe2Promise = waitForSubscribe(broker, 'modbus/good/test')
      await bridge.subscribe('good/test', (message) => {
        goodMessages.push(message.payload.toString())
      })
      await subscribe2Promise

      // Publish to error topic
      const errorPublishPromise = waitForPublish(broker, 'modbus/error/test')
      await bridge.publish('error/test', 'Error message')
      await errorPublishPromise

      // Bridge should still be running
      expect(bridge.getStatus().state).toBe('running')
      expect(errorMessages).toContain('Error message')

      // Other handlers should still work
      const goodPublishPromise = waitForPublish(broker, 'modbus/good/test')
      await bridge.publish('good/test', 'Good message')
      await goodPublishPromise

      expect(goodMessages).toContain('Good message')

      await bridge.stop()
    })

    test('should track handler errors in status', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
      }

      const bridge = createBridge(config)
      await bridge.start()

      const subscribePromise = waitForSubscribe(broker, 'modbus/error/test')
      await bridge.subscribe('error/test', () => {
        throw new Error('Test handler error')
      })
      await subscribePromise

      const publishPromise = waitForPublish(broker, 'modbus/error/test')
      await bridge.publish('error/test', 'Trigger error')
      await publishPromise

      const status = bridge.getStatus()
      expect(status.errors).toBeDefined()
      expect(status.errors?.length).toBeGreaterThan(0)
      expect(status.errors?.[0]).toContain('Handler error for modbus/error/test')

      await bridge.stop()
    })
  })

  describe('Device Management', () => {
    test('should add and remove devices', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
      }

      const bridge = createBridge(config)
      await bridge.start()

      const deviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: {
          type: 'tcp' as const,
          host: 'localhost',
          port: 502,
          slaveId: 1,
        },
      }

      await bridge.addDevice(deviceConfig)
      expect(bridge.getStatus().deviceCount).toBe(1)

      const device = bridge.getDevice('device1')
      expect(device).toBeDefined()
      expect(device?.deviceId).toBe('device1')

      await bridge.removeDevice('device1')
      expect(bridge.getStatus().deviceCount).toBe(0)

      await bridge.stop()
    })

    test('should list all devices', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
      }

      const bridge = createBridge(config)
      await bridge.start()

      const device1 = {
        deviceId: 'device1',
        driver: 'driver1',
        connection: {
          type: 'tcp' as const,
          host: 'localhost',
          port: 502,
          slaveId: 1,
        },
      }

      const device2 = {
        deviceId: 'device2',
        driver: 'driver2',
        connection: {
          type: 'rtu' as const,
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          slaveId: 2,
        },
      }

      await bridge.addDevice(device1)
      await bridge.addDevice(device2)

      const devices = bridge.listDevices()
      expect(devices).toHaveLength(2)
      expect(devices.map((d) => d.deviceId)).toContain('device1')
      expect(devices.map((d) => d.deviceId)).toContain('device2')

      await bridge.stop()
    })
  })

  describe('Reconnection Behavior', () => {
    test('should reconnect after broker restart', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
          reconnectPeriod: 100, // Fast reconnection for testing
        },
      }

      const bridge = createBridge(config)
      await bridge.start()

      expect(bridge.getStatus().mqttConnected).toBe(true)

      // Simulate broker going down
      const oldBroker = broker
      const disconnectPromise = waitForClientDisconnect(oldBroker, 1000)
      await oldBroker.close()
      await disconnectPromise

      // Wait for bridge to detect the disconnection by polling status
      const startTime = Date.now()
      while (bridge.getStatus().mqttConnected && Date.now() - startTime < 1000) {
        await new Promise((resolve) => setImmediate(resolve))
      }
      expect(bridge.getStatus().mqttConnected).toBe(false)

      // Restart broker on same port
      broker = await startTestBroker({ port: oldBroker.port })

      // Wait for client to reconnect
      await waitForClientReady(broker, 1000)

      await bridge.stop()
    })

    test('should resubscribe to topics after reconnection', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
          reconnectPeriod: 100,
        },
      }

      const bridge = createBridge(config)
      await bridge.start()

      const receivedMessages: string[] = []

      const subscribePromise = waitForSubscribe(broker, 'modbus/test/topic')
      await bridge.subscribe('test/topic', (message) => {
        receivedMessages.push(message.payload.toString())
      })
      await subscribePromise

      // Publish before disconnect
      const publishPromise = waitForPublish(broker, 'modbus/test/topic')
      await bridge.publish('test/topic', 'Before disconnect')
      await publishPromise

      expect(receivedMessages).toContain('Before disconnect')

      // Simulate broker restart
      const oldBroker = broker
      const disconnectPromise = waitForAllClientsToDisconnect(oldBroker, 1000)
      await oldBroker.close()
      await disconnectPromise

      // Start new broker on same port
      broker = await startTestBroker({ port: oldBroker.port })

      // Wait for reconnection and resubscription
      await waitForClientReady(broker, 1000)
      const resubscribePromise = waitForSubscribe(broker, 'modbus/test/topic')
      await resubscribePromise

      // Publish after reconnection to verify resubscription worked
      const publishAfterPromise = waitForPublish(broker, 'modbus/test/topic')
      await bridge.publish('test/topic', 'After reconnection')
      await publishAfterPromise

      expect(receivedMessages).toContain('After reconnection')

      await bridge.stop()
    })
  })

  describe('Error Scenarios', () => {
    test.each([
      {
        method: 'publish' as const,
        args: ['test/topic', 'Test'] as const,
        error: 'MQTT client not initialized',
      },
      {
        method: 'subscribe' as const,
        args: ['test/topic', () => {}] as const,
        error: 'MQTT client not initialized',
      },
      {
        method: 'unsubscribe' as const,
        args: ['test/topic'] as const,
        error: 'MQTT client not initialized',
      },
    ])('should reject $method when not connected', async ({ method, args, error }) => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
      }

      const bridge = createBridge(config)

      // Try to call method without starting
      await expect(bridge[method](...args)).rejects.toThrow(error)
    })

    test('should handle connection to invalid broker', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: 'mqtt://localhost:99999', // Invalid port
          reconnectPeriod: 100,
        },
      }

      const bridge = createBridge(config)

      // Should reject on connection failure
      await expect(bridge.start()).rejects.toThrow()
    })
  })
})
