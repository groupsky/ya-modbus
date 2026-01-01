import { AddressInfo, createServer, Server } from 'node:net'

import Aedes from 'aedes'
import type { AedesPublishPacket } from 'aedes'
import type { Client } from 'aedes'

import { createBridge } from '../index.js'
import type {
  MessageHandler,
  MqttBridge,
  MqttBridgeConfig,
  MqttMessage,
  PublishOptions,
  SubscribeOptions,
} from '../types.js'

export interface TestBroker {
  address: AddressInfo
  url: string
  port: number
  broker: Aedes
  server: Server
  close: () => Promise<void>
}

/**
 * Race a promise against a timeout, properly cleaning up the timer
 *
 * This ensures Jest can exit cleanly by clearing the timeout when the promise settles.
 * Always use this instead of bare Promise.race with setTimeout.
 *
 * @param promise - The promise to race
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message if timeout occurs, or a function that returns the message
 * @returns Promise that resolves/rejects with the first settled result
 *
 * @example
 * // With static message
 * await withTimeout(
 *   clientReadyPromise,
 *   5000,
 *   'Client ready timeout'
 * )
 *
 * @example
 * // With dynamic message (evaluated when timeout occurs)
 * await withTimeout(
 *   disconnectPromise,
 *   5000,
 *   () => `Still connected: ${broker.connectedClients}`
 * )
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string | (() => string)
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      const message = typeof errorMessage === 'function' ? errorMessage() : errorMessage
      reject(new Error(message))
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  })
}

/**
 * Wait for all MQTT clients to disconnect from a test broker
 *
 * @param broker - The test broker to monitor
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 5000)
 * @returns Promise that resolves when all clients disconnect or rejects on timeout
 *
 * @example
 * await waitForAllClientsToDisconnect(broker, 5000)
 */
export function waitForAllClientsToDisconnect(broker: TestBroker, timeoutMs = 5000): Promise<void> {
  if (broker.broker.connectedClients === 0) {
    return Promise.resolve()
  }

  let onDisconnect: (() => void) | undefined

  const disconnectPromise = new Promise<void>((resolve) => {
    onDisconnect = (): void => {
      if (broker.broker.connectedClients === 0) {
        if (onDisconnect) {
          broker.broker.off('clientDisconnect', onDisconnect)
        }
        resolve()
      }
    }
    broker.broker.on('clientDisconnect', onDisconnect)
  })

  return withTimeout(
    disconnectPromise,
    timeoutMs,
    () =>
      `Timeout waiting for clients to disconnect. Still connected: ${broker.broker.connectedClients}`
  ).finally(() => {
    if (onDisconnect) {
      broker.broker.off('clientDisconnect', onDisconnect)
    }
  })
}

/**
 * Wait for a client to be ready
 *
 * @param broker - The test broker to monitor
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 2000)
 * @returns Promise that resolves when a client is ready or rejects on timeout
 *
 * @example
 * await waitForClientReady(broker)
 */
export function waitForClientReady(broker: TestBroker, timeoutMs = 2000): Promise<void> {
  let onClientReady: (() => void) | undefined

  const clientReadyPromise = new Promise<void>((resolve) => {
    onClientReady = (): void => {
      if (onClientReady) {
        broker.broker.off('clientReady', onClientReady)
      }
      resolve()
    }
    broker.broker.on('clientReady', onClientReady)
  })

  return withTimeout(
    clientReadyPromise,
    timeoutMs,
    () => `Timeout waiting for client to be ready (connected: ${broker.broker.connectedClients})`
  ).finally(() => {
    if (onClientReady) {
      broker.broker.off('clientReady', onClientReady)
    }
  })
}

/**
 * Wait for a client to disconnect
 *
 * @param broker - The test broker to monitor
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 2000)
 * @returns Promise that resolves when a client disconnects or rejects on timeout
 *
 * @example
 * await waitForClientDisconnect(broker)
 */
export function waitForClientDisconnect(broker: TestBroker, timeoutMs = 2000): Promise<void> {
  let onClientDisconnect: (() => void) | undefined

  const clientDisconnectPromise = new Promise<void>((resolve) => {
    onClientDisconnect = (): void => {
      if (onClientDisconnect) {
        broker.broker.off('clientDisconnect', onClientDisconnect)
      }
      resolve()
    }
    broker.broker.on('clientDisconnect', onClientDisconnect)
  })

  return withTimeout(
    clientDisconnectPromise,
    timeoutMs,
    () => `Timeout waiting for client to disconnect (connected: ${broker.broker.connectedClients})`
  ).finally(() => {
    if (onClientDisconnect) {
      broker.broker.off('clientDisconnect', onClientDisconnect)
    }
  })
}

