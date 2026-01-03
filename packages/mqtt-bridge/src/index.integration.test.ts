import type { MqttBridgeConfig } from './types.js'
import {
  createMessageCollector,
  createTestBridgeConfig,
  publishAndWait,
  startTestBroker,
  subscribeAndWait,
  waitForAllClientsToDisconnect,
  waitForClientDisconnect,
  waitForClientReady,
  waitForSubscribe,
  waitForUnsubscribe,
  withBridge,
  withBridgeAndMockDriver,
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

      await withBridge(config, (bridge) => {
        const status = bridge.getStatus()
        expect(status.mqttConnected).toBe(true)
      })
    })

    test('should connect with authentication', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
          username: 'testuser',
          password: 'testpass',
        },
      }

      await withBridge(config, (bridge) => {
        const status = bridge.getStatus()
        expect(status.mqttConnected).toBe(true)
      })
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
      await withBridge(createTestBridgeConfig(broker), async (bridge) => {
        const collector = createMessageCollector()

        await subscribeAndWait(bridge, broker, 'test/topic', collector.handler)
        await publishAndWait(bridge, broker, 'test/topic', 'Hello, MQTT!')

        expect(collector.messages).toContain('Hello, MQTT!')
      })
    })

    test('should handle multiple subscriptions', async () => {
      await withBridge(createTestBridgeConfig(broker), async (bridge) => {
        const collector1 = createMessageCollector()
        const collector2 = createMessageCollector()

        await subscribeAndWait(bridge, broker, 'topic1', collector1.handler)
        await subscribeAndWait(bridge, broker, 'topic2', collector2.handler)

        await publishAndWait(bridge, broker, 'topic1', 'Message 1')
        await publishAndWait(bridge, broker, 'topic2', 'Message 2')

        expect(collector1.messages).toContain('Message 1')
        expect(collector2.messages).toContain('Message 2')
        expect(collector1.messages).not.toContain('Message 2')
        expect(collector2.messages).not.toContain('Message 1')
      })
    })

    test('should unsubscribe from topics', async () => {
      await withBridge(createTestBridgeConfig(broker), async (bridge) => {
        const collector = createMessageCollector()

        await subscribeAndWait(bridge, broker, 'test/topic', collector.handler)
        await publishAndWait(bridge, broker, 'test/topic', 'Before unsubscribe')

        const unsubscribePromise = waitForUnsubscribe(broker, 'modbus/test/topic')
        await bridge.unsubscribe('test/topic')
        await unsubscribePromise

        await publishAndWait(bridge, broker, 'test/topic', 'After unsubscribe')

        expect(collector.messages).toContain('Before unsubscribe')
        expect(collector.messages).not.toContain('After unsubscribe')
        expect(collector.messages).toHaveLength(1)
      })
    })

    test('should respect topic prefix', async () => {
      await withBridge(
        createTestBridgeConfig(broker, { topicPrefix: 'custom' }),
        async (bridge) => {
          const receivedMessages: Array<{ topic: string; payload: string }> = []

          await subscribeAndWait(
            bridge,
            broker,
            'test',
            (message) => {
              receivedMessages.push({
                topic: message.topic,
                payload: message.payload.toString(),
              })
            },
            { prefix: 'custom' }
          )

          await publishAndWait(bridge, broker, 'test', 'Test message', { prefix: 'custom' })

          expect(receivedMessages).toHaveLength(1)
          expect(receivedMessages[0]!.topic).toBe('custom/test')
          expect(receivedMessages[0]!.payload).toBe('Test message')
        }
      )
    })

    test('should handle QoS levels', async () => {
      await withBridge(createTestBridgeConfig(broker), async (bridge) => {
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

        await publishAndWait(bridge, broker, 'qos/test', 'QoS 0 message', { qos: 0 })
        await publishAndWait(bridge, broker, 'qos/test', 'QoS 1 message', { qos: 1 })

        await messagesPromise

        expect(receivedMessages).toHaveLength(2)
      })
    })

    test('should handle QoS 2 messages', async () => {
      await withBridge(createTestBridgeConfig(broker), async (bridge) => {
        const receivedMessages: Array<{ qos: 0 | 1 | 2; payload: string }> = []
        const subscribePromise = waitForSubscribe(broker, 'modbus/qos/test')

        const messagePromise = new Promise<void>((resolve) => {
          void bridge.subscribe(
            'qos/test',
            (message) => {
              receivedMessages.push({
                qos: message.qos,
                payload: message.payload.toString(),
              })
              resolve()
            },
            { qos: 2 }
          )
        })

        await subscribePromise

        await publishAndWait(bridge, broker, 'qos/test', 'QoS 2 message', { qos: 2 })
        await messagePromise

        expect(receivedMessages).toHaveLength(1)
        expect(receivedMessages[0]?.qos).toBe(2)
        expect(receivedMessages[0]?.payload).toBe('QoS 2 message')
      })
    })

    test('should handle retained messages', async () => {
      await withBridge(createTestBridgeConfig(broker), async (bridge) => {
        // Publish a retained message before subscribing
        await publishAndWait(bridge, broker, 'retained/test', 'Retained message', { retain: true })

        const receivedMessages: Array<{ retain: boolean; payload: string }> = []
        const subscribePromise = waitForSubscribe(broker, 'modbus/retained/test')

        // Subscribe and receive the retained message
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
      })
    })
  })

  describe('Binary and Empty Payloads', () => {
    test('should handle binary payloads', async () => {
      await withBridge(createTestBridgeConfig(broker), async (bridge) => {
        const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04, 0xff])
        let receivedPayload: Buffer | undefined
        const subscribePromise = waitForSubscribe(broker, 'modbus/device/binary')

        const messagePromise = new Promise<void>((resolve) => {
          void bridge.subscribe('device/binary', (message) => {
            receivedPayload = message.payload
            resolve()
          })
        })

        await subscribePromise

        await publishAndWait(bridge, broker, 'device/binary', binaryData)
        await messagePromise

        expect(receivedPayload).toBeInstanceOf(Buffer)
        expect(receivedPayload).toEqual(binaryData)
      })
    })

    test('should handle empty payloads', async () => {
      await withBridge(createTestBridgeConfig(broker), async (bridge) => {
        let receivedPayload: Buffer | undefined
        const subscribePromise = waitForSubscribe(broker, 'modbus/device/clear')

        const messagePromise = new Promise<void>((resolve) => {
          void bridge.subscribe('device/clear', (message) => {
            receivedPayload = message.payload
            resolve()
          })
        })

        await subscribePromise

        await publishAndWait(bridge, broker, 'device/clear', '')
        await messagePromise

        expect(receivedPayload).toBeInstanceOf(Buffer)
        expect(receivedPayload?.length).toBe(0)
      })
    })

    test('should handle large payloads', async () => {
      await withBridge(createTestBridgeConfig(broker), async (bridge) => {
        const largePayload = Buffer.alloc(1024 * 100) // 100KB
        largePayload.fill('x')

        let receivedPayload: Buffer | undefined
        const subscribePromise = waitForSubscribe(broker, 'modbus/device/large')

        const messagePromise = new Promise<void>((resolve) => {
          void bridge.subscribe('device/large', (message) => {
            receivedPayload = message.payload
            resolve()
          })
        })

        await subscribePromise

        await publishAndWait(bridge, broker, 'device/large', largePayload)
        await messagePromise

        expect(receivedPayload?.length).toBe(largePayload.length)
        expect(receivedPayload).toEqual(largePayload)
      })
    })
  })

  describe('Message Handler Error Handling', () => {
    test('should not crash bridge when handler throws error', async () => {
      await withBridge(createTestBridgeConfig(broker), async (bridge) => {
        const errorCollector = createMessageCollector()
        const goodCollector = createMessageCollector()

        // Subscribe with a handler that throws
        await subscribeAndWait(bridge, broker, 'error/test', (message) => {
          const msg = message.payload.toString()
          errorCollector.messages.push(msg)
          throw new Error('Handler error')
        })

        // Subscribe to another topic with a good handler
        await subscribeAndWait(bridge, broker, 'good/test', goodCollector.handler)

        // Publish to error topic
        await publishAndWait(bridge, broker, 'error/test', 'Error message')

        // Bridge should still be running
        expect(bridge.getStatus().state).toBe('running')
        expect(errorCollector.messages).toContain('Error message')

        // Other handlers should still work
        await publishAndWait(bridge, broker, 'good/test', 'Good message')

        expect(goodCollector.messages).toContain('Good message')
      })
    })

    test('should track handler errors in status', async () => {
      await withBridge(createTestBridgeConfig(broker), async (bridge) => {
        await subscribeAndWait(bridge, broker, 'error/test', () => {
          throw new Error('Test handler error')
        })

        await publishAndWait(bridge, broker, 'error/test', 'Trigger error')

        const status = bridge.getStatus()
        expect(status.errors).toBeDefined()
        expect(status.errors?.length).toBeGreaterThan(0)
        expect(status.errors?.[0]).toContain('Handler error for modbus/error/test')
      })
    })
  })

  describe('Device Management', () => {
    test('should add and remove devices', async () => {
      await withBridgeAndMockDriver(broker, async (bridge, mocks) => {
        const deviceConfig = {
          deviceId: 'device1',
          driver: 'ya-modbus-driver-test',
          connection: {
            type: 'tcp' as const,
            host: 'localhost',
            port: 502,
            slaveId: 1,
          },
        }

        await bridge.addDevice(deviceConfig)
        expect(bridge.getStatus().deviceCount).toBe(1)

        // Verify complete DI chain: driver loader → transport manager → driver
        expect(mocks.mockLoadDriverFn).toHaveBeenCalledWith(
          expect.objectContaining({ driverPackage: 'ya-modbus-driver-test' })
        )
        expect(mocks.mockTransportManager.getTransport).toHaveBeenCalledWith(
          expect.objectContaining({
            host: 'localhost',
            port: 502,
            slaveId: 1,
          })
        )
        expect(mocks.mockDriver.initialize).toHaveBeenCalled()

        const device = bridge.getDevice('device1')
        expect(device).toBeDefined()
        expect(device?.deviceId).toBe('device1')

        await bridge.removeDevice('device1')
        expect(bridge.getStatus().deviceCount).toBe(0)

        // Verify driver was destroyed
        expect(mocks.mockDriver.destroy).toHaveBeenCalled()
      })
    })

    test('should list all devices', async () => {
      await withBridgeAndMockDriver(broker, async (bridge) => {
        const device1 = {
          deviceId: 'device1',
          driver: 'ya-modbus-driver-test1',
          connection: {
            type: 'tcp' as const,
            host: 'localhost',
            port: 502,
            slaveId: 1,
          },
        }

        const device2 = {
          deviceId: 'device2',
          driver: 'ya-modbus-driver-test2',
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
      })
    })

    test('should create independent driver instances for multiple devices', async () => {
      await withBridgeAndMockDriver(broker, async (bridge, mocks) => {
        const device1 = {
          deviceId: 'device1',
          driver: 'ya-modbus-driver-test1',
          connection: {
            type: 'tcp' as const,
            host: 'localhost',
            port: 502,
            slaveId: 1,
          },
        }

        const device2 = {
          deviceId: 'device2',
          driver: 'ya-modbus-driver-test2',
          connection: {
            type: 'tcp' as const,
            host: 'localhost',
            port: 503,
            slaveId: 2,
          },
        }

        await bridge.addDevice(device1)
        await bridge.addDevice(device2)

        // Verify each device triggered independent driver and transport creation
        expect(mocks.mockLoadDriverFn).toHaveBeenCalledTimes(2)
        expect(mocks.mockLoadDriverFn).toHaveBeenCalledWith(
          expect.objectContaining({ driverPackage: 'ya-modbus-driver-test1' })
        )
        expect(mocks.mockLoadDriverFn).toHaveBeenCalledWith(
          expect.objectContaining({ driverPackage: 'ya-modbus-driver-test2' })
        )

        expect(mocks.mockTransportManager.getTransport).toHaveBeenCalledTimes(2)
        expect(mocks.mockTransportManager.getTransport).toHaveBeenCalledWith(
          expect.objectContaining({ port: 502, slaveId: 1 })
        )
        expect(mocks.mockTransportManager.getTransport).toHaveBeenCalledWith(
          expect.objectContaining({ port: 503, slaveId: 2 })
        )
      })
    })
  })

  describe('Reconnection Behavior', () => {
    test('should reconnect after broker restart', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
          reconnectPeriod: 100,
        },
      }

      await withBridge(config, async (bridge) => {
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
      })
    })

    test('should resubscribe to topics after reconnection', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
          reconnectPeriod: 100,
        },
      }

      await withBridge(config, async (bridge) => {
        const collector = createMessageCollector()

        await subscribeAndWait(bridge, broker, 'test/topic', collector.handler)
        await publishAndWait(bridge, broker, 'test/topic', 'Before disconnect')

        expect(collector.messages).toContain('Before disconnect')

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
        await publishAndWait(bridge, broker, 'test/topic', 'After reconnection')

        expect(collector.messages).toContain('After reconnection')
      })
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
      const config = createTestBridgeConfig(broker)
      const bridge = createBridge(config)

      // Try to call method without starting
      await expect(bridge[method](...args)).rejects.toThrow(error)
    })

    test('should handle connection to invalid broker', async () => {
      const config = createTestBridgeConfig(broker, {
        mqtt: { url: 'mqtt://localhost:99999', reconnectPeriod: 100 },
      })

      const bridge = createBridge(config)

      // Should reject on connection failure
      await expect(bridge.start()).rejects.toThrow()
    })

    test('should handle stop when never started', async () => {
      const config = createTestBridgeConfig(broker)
      const bridge = createBridge(config)

      // Stop without starting - client will be null
      await expect(bridge.stop()).resolves.not.toThrow()

      const status = bridge.getStatus()
      expect(status.state).toBe('stopped')
    })

    test('should handle multiple concurrent stop calls', async () => {
      const config = createTestBridgeConfig(broker)
      const bridge = createBridge(config)

      await bridge.start()

      // Call stop multiple times concurrently
      const stopPromises = [bridge.stop(), bridge.stop(), bridge.stop()]

      await expect(Promise.all(stopPromises)).resolves.not.toThrow()

      const status = bridge.getStatus()
      expect(status.state).toBe('stopped')

      await waitForAllClientsToDisconnect(broker)
    })
  })
})
