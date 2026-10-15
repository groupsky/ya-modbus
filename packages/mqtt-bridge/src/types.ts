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
  devices?: DeviceConfig[]
}

export interface BridgeStatus {
  state: 'starting' | 'running' | 'stopping' | 'stopped' | 'error'
  timestamp: number
  deviceCount: number
  mqttConnected?: boolean
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

export interface PollingConfig {
  /**
   * Time between the end of a read and the start of the next one, in milliseconds
   * (100-86400000). In `continuous` mode it is the delay before the next read after a failed
   * read, until `maxRetries` is reached. Default when `polling` is not set: 5000.
   */
  interval: number
  /**
   * `interval` (default) waits `interval` ms after each read. `continuous` starts the next read
   * as soon as the previous read worked.
   */
  mode?: 'interval' | 'continuous'
  /**
   * Number of consecutive failed reads after which the device goes to the `error` state. From
   * then on the bridge waits `retryBackoff` ms between reads instead of `interval` ms (0-100,
   * default: 3).
   *
   * It is not a limit on retries: polling goes on with `retryBackoff` until a read works. With
   * `3`, the bridge waits `interval` ms after the 1st and the 2nd failed read, and the 3rd
   * failed read starts the backoff. `0` and `1` behave the same: the backoff starts after the
   * first failed read.
   */
  maxRetries?: number
  /**
   * Time to wait between reads in milliseconds while the device is in the `error` state
   * (1-86400000, default: 2 × `interval`).
   */
  retryBackoff?: number
}

export interface DeviceConfig {
  deviceId: string
  driver: string
  connection: DeviceConnection
  enabled?: boolean
  polling?: PollingConfig
}

export type DeviceConnection = RTUConnection | TCPConnection

/**
 * Serial settings that are not set come from the driver's DEFAULT_CONFIG. Without one, the bridge
 * uses 8 data bits, no parity and 1 stop bit, and `baudRate` is required. The settings and
 * `slaveId` must be in the driver's SUPPORTED_CONFIG.
 */
export interface RTUConnection {
  type: 'rtu'
  port: string
  baudRate?: number
  slaveId: number
  parity?: 'none' | 'even' | 'odd'
  dataBits?: 7 | 8
  stopBits?: 1 | 2
  timeout?: number
  /**
   * Pause in milliseconds before a request to this device when the previous request on the
   * port went to another device, counted from the end of that request (0-60000, default: 150).
   * Some meters do not answer a request that comes too soon after another meter's reply. A
   * request to the same device as the previous one does not wait. `0` turns the pause off.
   */
  interDeviceDelay?: number
}

export interface TCPConnection {
  type: 'tcp'
  host: string
  port?: number
  slaveId: number
  timeout?: number
}

export interface DeviceStatus {
  deviceId: string
  /**
   * Device state:
   *
   * - `disconnected` - device is disabled (`enabled: false`) and is not polled
   * - `connecting` - driver is loading
   * - `connected` - driver is loaded and the device is not in the `error` state
   * - `error` - `polling.maxRetries` consecutive reads failed (at least 1, so `0` works like
   *   `1`); the bridge waits `polling.retryBackoff` ms between reads. Also when the port is
   *   not open when the device is added; the bridge polls it until a read works.
   *
   * State changes:
   *
   * - `disconnected` → `connecting` (device added and enabled)
   * - `connecting` → `connected` (driver loaded)
   * - `connected` → `error` (`polling.maxRetries` consecutive failed reads, or the port is
   *   not open when the device is added)
   * - `error` → `connected` (next successful read)
   */
  state: 'connecting' | 'connected' | 'disconnected' | 'error'
  enabled: boolean
  /**
   * `true` only when `state` is `'connected'`.
   *
   * @deprecated Use `state` instead.
   */
  connected: boolean
  lastUpdate?: number
  lastPoll?: number
  consecutiveFailures?: number
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
  getDeviceConfig(deviceId: string): DeviceConfig | undefined
}
