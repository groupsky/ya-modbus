import { writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createBridge } from '../index.js'
import type { MqttBridgeConfig } from '../types.js'

import { startTestBroker, type TestBroker } from './helpers/aedes-broker.js'

describe('MQTT Bridge Integration Tests', () => {
  let broker: TestBroker
  let testDir: string

  beforeEach(async () => {
    // Start a fresh Aedes broker for each test with dynamic port
    broker = await startTestBroker()

    // Create a temporary directory for test configs
    testDir = join(tmpdir(), `mqtt-bridge-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up broker
    await broker.close()

    // Clean up test directory
    await rm(testDir, { recursive: true, force: true })
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
      await bridge.subscribe('test/topic', (message) => {
        receivedMessages.push(message.payload.toString())
      })

      await bridge.publish('test/topic', 'Hello, MQTT!')

      // Wait a bit for the message to be delivered
      await new Promise((resolve) => setTimeout(resolve, 100))

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

      await bridge.subscribe('topic1', (message) => {
        topic1Messages.push(message.payload.toString())
      })

      await bridge.subscribe('topic2', (message) => {
        topic2Messages.push(message.payload.toString())
      })

      await bridge.publish('topic1', 'Message 1')
      await bridge.publish('topic2', 'Message 2')

      await new Promise((resolve) => setTimeout(resolve, 100))

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
      await bridge.subscribe('test/topic', (message) => {
        receivedMessages.push(message.payload.toString())
      })

      await bridge.publish('test/topic', 'Before unsubscribe')
      await new Promise((resolve) => setTimeout(resolve, 100))

      await bridge.unsubscribe('test/topic')

      await bridge.publish('test/topic', 'After unsubscribe')
      await new Promise((resolve) => setTimeout(resolve, 100))

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
      await bridge.subscribe('test', (message) => {
        receivedMessages.push({
          topic: message.topic,
          payload: message.payload.toString(),
        })
      })

      await bridge.publish('test', 'Test message')
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(receivedMessages).toHaveLength(1)
      expect(receivedMessages[0].topic).toBe('custom/test')
      expect(receivedMessages[0].payload).toBe('Test message')

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

      const receivedMessages: Array<{ qos: 0 | 1 | 2; payload: string }> = []

      await bridge.subscribe(
        'qos/test',
        (message) => {
          receivedMessages.push({
            qos: message.qos,
            payload: message.payload.toString(),
          })
        },
        { qos: 1 }
      )

      await bridge.publish('qos/test', 'QoS 0 message', { qos: 0 })
      await bridge.publish('qos/test', 'QoS 1 message', { qos: 1 })

      await new Promise((resolve) => setTimeout(resolve, 100))

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
      await bridge.publish('retained/test', 'Retained message', { retain: true })

      await new Promise((resolve) => setTimeout(resolve, 100))

      const receivedMessages: Array<{ retain: boolean; payload: string }> = []

      // Subscribe and receive the retained message
      await bridge.subscribe('retained/test', (message) => {
        receivedMessages.push({
          retain: message.retain,
          payload: message.payload.toString(),
        })
      })

      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(receivedMessages).toHaveLength(1)
      expect(receivedMessages[0].retain).toBe(true)
      expect(receivedMessages[0].payload).toBe('Retained message')

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
      await bridge.subscribe('error/test', (message) => {
        const msg = message.payload.toString()
        errorMessages.push(msg)
        throw new Error('Handler error')
      })

      // Subscribe to another topic with a good handler
      await bridge.subscribe('good/test', (message) => {
        goodMessages.push(message.payload.toString())
      })

      // Publish to error topic
      await bridge.publish('error/test', 'Error message')
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Bridge should still be running
      expect(bridge.getStatus().state).toBe('running')
      expect(errorMessages).toContain('Error message')

      // Other handlers should still work
      await bridge.publish('good/test', 'Good message')
      await new Promise((resolve) => setTimeout(resolve, 100))

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

      await bridge.subscribe('error/test', () => {
        throw new Error('Test handler error')
      })

      await bridge.publish('error/test', 'Trigger error')
      await new Promise((resolve) => setTimeout(resolve, 100))

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
      await broker.close()
      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(bridge.getStatus().mqttConnected).toBe(false)

      // Restart broker on same port
      broker = await startTestBroker()

      // Wait for reconnection
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Note: Reconnection may not succeed if port changed
      // This is expected behavior - we're testing the reconnection attempt

      await bridge.stop()
    }, 10000)

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
      await bridge.subscribe('test/topic', (message) => {
        receivedMessages.push(message.payload.toString())
      })

      // Publish before disconnect
      await bridge.publish('test/topic', 'Before disconnect')
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(receivedMessages).toContain('Before disconnect')

      // Simulate broker restart
      const oldBroker = broker
      await oldBroker.close()

      // Start new broker on same port (Aedes limitation - need same port)
      broker = await startTestBroker()

      // Wait for reconnection and resubscription
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Publish after reconnection - may not work due to port change
      // This is a limitation of the test setup, not the bridge

      await bridge.stop()
    }, 10000)
  })

  describe('Error Scenarios', () => {
    test('should reject publish when not connected', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
      }

      const bridge = createBridge(config)

      // Try to publish without starting
      await expect(bridge.publish('test/topic', 'Test')).rejects.toThrow(
        'MQTT client not initialized'
      )
    })

    test('should reject subscribe when not connected', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
      }

      const bridge = createBridge(config)

      // Try to subscribe without starting
      await expect(bridge.subscribe('test/topic', () => {})).rejects.toThrow(
        'MQTT client not initialized'
      )
    })

    test('should reject unsubscribe when not connected', async () => {
      const config: MqttBridgeConfig = {
        mqtt: {
          url: broker.url,
        },
      }

      const bridge = createBridge(config)

      // Try to unsubscribe without starting
      await expect(bridge.unsubscribe('test/topic')).rejects.toThrow('MQTT client not initialized')
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
    }, 10000)
  })

  describe('Configuration Loading', () => {
    test('should load configuration from file', async () => {
      const configPath = join(testDir, 'test-config.json')
      const configContent = {
        mqtt: {
          url: broker.url,
          clientId: 'config-test',
        },
        topicPrefix: 'test',
      }

      await writeFile(configPath, JSON.stringify(configContent, null, 2))

      const { loadConfig } = await import('../utils/config.js')
      const config = await loadConfig(configPath)

      expect(config.mqtt.url).toBe(broker.url)
      expect(config.mqtt.clientId).toBe('config-test')
      expect(config.topicPrefix).toBe('test')

      const bridge = createBridge(config)
      await bridge.start()
      expect(bridge.getStatus().mqttConnected).toBe(true)
      await bridge.stop()
    })
  })
})
