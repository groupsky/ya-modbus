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
  publish(topic: string, payload: string | Buffer, options?: PublishOptions): Promise<void>
  subscribe(topic: string, handler: MessageHandler, options?: SubscribeOptions): Promise<void>
  unsubscribe(topic: string): Promise<void>
}

export interface PublishOptions {
  qos?: 0 | 1 | 2
  retain?: boolean
}

export interface SubscribeOptions {
  qos?: 0 | 1 | 2
}

export interface MqttMessage {
  topic: string
  payload: Buffer
  qos: 0 | 1 | 2
  retain: boolean
}

export type MessageHandler = (message: MqttMessage) => void
