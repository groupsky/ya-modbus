import type { DriverLoader } from './driver-loader.js'
import type { DeviceConfig, DeviceStatus } from './types.js'
import { validateDeviceConfig } from './utils/device-validation.js'

export class DeviceManager {
  private devices = new Map<string, DeviceStatus>()
  private configs = new Map<string, DeviceConfig>()

  constructor(private driverLoader: DriverLoader) {}

  async addDevice(config: DeviceConfig): Promise<void> {
    validateDeviceConfig(config)

    if (this.devices.has(config.deviceId)) {
      throw new Error(`Device ${config.deviceId} already exists`)
    }

    const enabled = config.enabled ?? true

    const status: DeviceStatus = {
      deviceId: config.deviceId,
      state: 'disconnected',
      enabled,
      connected: false,
    }

    this.devices.set(config.deviceId, status)
    this.configs.set(config.deviceId, config)

    // Load driver if enabled
    if (enabled) {
      try {
        this.updateDeviceState(config.deviceId, { state: 'connecting' })
        await this.driverLoader.loadDriver(config.driver, config.connection, config.deviceId)
        this.updateDeviceState(config.deviceId, {
          state: 'connected',
          connected: true,
          lastUpdate: Date.now(),
        })
      } catch (error) {
        // Clean up device state to allow retry (make operation atomic)
        this.devices.delete(config.deviceId)
        this.configs.delete(config.deviceId)
        throw error
      }
    }
  }

  async removeDevice(deviceId: string): Promise<void> {
    if (!this.devices.has(deviceId)) {
      throw new Error(`Device ${deviceId} not found`)
    }

    await this.driverLoader.unloadDriver(deviceId)
    this.devices.delete(deviceId)
    this.configs.delete(deviceId)
  }

  getDevice(deviceId: string): DeviceStatus | undefined {
    return this.devices.get(deviceId)
  }

  listDevices(): DeviceStatus[] {
    return Array.from(this.devices.values())
  }

  getDeviceCount(): number {
    return this.devices.size
  }

  updateDeviceState(deviceId: string, updates: Partial<Omit<DeviceStatus, 'deviceId'>>): void {
    const device = this.devices.get(deviceId)
    if (!device) {
      throw new Error(`Device ${deviceId} not found`)
    }

    this.devices.set(deviceId, {
      ...device,
      ...updates,
    })
  }

  async clear(): Promise<void> {
    const deviceIds = Array.from(this.devices.keys())
    await Promise.all(deviceIds.map((id) => this.driverLoader.unloadDriver(id)))
    this.devices.clear()
    this.configs.clear()
  }

  getDeviceConfig(deviceId: string): DeviceConfig | undefined {
    return this.configs.get(deviceId)
  }
}
