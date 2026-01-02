/**
 * EmulatedDevice class implementation
 */

import { TimingSimulator } from './behaviors/timing.js'
import type { DeviceConfig } from './types/config.js'
import type { EmulatedDevice as IEmulatedDevice } from './types/device.js'

// Modbus register address and value ranges
const MIN_REGISTER_ADDRESS = 0
const MAX_REGISTER_ADDRESS = 65535
const MIN_REGISTER_VALUE = 0
const MAX_REGISTER_VALUE = 65535

function validateRegisterAddress(address: number): void {
  if (address < MIN_REGISTER_ADDRESS || address > MAX_REGISTER_ADDRESS) {
    throw new Error(`Register address ${address} out of range (0-65535)`)
  }
}

function validateRegisterValue(value: number, address: number): void {
  if (value < MIN_REGISTER_VALUE || value > MAX_REGISTER_VALUE) {
    throw new Error(`Register value ${value} at address ${address} out of range (0-65535)`)
  }
}

export class EmulatedDevice implements IEmulatedDevice {
  public readonly slaveId: number
  private holdingRegisters: Map<number, number> = new Map()
  private inputRegisters: Map<number, number> = new Map()
  private coils: Map<number, boolean> = new Map()
  private discreteInputs: Map<number, boolean> = new Map()
  private timingSimulator?: TimingSimulator

  constructor(config: DeviceConfig) {
    this.slaveId = config.slaveId

    // Initialize timing behavior
    if (config.timing) {
      this.timingSimulator = new TimingSimulator(config.timing)
    }

    // Initialize registers from config
    if (config.registers?.holding) {
      for (const [address, value] of Object.entries(config.registers.holding)) {
        const addr = Number(address)
        validateRegisterAddress(addr)
        validateRegisterValue(value, addr)
        this.holdingRegisters.set(addr, value)
      }
    }

    if (config.registers?.input) {
      for (const [address, value] of Object.entries(config.registers.input)) {
        const addr = Number(address)
        validateRegisterAddress(addr)
        validateRegisterValue(value, addr)
        this.inputRegisters.set(addr, value)
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
    validateRegisterAddress(address)
    validateRegisterValue(value, address)
    this.holdingRegisters.set(address, value)
  }

  getInputRegister(address: number): number {
    return this.inputRegisters.get(address) ?? 0
  }

  setInputRegister(address: number, value: number): void {
    validateRegisterAddress(address)
    validateRegisterValue(value, address)
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

  getTimingSimulator(): TimingSimulator | undefined {
    return this.timingSimulator
  }
}
