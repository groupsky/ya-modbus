import type { MqttBridgeConfig, MqttBridge } from './types.js'

export type { MqttBridgeConfig, BridgeStatus, MqttBridge } from './types.js'

export function createBridge(_config: MqttBridgeConfig): MqttBridge {
  throw new Error('Not implemented yet')
}
