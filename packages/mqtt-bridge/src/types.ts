export interface MqttBridgeConfig {
  mqtt: {
    url: string
    clientId?: string
    username?: string
    password?: string
  }
  stateFile?: string
  topicPrefix?: string
}

export interface BridgeStatus {
  state: 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
  timestamp: number
  deviceCount: number
  mqttConnected: boolean
  errors?: string[]
}

export interface MqttBridge {
  start(): Promise<void>
  stop(): Promise<void>
  getStatus(): BridgeStatus
}
