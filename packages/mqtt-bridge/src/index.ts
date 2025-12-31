import type { MqttBridgeConfig, MqttBridge, BridgeStatus } from './types.js'

export type { MqttBridgeConfig, BridgeStatus, MqttBridge } from './types.js'
export { loadConfig } from './config.js'

export function createBridge(_config: MqttBridgeConfig): MqttBridge {
  let status: BridgeStatus = {
    state: 'stopped',
    timestamp: Date.now(),
    deviceCount: 0,
  }

  return {
    start() {
      status = {
        state: 'starting',
        timestamp: Date.now(),
        deviceCount: 0,
      }

      status = {
        state: 'running',
        timestamp: Date.now(),
        deviceCount: 0,
      }

      return Promise.resolve()
    },

    stop() {
      status = {
        state: 'stopping',
        timestamp: Date.now(),
        deviceCount: 0,
      }

      status = {
        state: 'stopped',
        timestamp: Date.now(),
        deviceCount: 0,
      }

      return Promise.resolve()
    },

    getStatus() {
      return { ...status }
    },
  }
}
