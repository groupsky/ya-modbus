/**
 * Tests for EmulatedDevice register storage
 */

import { describe, it, expect, beforeEach } from '@jest/globals'

import { ModbusEmulator } from './emulator.js'
import type { EmulatedDevice } from './types/device.js'

describe('EmulatedDevice register storage', () => {
  let emulator: ModbusEmulator
  let device: EmulatedDevice

  beforeEach(() => {
    emulator = new ModbusEmulator({ transport: 'memory' })
  })

  describe('holding registers', () => {
    beforeEach(() => {
      device = emulator.addDevice({ slaveId: 1 })
    })

    it('should return 0 for undefined register', () => {
      expect(device.getHoldingRegister(0)).toBe(0)
      expect(device.getHoldingRegister(100)).toBe(0)
    })

    it('should set and get holding register', () => {
      device.setHoldingRegister(0, 230)
      expect(device.getHoldingRegister(0)).toBe(230)
    })

    it('should store multiple registers independently', () => {
      device.setHoldingRegister(0, 100)
      device.setHoldingRegister(1, 200)
      device.setHoldingRegister(10, 300)

      expect(device.getHoldingRegister(0)).toBe(100)
      expect(device.getHoldingRegister(1)).toBe(200)
      expect(device.getHoldingRegister(10)).toBe(300)
    })

    it('should overwrite existing register value', () => {
      device.setHoldingRegister(0, 100)
      device.setHoldingRegister(0, 200)
      expect(device.getHoldingRegister(0)).toBe(200)
    })

    it('should initialize registers from config', () => {
      device = emulator.addDevice({
        slaveId: 2,
        registers: {
          holding: {
            0: 230,
            1: 52,
            100: 12345,
          },
        },
      })

      expect(device.getHoldingRegister(0)).toBe(230)
      expect(device.getHoldingRegister(1)).toBe(52)
      expect(device.getHoldingRegister(100)).toBe(12345)
    })
  })

  describe('input registers', () => {
    beforeEach(() => {
      device = emulator.addDevice({ slaveId: 1 })
    })

    it('should return 0 for undefined register', () => {
      expect(device.getInputRegister(0)).toBe(0)
    })

    it('should set and get input register', () => {
      device.setInputRegister(0, 500)
      expect(device.getInputRegister(0)).toBe(500)
    })

    it('should initialize input registers from config', () => {
      device = emulator.addDevice({
        slaveId: 2,
        registers: {
          input: {
            0: 500,
            1: 750,
          },
        },
      })

      expect(device.getInputRegister(0)).toBe(500)
      expect(device.getInputRegister(1)).toBe(750)
    })
  })

  describe('coils', () => {
    beforeEach(() => {
      device = emulator.addDevice({ slaveId: 1 })
    })

    it('should return false for undefined coil', () => {
      expect(device.getCoil(0)).toBe(false)
    })

    it('should set and get coil', () => {
      device.setCoil(0, true)
      expect(device.getCoil(0)).toBe(true)

      device.setCoil(0, false)
      expect(device.getCoil(0)).toBe(false)
    })

    it('should store multiple coils independently', () => {
      device.setCoil(0, true)
      device.setCoil(1, false)
      device.setCoil(10, true)

      expect(device.getCoil(0)).toBe(true)
      expect(device.getCoil(1)).toBe(false)
      expect(device.getCoil(10)).toBe(true)
    })

    it('should initialize coils from config', () => {
      device = emulator.addDevice({
        slaveId: 2,
        registers: {
          coils: {
            0: true,
            5: false,
            10: true,
          },
        },
      })

      expect(device.getCoil(0)).toBe(true)
      expect(device.getCoil(5)).toBe(false)
      expect(device.getCoil(10)).toBe(true)
    })
  })

  describe('discrete inputs', () => {
    beforeEach(() => {
      device = emulator.addDevice({ slaveId: 1 })
    })

    it('should return false for undefined discrete input', () => {
      expect(device.getDiscreteInput(0)).toBe(false)
    })

    it('should set and get discrete input', () => {
      device.setDiscreteInput(0, true)
      expect(device.getDiscreteInput(0)).toBe(true)
    })

    it('should initialize discrete inputs from config', () => {
      device = emulator.addDevice({
        slaveId: 2,
        registers: {
          discreteInputs: {
            0: true,
            1: false,
          },
        },
      })

      expect(device.getDiscreteInput(0)).toBe(true)
      expect(device.getDiscreteInput(1)).toBe(false)
    })
  })

  describe('sparse storage', () => {
    beforeEach(() => {
      device = emulator.addDevice({ slaveId: 1 })
    })

    it('should not store unnecessary zeros', () => {
      // Set a register then read a different one
      device.setHoldingRegister(1000, 100)
      expect(device.getHoldingRegister(0)).toBe(0)
      expect(device.getHoldingRegister(999)).toBe(0)
      expect(device.getHoldingRegister(1001)).toBe(0)
    })
  })

  describe('register validation', () => {
    beforeEach(() => {
      device = emulator.addDevice({ slaveId: 1 })
    })

    it('should throw error for out of range register address', () => {
      expect(() => device.setHoldingRegister(-1, 100)).toThrow(
        'Register address -1 out of range (0-65535)'
      )
      expect(() => device.setHoldingRegister(65536, 100)).toThrow(
        'Register address 65536 out of range (0-65535)'
      )
    })

    it('should throw error for out of range register value', () => {
      expect(() => device.setHoldingRegister(0, -1)).toThrow(
        'Register value -1 at address 0 out of range (0-65535)'
      )
      expect(() => device.setHoldingRegister(0, 65536)).toThrow(
        'Register value 65536 at address 0 out of range (0-65535)'
      )
    })
  })
})