/**
 * Wait for a publish event on the broker
 *
 * @param broker - The test broker to monitor
 * @param topicPattern - Optional topic to match (supports wildcards)
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 1000)
 * @returns Promise that resolves with the published packet or rejects on timeout
 *
 * @example
 * const packet = await waitForPublish(broker, 'test/topic')
 */
export function waitForPublish(
  broker: TestBroker,
  topicPattern?: string,
  timeoutMs = 1000
): Promise<{ topic: string; payload: Buffer }> {
  let onPublish: ((packet: AedesPublishPacket, _client: Client | null) => void) | undefined

  const publishPromise = new Promise<{ topic: string; payload: Buffer }>((resolve) => {
    onPublish = (packet: AedesPublishPacket, _client: Client | null): void => {
      if (!topicPattern || matchTopic(packet.topic, topicPattern)) {
        if (onPublish) {
          broker.broker.off('publish', onPublish)
        }
        const payload =
          typeof packet.payload === 'string' ? Buffer.from(packet.payload) : packet.payload
        resolve({ topic: packet.topic, payload })
      }
    }
    broker.broker.on('publish', onPublish)
  })

  return withTimeout(
    publishPromise,
    timeoutMs,
    `Timeout waiting for publish${topicPattern ? ` on topic ${topicPattern}` : ''}`
  ).finally(() => {
    if (onPublish) {
      broker.broker.off('publish', onPublish)
    }
  })
}

/**
 * Wait for a subscribe event on the broker
 *
 * @param broker - The test broker to monitor
 * @param topicPattern - Optional topic to match
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 1000)
 * @returns Promise that resolves with subscriptions or rejects on timeout
 *
 * @example
 * await waitForSubscribe(broker, 'test/topic')
 */
export function waitForSubscribe(
  broker: TestBroker,
  topicPattern?: string,
  timeoutMs = 1000
): Promise<Array<{ topic: string }>> {
  let onSubscribe: ((subscriptions: Array<{ topic: string }>) => void) | undefined

  const subscribePromise = new Promise<Array<{ topic: string }>>((resolve) => {
    onSubscribe = (subscriptions: Array<{ topic: string }>): void => {
      if (!topicPattern || subscriptions.some((s) => matchTopic(s.topic, topicPattern))) {
        if (onSubscribe) {
          broker.broker.off('subscribe', onSubscribe)
        }
        resolve(subscriptions)
      }
    }
    broker.broker.on('subscribe', onSubscribe)
  })

  return withTimeout(
    subscribePromise,
    timeoutMs,
    `Timeout waiting for subscribe${topicPattern ? ` on topic ${topicPattern}` : ''}`
  ).finally(() => {
    if (onSubscribe) {
      broker.broker.off('subscribe', onSubscribe)
    }
  })
}

/**
 * Wait for an unsubscribe event on the broker
 *
 * @param broker - The test broker to monitor
 * @param topicPattern - Optional topic to match
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 1000)
 * @returns Promise that resolves with unsubscriptions or rejects on timeout
 *
 * @example
 * await waitForUnsubscribe(broker, 'test/topic')
 */
export function waitForUnsubscribe(
  broker: TestBroker,
  topicPattern?: string,
  timeoutMs = 1000
): Promise<Array<string>> {
  let onUnsubscribe: ((unsubscriptions: Array<string>) => void) | undefined

  const unsubscribePromise = new Promise<Array<string>>((resolve) => {
    onUnsubscribe = (unsubscriptions: Array<string>): void => {
      if (!topicPattern || unsubscriptions.some((topic) => matchTopic(topic, topicPattern))) {
        if (onUnsubscribe) {
          broker.broker.off('unsubscribe', onUnsubscribe)
        }
        resolve(unsubscriptions)
      }
    }
    broker.broker.on('unsubscribe', onUnsubscribe)
  })

  return withTimeout(
    unsubscribePromise,
    timeoutMs,
    `Timeout waiting for unsubscribe${topicPattern ? ` on topic ${topicPattern}` : ''}`
  ).finally(() => {
    if (onUnsubscribe) {
      broker.broker.off('unsubscribe', onUnsubscribe)
    }
  })
}

/**
 * Simple topic matcher that supports MQTT wildcards
 *
 * @param topic - The actual topic
 * @param pattern - The pattern to match (supports + and # wildcards)
 * @returns True if topic matches pattern
 */
function matchTopic(topic: string, pattern: string): boolean {
  if (topic === pattern) return true

  const topicParts = topic.split('/')
  const patternParts = pattern.split('/')

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i] === '#') {
      return true
    }
    if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
      return false
    }
  }

  return topicParts.length === patternParts.length
}

