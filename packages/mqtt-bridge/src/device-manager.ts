import type { DeviceConfig, DeviceStatus } from './types.js'
import { validateDeviceConfig } from './utils/device-validation.js'

export class DeviceManager {
  private devices = new Map<string, DeviceStatus>()

  addDevice(config: DeviceConfig): void {
    validateDeviceConfig(config)

    if (this.devices.has(config.deviceId)) {
      throw new Error(`Device ${config.deviceId} already exists`)
    }

    const status: DeviceStatus = {
      deviceId: config.deviceId,
      state: 'disconnected',
      enabled: config.enabled ?? true,
      connected: false,
    }

    this.devices.set(config.deviceId, status)
  }

  removeDevice(deviceId: string): void {
    if (!this.devices.has(deviceId)) {
      throw new Error(`Device ${deviceId} not found`)
    }

    this.devices.delete(deviceId)
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

  clear(): void {
    this.devices.clear()
  }
}
