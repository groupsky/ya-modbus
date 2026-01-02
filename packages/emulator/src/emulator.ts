/**
 * Main ModbusEmulator class
 */

import { EmulatedDevice } from './device.js'
import type { EmulatorConfig, DeviceConfig } from './types/config.js'
import type { EmulatedDevice as IEmulatedDevice } from './types/device.js'

export class ModbusEmulator {
  private config: EmulatorConfig
  private devices: Map<number, IEmulatedDevice> = new Map()
  private started = false

  constructor(config: EmulatorConfig) {
    this.config = config
  }

  start(): void {
    if (this.started) {
      throw new Error('Emulator already started')
    }
    this.started = true
  }

  stop(): void {
    if (!this.started) {
      return
    }
    this.started = false
  }

  addDevice(config: DeviceConfig): IEmulatedDevice {
    if (this.devices.has(config.slaveId)) {
      throw new Error(`Device with slave ID ${config.slaveId} already exists`)
    }

    const device = new EmulatedDevice(config)
    this.devices.set(config.slaveId, device)
    return device
  }

  removeDevice(slaveId: number): void {
    if (!this.devices.has(slaveId)) {
      throw new Error(`Device with slave ID ${slaveId} not found`)
    }
    this.devices.delete(slaveId)
  }

  getDevice(slaveId: number): IEmulatedDevice | undefined {
    return this.devices.get(slaveId)
  }
}
