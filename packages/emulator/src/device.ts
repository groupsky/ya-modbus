/**
 * EmulatedDevice class implementation
 */

import type { DeviceConfig } from './types/config.js'
import type { EmulatedDevice as IEmulatedDevice } from './types/device.js'

export class EmulatedDevice implements IEmulatedDevice {
  public readonly slaveId: number
  private holdingRegisters: Map<number, number> = new Map()
  private inputRegisters: Map<number, number> = new Map()
  private coils: Map<number, boolean> = new Map()
  private discreteInputs: Map<number, boolean> = new Map()

  constructor(config: DeviceConfig) {
    this.slaveId = config.slaveId

    // Initialize registers from config
    if (config.registers?.holding) {
      for (const [address, value] of Object.entries(config.registers.holding)) {
        this.holdingRegisters.set(Number(address), value)
      }
    }

    if (config.registers?.input) {
      for (const [address, value] of Object.entries(config.registers.input)) {
        this.inputRegisters.set(Number(address), value)
      }
    }

    if (config.registers?.coils) {
      for (const [address, value] of Object.entries(config.registers.coils)) {
        this.coils.set(Number(address), value)
      }
    }

    if (config.registers?.discreteInputs) {
      for (const [address, value] of Object.entries(config.registers.discreteInputs)) {
        this.discreteInputs.set(Number(address), value)
      }
    }
  }

  getHoldingRegister(address: number): number {
    return this.holdingRegisters.get(address) ?? 0
  }

  setHoldingRegister(address: number, value: number): void {
    this.holdingRegisters.set(address, value)
  }

  getInputRegister(address: number): number {
    return this.inputRegisters.get(address) ?? 0
  }

  setInputRegister(address: number, value: number): void {
    this.inputRegisters.set(address, value)
  }

  getCoil(address: number): boolean {
    return this.coils.get(address) ?? false
  }

  setCoil(address: number, value: boolean): void {
    this.coils.set(address, value)
  }

  getDiscreteInput(address: number): boolean {
    return this.discreteInputs.get(address) ?? false
  }

  setDiscreteInput(address: number, value: boolean): void {
    this.discreteInputs.set(address, value)
  }
}
