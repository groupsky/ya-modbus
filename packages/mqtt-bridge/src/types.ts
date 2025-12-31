export interface MqttBridgeConfig {
  mqtt: {
    url: string
    clientId?: string
    username?: string
    password?: string
    reconnectPeriod?: number
  }
  stateDir?: string
  topicPrefix?: string
}

export interface BridgeStatus {
  state: 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
  timestamp: number
  deviceCount: number
  mqttConnected: boolean
  errors?: string[]
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

export interface DeviceConfig {
  deviceId: string
  driver: string
  connection: DeviceConnection
  enabled?: boolean
}

export type DeviceConnection = RTUConnection | TCPConnection

export interface RTUConnection {
  type: 'rtu'
  port: string
  baudRate: number
  slaveId: number
  parity?: 'none' | 'even' | 'odd'
  dataBits?: 7 | 8
  stopBits?: 1 | 2
}

export interface TCPConnection {
  type: 'tcp'
  host: string
  port: number
  slaveId: number
}

export interface DeviceStatus {
  deviceId: string
  state: 'initializing' | 'running' | 'stopped' | 'error'
  enabled: boolean
  connected: boolean
  lastUpdate?: number
  errors?: string[]
}

export interface MqttBridge {
  start(): Promise<void>
  stop(): Promise<void>
  getStatus(): BridgeStatus
  publish(topic: string, payload: string | Buffer, options?: PublishOptions): Promise<void>
  subscribe(topic: string, handler: MessageHandler, options?: SubscribeOptions): Promise<void>
  unsubscribe(topic: string): Promise<void>
  addDevice(config: DeviceConfig): Promise<void>
  removeDevice(deviceId: string): Promise<void>
  getDevice(deviceId: string): DeviceStatus | undefined
  listDevices(): DeviceStatus[]
}
