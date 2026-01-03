import mqtt from 'mqtt'

import { DeviceManager } from './device-manager.js'
import { DriverLoader } from './driver-loader.js'
import { PollingScheduler } from './polling-scheduler.js'
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

// For dependency injection in tests
interface BridgeDependencies {
  driverLoader?: DriverLoader
  deviceManager?: DeviceManager
  pollingScheduler?: PollingScheduler
}

export function createBridge(
  config: MqttBridgeConfig,
  dependencies?: BridgeDependencies
): MqttBridge {
  let status: InternalStatus = {
    state: 'stopped',
    timestamp: Date.now(),
  }

  let client: mqtt.MqttClient | null = null
  const topicPrefix = config.topicPrefix ?? 'modbus'
  // Subscriptions map needed because mqtt client doesn't expose handler lookup
  const subscriptions = new Map<string, MessageHandler>()

  // Use injected dependencies or create new instances
  const driverLoader = dependencies?.driverLoader ?? new DriverLoader()
  const deviceManager = dependencies?.deviceManager ?? new DeviceManager(driverLoader)

  // Bridge reference to be set after bridge object is created
  let bridgeRef: MqttBridge | null = null

  // Publish function that will be called from polling
  const publishData = (deviceId: string, data: Record<string, unknown>): void => {
    if (!bridgeRef) {
      // Bridge not fully initialized yet - skip publishing
      return
    }

    const payload = JSON.stringify({
      deviceId,
      timestamp: Date.now(),
      data,
    })

    // Publish to device-specific topic
    void bridgeRef.publish(`${deviceId}/data`, payload, { qos: 0 }).catch((error: Error) => {
      console.error(`Failed to publish data for device ${deviceId}:`, error)
    })
  }

  // Handle data from polling
  const handlePollingData = (deviceId: string, data: Record<string, unknown>): void => {
    publishData(deviceId, data)

    // Update device status
    deviceManager.updateDeviceState(deviceId, {
      lastPoll: Date.now(),
      lastUpdate: Date.now(),
    })
  }

  // Handle polling errors
  const handlePollingError = (deviceId: string, error: Error): void => {
    console.error(`Polling error for device ${deviceId}:`, error)

    const device = deviceManager.getDevice(deviceId)
    const consecutiveFailures = (device?.consecutiveFailures ?? 0) + 1

    deviceManager.updateDeviceState(deviceId, {
      consecutiveFailures,
      errors: [error.message],
    })
  }

  const pollingScheduler =
    dependencies?.pollingScheduler ?? new PollingScheduler(handlePollingData, handlePollingError)

  const bridge: MqttBridge = {
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

          // Start polling scheduler
          pollingScheduler.start()

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
                  /* istanbul ignore next - defensive: handlers always throw Error */
                  `Handler error for ${topic}: ${error instanceof Error ? error.message : String(error)}`,
                ],
              }
            }
          }
        })
      })
    },

    async stop() {
      status = {
        state: 'stopping',
        timestamp: Date.now(),
      }

      // Stop polling first
      pollingScheduler.stop()

      // Cleanup device manager (unloads drivers)
      await deviceManager.clear()

      if (client) {
        // Cleanup event listeners and subscriptions to prevent memory leaks
        client.removeAllListeners()
        subscriptions.clear()

        await new Promise<void>((resolve) => {
          if (!client) {
            resolve()
            return
          }
          client.end(false, {}, () => {
            status = {
              state: 'stopped',
              timestamp: Date.now(),
            }
            client = null
            resolve()
          })
        })
      } else {
        status = {
          state: 'stopped',
          timestamp: Date.now(),
        }
      }
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

    async addDevice(deviceConfig: DeviceConfig) {
      await deviceManager.addDevice(deviceConfig)

      // Schedule device for polling if enabled
      if (deviceConfig.enabled !== false) {
        const driver = driverLoader.getDriver(deviceConfig.deviceId)
        if (!driver) {
          throw new Error(
            `Driver for ${deviceConfig.deviceId} not found after loading. ` +
              `This may indicate the device was removed during initialization.`
          )
        }
        pollingScheduler.scheduleDevice(deviceConfig.deviceId, deviceConfig, driver)
      }
    },

    async removeDevice(deviceId: string) {
      // Unschedule polling first
      pollingScheduler.unscheduleDevice(deviceId)

      // Remove device (unloads driver)
      await deviceManager.removeDevice(deviceId)
    },

    getDevice(deviceId: string) {
      return deviceManager.getDevice(deviceId)
    },

    listDevices() {
      return deviceManager.listDevices()
    },

    getDeviceConfig(deviceId: string) {
      return deviceManager.getDeviceConfig(deviceId)
    },
  }

  // Set bridge reference now that bridge is defined
  bridgeRef = bridge

  return bridge
}
