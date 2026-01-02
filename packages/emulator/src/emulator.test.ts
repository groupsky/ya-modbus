/**
 * Tests for ModbusEmulator class
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'

import { ModbusEmulator } from './emulator.js'

describe('ModbusEmulator', () => {
  let emulator: ModbusEmulator

  afterEach(() => {
    if (emulator) {
      emulator.stop()
    }
  })

  describe('lifecycle', () => {
    it('should create emulator with memory transport', () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      expect(emulator).toBeDefined()
    })

    it('should start and stop emulator', () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      expect(() => {
        emulator.start()
        emulator.stop()
      }).not.toThrow()
    })

    it('should not throw when stopping already stopped emulator', () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.start()
      emulator.stop()
      expect(() => emulator.stop()).not.toThrow()
    })
  })

  describe('device management', () => {
    beforeEach(() => {
      emulator = new ModbusEmulator({ transport: 'memory' })
    })

    it('should add device before starting', () => {
      const device = emulator.addDevice({ slaveId: 1 })
      expect(device).toBeDefined()
      expect(device.slaveId).toBe(1)
    })

    it('should add device after starting', () => {
      emulator.start()
      const device = emulator.addDevice({ slaveId: 1 })
      expect(device).toBeDefined()
      expect(device.slaveId).toBe(1)
    })

    it('should add multiple devices with different slave IDs', () => {
      const device1 = emulator.addDevice({ slaveId: 1 })
      const device2 = emulator.addDevice({ slaveId: 2 })
      expect(device1.slaveId).toBe(1)
      expect(device2.slaveId).toBe(2)
    })

    it('should throw when adding device with duplicate slave ID', () => {
      emulator.addDevice({ slaveId: 1 })
      expect(() => {
        emulator.addDevice({ slaveId: 1 })
      }).toThrow('Device with slave ID 1 already exists')
    })

    it('should remove device', () => {
      emulator.addDevice({ slaveId: 1 })
      emulator.removeDevice(1)
      // Should not throw when adding device with same ID after removal
      const device = emulator.addDevice({ slaveId: 1 })
      expect(device.slaveId).toBe(1)
    })

    it('should throw when removing non-existent device', () => {
      expect(() => {
        emulator.removeDevice(1)
      }).toThrow('Device with slave ID 1 not found')
    })

    it('should get device by slave ID', () => {
      const added = emulator.addDevice({ slaveId: 1 })
      const retrieved = emulator.getDevice(1)
      expect(retrieved).toBe(added)
    })

    it('should return undefined for non-existent device', () => {
      const device = emulator.getDevice(1)
      expect(device).toBeUndefined()
    })
  })

  describe('configuration', () => {
    it('should create emulator with TCP transport config', () => {
      emulator = new ModbusEmulator({
        transport: 'tcp',
        port: 5502,
        host: 'localhost',
      })
      expect(emulator).toBeDefined()
    })

    it('should create emulator with RTU transport config', () => {
      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/pts/10',
        baudRate: 9600,
        parity: 'even',
      })
      expect(emulator).toBeDefined()
    })
  })
})
