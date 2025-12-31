import mqtt from 'mqtt'

import { DeviceManager } from './device-manager.js'
import type {
  MqttBridgeConfig,
  MqttBridge,
  BridgeStatus,
  PublishOptions,
  SubscribeOptions,
  MessageHandler,
  MqttMessage,
  DeviceConfig,
} from './types.js'

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
export { loadConfig } from './config.js'

export function createBridge(config: MqttBridgeConfig): MqttBridge {
  let status: BridgeStatus = {
    state: 'stopped',
    timestamp: Date.now(),
    deviceCount: 0,
    mqttConnected: false,
  }

  let client: mqtt.MqttClient | null = null
  const topicPrefix = config.topicPrefix ?? 'modbus'
  const subscriptions = new Map<string, MessageHandler>()
  const deviceManager = new DeviceManager()

  return {
    start() {
      return new Promise<void>((resolve, reject) => {
        status = {
          state: 'starting',
          timestamp: Date.now(),
          deviceCount: 0,
          mqttConnected: false,
        }

        const mqttOptions: mqtt.IClientOptions = {
          clean: true,
          reconnectPeriod: 5000,
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

        client.on('connect', () => {
          status = {
            state: 'running',
            timestamp: Date.now(),
            deviceCount: 0,
            mqttConnected: true,
          }
          resolve()
        })

        client.on('error', (error) => {
          status = {
            state: 'error',
            timestamp: Date.now(),
            deviceCount: 0,
            mqttConnected: false,
            errors: [error.message],
          }
          reject(error)
        })

        client.on('disconnect', () => {
          status = {
            ...status,
            mqttConnected: false,
          }
        })

        client.on('offline', () => {
          status = {
            ...status,
            mqttConnected: false,
          }
        })

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
            handler(message)
          }
        })
      })
    },

    stop() {
      return new Promise<void>((resolve) => {
        status = {
          state: 'stopping',
          timestamp: Date.now(),
          deviceCount: 0,
          mqttConnected: false,
        }

        if (client) {
          client.end(false, {}, () => {
            status = {
              state: 'stopped',
              timestamp: Date.now(),
              deviceCount: 0,
              mqttConnected: false,
            }
            client = null
            resolve()
          })
        } else {
          status = {
            state: 'stopped',
            timestamp: Date.now(),
            deviceCount: 0,
            mqttConnected: false,
          }
          resolve()
        }
      })
    },

    getStatus() {
      return {
        ...status,
        deviceCount: deviceManager.getDeviceCount(),
      }
    },

    publish(topic: string, payload: string | Buffer, options?: PublishOptions) {
      return new Promise<void>((resolve, reject) => {
        if (!client) {
          reject(new Error('MQTT client not initialized'))
          return
        }

        if (!status.mqttConnected) {
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

        if (!status.mqttConnected) {
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

        if (!status.mqttConnected) {
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
