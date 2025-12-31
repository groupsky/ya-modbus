import mqtt from 'mqtt'

import { DeviceManager } from './device-manager.js'
import type {
  MqttBridgeConfig,
  MqttBridge,
  PublishOptions,
  SubscribeOptions,
  MessageHandler,
  MqttMessage,
  DeviceConfig,
} from './types.js'

interface InternalStatus {
  state: 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
  timestamp: number
  errors?: string[]
}

export type {
  MqttBridgeConfig,
  BridgeStatus,
  MqttBridge,
  PublishOptions,
  SubscribeOptions,
  MessageHandler,
  MqttMessage,
  DeviceConfig,
  DeviceStatus,
  DeviceConnection,
  RTUConnection,
  TCPConnection,
} from './types.js'
export { loadConfig } from './utils/config.js'

export function createBridge(config: MqttBridgeConfig): MqttBridge {
  let status: InternalStatus = {
    state: 'stopped',
    timestamp: Date.now(),
  }

  let client: mqtt.MqttClient | null = null
  const topicPrefix = config.topicPrefix ?? 'modbus'
  // Subscriptions map needed because mqtt client doesn't expose handler lookup
  const subscriptions = new Map<string, MessageHandler>()
  const deviceManager = new DeviceManager()

  return {
    start() {
      return new Promise<void>((resolve, reject) => {
        status = {
          state: 'starting',
          timestamp: Date.now(),
        }

        const mqttOptions: mqtt.IClientOptions = {
          clean: true,
          reconnectPeriod: config.mqtt.reconnectPeriod ?? 5000,
          resubscribe: true, // Automatic resubscription on reconnect (default: true)
        }

        if (config.mqtt.clientId) {
          mqttOptions.clientId = config.mqtt.clientId
        }
        if (config.mqtt.username) {
          mqttOptions.username = config.mqtt.username
        }
        if (config.mqtt.password) {
          mqttOptions.password = config.mqtt.password
        }

        client = mqtt.connect(config.mqtt.url, mqttOptions)

        let isInitialConnection = true

        client.on('connect', () => {
          status = {
            state: 'running',
            timestamp: Date.now(),
          }

          // Automatic resubscription is handled by mqtt.js (resubscribe: true)

          if (isInitialConnection) {
            isInitialConnection = false
            resolve()
          }
        })

        client.on('error', (error) => {
          status = {
            state: 'error',
            timestamp: Date.now(),
            errors: [error.message],
          }
          reject(error)
        })

        // No need to track disconnect/offline - client.connected property handles this

        client.on('reconnect', () => {
          // Note: reconnect event fires when attempting to reconnect
          // mqttConnected status is updated by 'connect' event
        })

        client.on('message', (topic, payload, packet) => {
          const handler = subscriptions.get(topic)
          if (handler) {
            const message: MqttMessage = {
              topic,
              payload,
              qos: packet.qos as 0 | 1 | 2,
              retain: packet.retain,
            }
            try {
              handler(message)
            } catch (error) {
              // Prevent handler errors from crashing the bridge
              console.error(`Error in message handler for topic ${topic}:`, error)
              status = {
                ...status,
                errors: [
                  ...(status.errors ?? []),
                  `Handler error for ${topic}: ${error instanceof Error ? error.message : String(error)}`,
                ],
              }
            }
          }
        })
      })
    },

    stop() {
      return new Promise<void>((resolve) => {
        status = {
          state: 'stopping',
          timestamp: Date.now(),
        }

        // Cleanup device manager
        deviceManager.clear()

        if (client) {
          // Cleanup event listeners and subscriptions to prevent memory leaks
          client.removeAllListeners()
          subscriptions.clear()

          client.end(false, {}, () => {
            status = {
              state: 'stopped',
              timestamp: Date.now(),
            }
            client = null
            resolve()
          })
        } else {
          status = {
            state: 'stopped',
            timestamp: Date.now(),
          }
          resolve()
        }
      })
    },

    getStatus() {
      return {
        ...status,
        deviceCount: deviceManager.getDeviceCount(),
        // Use client.connected property directly
        mqttConnected: client?.connected ?? false,
      }
    },

    publish(topic: string, payload: string | Buffer, options?: PublishOptions) {
      return new Promise<void>((resolve, reject) => {
        if (!client) {
          reject(new Error('MQTT client not initialized'))
          return
        }

        if (!client.connected) {
          reject(new Error('MQTT client not connected'))
          return
        }

        const fullTopic = `${topicPrefix}/${topic}`

        const publishOptions: mqtt.IClientPublishOptions = {}
        if (options?.qos !== undefined) {
          publishOptions.qos = options.qos
        }
        if (options?.retain !== undefined) {
          publishOptions.retain = options.retain
        }

        client.publish(fullTopic, payload, publishOptions, (error) => {
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        })
      })
    },

    subscribe(topic: string, handler: MessageHandler, options?: SubscribeOptions) {
      return new Promise<void>((resolve, reject) => {
        if (!client) {
          reject(new Error('MQTT client not initialized'))
          return
        }

        if (!client.connected) {
          reject(new Error('MQTT client not connected'))
          return
        }

        const fullTopic = `${topicPrefix}/${topic}`

        const subscribeOptions: mqtt.IClientSubscribeOptions = {
          qos: options?.qos ?? 0,
        }

        client.subscribe(fullTopic, subscribeOptions, (error) => {
          if (error) {
            reject(error)
          } else {
            subscriptions.set(fullTopic, handler)
            resolve()
          }
        })
      })
    },

    unsubscribe(topic: string) {
      return new Promise<void>((resolve, reject) => {
        if (!client) {
          reject(new Error('MQTT client not initialized'))
          return
        }

        if (!client.connected) {
          reject(new Error('MQTT client not connected'))
          return
        }

        const fullTopic = `${topicPrefix}/${topic}`

        client.unsubscribe(fullTopic, (error) => {
          if (error) {
            reject(error)
          } else {
            subscriptions.delete(fullTopic)
            resolve()
          }
        })
      })
    },

    addDevice(deviceConfig: DeviceConfig) {
      return new Promise<void>((resolve, reject) => {
        try {
          deviceManager.addDevice(deviceConfig)
          resolve()
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      })
    },

    removeDevice(deviceId: string) {
      return new Promise<void>((resolve, reject) => {
        try {
          deviceManager.removeDevice(deviceId)
          resolve()
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      })
    },

    getDevice(deviceId: string) {
      return deviceManager.getDevice(deviceId)
    },

    listDevices() {
      return deviceManager.listDevices()
    },
  }
}
