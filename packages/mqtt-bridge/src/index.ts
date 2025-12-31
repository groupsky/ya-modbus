import mqtt from 'mqtt'

import type { MqttBridgeConfig, MqttBridge, BridgeStatus } from './types.js'

export type { MqttBridgeConfig, BridgeStatus, MqttBridge } from './types.js'
export { loadConfig } from './config.js'

export function createBridge(config: MqttBridgeConfig): MqttBridge {
  let status: BridgeStatus = {
    state: 'stopped',
    timestamp: Date.now(),
    deviceCount: 0,
    mqttConnected: false,
  }

  let client: mqtt.MqttClient | null = null

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
          status = {
            ...status,
            mqttConnected: false,
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
      return { ...status }
    },
  }
}