/**
 * Create a test bridge configuration with optional overrides
 *
 * @param broker - The test broker to connect to
 * @param overrides - Optional configuration overrides
 * @returns Bridge configuration for testing
 *
 * @example
 * const config = createTestBridgeConfig(broker, { topicPrefix: 'custom' })
 */
export function createTestBridgeConfig(
  broker: TestBroker,
  overrides?: Partial<MqttBridgeConfig>
): MqttBridgeConfig {
  const { mqtt, ...otherOverrides } = overrides ?? {}
  return {
    mqtt: {
      url: broker.url,
      ...mqtt,
    },
    ...otherOverrides,
  }
}

/**
 * Subscribe to a topic and wait for the subscription to be registered with the broker
 *
 * @param bridge - The MQTT bridge instance
 * @param broker - The test broker to monitor
 * @param topic - Topic to subscribe to (without prefix)
 * @param handler - Message handler function
 * @param options - Subscribe options and topic prefix
 * @returns Promise that resolves when subscription is registered
 *
 * @example
 * await subscribeAndWait(bridge, broker, 'test/topic', (msg) => { ... })
 */
export async function subscribeAndWait(
  bridge: MqttBridge,
  broker: TestBroker,
  topic: string,
  handler: MessageHandler,
  options?: SubscribeOptions & { prefix?: string }
): Promise<void> {
  const prefix = options?.prefix ?? 'modbus'
  const subscribePromise = waitForSubscribe(broker, `${prefix}/${topic}`)
  await bridge.subscribe(topic, handler, options)
  await subscribePromise
}

/**
 * Publish a message and wait for it to be published to the broker
 *
 * @param bridge - The MQTT bridge instance
 * @param broker - The test broker to monitor
 * @param topic - Topic to publish to (without prefix)
 * @param message - Message payload
 * @param options - Publish options and topic prefix
 * @returns Promise that resolves when message is published
 *
 * @example
 * await publishAndWait(bridge, broker, 'test/topic', 'Hello', { qos: 1 })
 */
export async function publishAndWait(
  bridge: MqttBridge,
  broker: TestBroker,
  topic: string,
  message: string | Buffer,
  options?: PublishOptions & { prefix?: string }
): Promise<void> {
  const prefix = options?.prefix ?? 'modbus'
  const publishPromise = waitForPublish(broker, `${prefix}/${topic}`)
  await bridge.publish(topic, message, options)
  await publishPromise
}

/**
 * Message collector for capturing messages in tests
 */
export interface MessageCollector {
  messages: string[]
  handler: MessageHandler
  clear: () => void
}

/**
 * Create a message collector for capturing messages in tests
 *
 * @returns Message collector with handler and utilities
 *
 * @example
 * const collector = createMessageCollector()
 * await bridge.subscribe('test/topic', collector.handler)
 * expect(collector.messages).toContain('Expected message')
 */
export function createMessageCollector(): MessageCollector {
  const messages: string[] = []
  return {
    messages,
    handler: (message: MqttMessage) => messages.push(message.payload.toString()),
    clear: () => {
      messages.length = 0
    },
  }
}

/**
 * Execute a test function with a running bridge, ensuring proper cleanup
 *
 * Automatically starts the bridge before the test and stops it after,
 * even if the test throws an error. This eliminates boilerplate and
 * ensures resources are properly cleaned up.
 *
 * @param config - Bridge configuration
 * @param testFn - Test function to execute with the running bridge (can be sync or async)
 * @returns Promise that resolves when test completes and bridge is stopped
 *
 * @example
 * await withBridge(createTestBridgeConfig(broker), async (bridge) => {
 *   const status = bridge.getStatus()
 *   expect(status.state).toBe('running')
 * })
 */
export async function withBridge(
  config: MqttBridgeConfig,
  testFn: (bridge: MqttBridge) => Promise<void> | void
): Promise<void> {
  const bridge = createBridge(config)
  await bridge.start()
  try {
    await testFn(bridge)
  } finally {
    await bridge.stop()
  }
}

/**
 * Start an Aedes MQTT broker on a dynamic port for testing
 */
export async function startTestBroker(options?: { port?: number }): Promise<TestBroker> {
  const broker = new Aedes()
  const server = createServer(broker.handle)

  return new Promise((resolve, reject) => {
    server.listen(options?.port, () => {
      const address = server.address() as AddressInfo
      resolve({
        address,
        url: `mqtt://localhost:${address.port}`,
        port: address.port,
        broker,
        server,
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            broker.close(() => {
              server.close((err) => {
                if (err) {
                  rejectClose(err)
                } else {
                  resolveClose()
                }
              })
            })
          }),
      })
    })
    server.on('error', reject)
  })
}
