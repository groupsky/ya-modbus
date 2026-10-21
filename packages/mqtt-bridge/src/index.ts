import mqtt from 'mqtt'

import { DeviceManager, type DeviceStatusUpdate } from './device-manager.js'
import { parseWriteValues, WriteError } from './device-writes.js'
import { DriverLoader } from './driver-loader.js'
import { DEFAULT_MAX_RETRIES, PollingScheduler } from './polling-scheduler.js'
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
  // This ensures publishDeviceMessage is always defined before PollingScheduler starts
  let bridgeRef: MqttBridge | null = null

  // Publish function that will be called from polling
  const publishDeviceMessage = (
    deviceId: string,
    topic: 'data' | 'status' | 'set/result',
    fields: Record<string, unknown>
  ): void => {
    if (!bridgeRef) {
      // Bridge not fully initialized yet - skip publishing
      return
    }

    const payload = JSON.stringify({
      deviceId,
      timestamp: Date.now(),
      ...fields,
    })

    // Publish to device-specific topic
    void bridgeRef.publish(`${deviceId}/${topic}`, payload, { qos: 0 }).catch((error: Error) => {
      console.error(`Failed to publish ${topic} for device ${deviceId}:`, error)
    })
  }

  // Update device status and publish the state (with the errors that caused it) when it changes
  const updateDeviceStatus = (deviceId: string, updates: DeviceStatusUpdate): void => {
    const previousState = deviceManager.getDevice(deviceId)?.state
    deviceManager.updateDeviceState(deviceId, updates)

    const { state, errors } = updates
    if (state !== undefined && state !== previousState) {
      publishDeviceMessage(deviceId, 'status', { state, ...(errors && { errors }) })
    }
  }

  // Handle data from polling
  const handlePollingData = (deviceId: string, data: Record<string, unknown>): void => {
    publishDeviceMessage(deviceId, 'data', { data })

    // Read before the reset below. A device whose port could not be opened is in error state
    // without failed polls.
    const previous = deviceManager.getDevice(deviceId)
    const failedPolls = previous?.consecutiveFailures ?? 0
    if (failedPolls > 0 || previous?.state === 'error') {
      console.log(
        `Device ${deviceId} recovered` +
          (failedPolls > 0
            ? ` after ${failedPolls} failed ${failedPolls === 1 ? 'poll' : 'polls'}`
            : '')
      )
    }

    // A successful read resets the failure count and recovers a device in error state
    updateDeviceStatus(deviceId, {
      state: 'connected',
      lastPoll: Date.now(),
      lastUpdate: Date.now(),
      consecutiveFailures: 0,
    })
  }

  // Handle polling errors
  const handlePollingError = (deviceId: string, error: Error, failureCount: number): void => {
    // One line per failed poll; stack and cause only on request, so a device that stays down
    // does not fill the log with the same trace
    console.error(
      `Polling error for device ${deviceId} (failure ${failureCount}): ${error.message}`
    )
    if (process.env['YA_MODBUS_DEBUG'] === '1') {
      console.error(error)
    }

    // Same limit after which the polling scheduler switches to retryBackoff
    const maxRetries =
      deviceManager.getDeviceConfig(deviceId)?.polling?.maxRetries ?? DEFAULT_MAX_RETRIES

    // The failure that starts slow mode. maxRetries 0 works like 1.
    if (failureCount === Math.max(maxRetries, 1)) {
      console.warn(
        `Device ${deviceId} failed ${failureCount} ${failureCount === 1 ? 'poll' : 'polls'} in a row ` +
          'and is now polled less often: the wait starts at polling.retryBackoff and doubles ' +
          'up to polling.maxRetryBackoff'
      )
    }

    updateDeviceStatus(deviceId, {
      consecutiveFailures: failureCount,
      errors: [error.message],
      ...(failureCount >= maxRetries && { state: 'error' }),
    })
  }

  const pollingScheduler =
    dependencies?.pollingScheduler ?? new PollingScheduler(handlePollingData, handlePollingError)

  // Write the values of a message on {topicPrefix}/{deviceId}/set, and publish the result
  const handleWriteMessage = async (deviceId: string, message: MqttMessage): Promise<void> => {
    // The broker sends a retained message again at every subscribe, so it would be written again
    // at every start of the bridge and after every reconnect
    if (message.retain) {
      console.warn(`Ignored a retained write message for device ${deviceId}`)
      return
    }

    let values: Record<string, unknown> | undefined
    try {
      values = parseWriteValues(message.payload)
      await pollingScheduler.writeDevice(deviceId, values)
      publishDeviceMessage(deviceId, 'set/result', { ok: true, values })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.warn(`Write to device ${deviceId} failed: ${reason}`)
      const written = error instanceof WriteError ? error.written : []
      publishDeviceMessage(deviceId, 'set/result', { ok: false, error: reason, written, values })
    }
  }

  // Not with bridge.subscribe(), which fails while the client is offline. mqtt.js sends a
  // subscription made offline when it connects, and subscribes again after every reconnect.
  const subscribeOnClient = (topic: string): void => {
    client?.subscribe(topic, { qos: 0 }, (error) => {
      if (error) console.error(`Failed to subscribe to ${topic}:`, error)
    })
  }

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

        // Write topics of the devices that were added before the start
        for (const topic of subscriptions.keys()) subscribeOnClient(topic)

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
              qos: packet.qos,
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

      // Close all transports managed by the transport manager
      await driverLoader.closeAllTransports()

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

        // A port that cannot be opened (USB adapter not plugged in) does not stop the bridge.
        // The device is in error state until a poll opens the port and reads it.
        const connectionError = driverLoader.getConnectionError(deviceConfig.deviceId)
        if (connectionError) {
          console.warn(
            `Device ${deviceConfig.deviceId} is not connected, the bridge keeps trying to open ` +
              `its port: ${connectionError.message}`
          )
          updateDeviceStatus(deviceConfig.deviceId, {
            state: 'error',
            errors: [connectionError.message],
          })
        }

        pollingScheduler.scheduleDevice(deviceConfig.deviceId, deviceConfig, driver)

        const writeTopic = `${topicPrefix}/${deviceConfig.deviceId}/set`
        subscriptions.set(writeTopic, (message) => {
          void handleWriteMessage(deviceConfig.deviceId, message)
        })
        subscribeOnClient(writeTopic)
      }
    },

    async removeDevice(deviceId: string) {
      // Unschedule polling first
      pollingScheduler.unscheduleDevice(deviceId)

      const writeTopic = `${topicPrefix}/${deviceId}/set`
      // A failed unsubscribe is harmless: no handler takes the messages any more. The callback
      // keeps mqtt.js from emitting it as an 'error' event.
      if (subscriptions.delete(writeTopic)) client?.unsubscribe(writeTopic, () => undefined)

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
