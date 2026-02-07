/**
 * Tests for ModbusEmulator class
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'

import { ModbusEmulator } from './emulator.js'

describe('ModbusEmulator', () => {
  let emulator: ModbusEmulator

  afterEach(async () => {
    if (emulator) {
      await emulator.stop()
    }
  })

  describe('lifecycle', () => {
    it('should create emulator with memory transport', () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      expect(emulator).toBeDefined()
    })

    it('should start and stop emulator', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      await expect(emulator.start()).resolves.not.toThrow()
      await expect(emulator.stop()).resolves.not.toThrow()
    })

    it('should not throw when stopping already stopped emulator', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      await emulator.start()
      await emulator.stop()
      await expect(emulator.stop()).resolves.not.toThrow()
    })

    it('should throw when starting already started emulator', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      await emulator.start()
      await expect(emulator.start()).rejects.toThrow('Emulator already started')
    })

    it('should provide access to transport', () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      const transport = emulator.getTransport()
      expect(transport).toBeDefined()
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

    it('should add device after starting', async () => {
      await emulator.start()
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
    it('should create RTU transport with valid config', () => {
      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/pts/10',
        baudRate: 9600,
        parity: 'even',
      })
      expect(emulator).toBeDefined()
      expect(emulator.getTransport()).toBeDefined()
    })

    it('should throw for RTU transport without port', () => {
      expect(() => {
        emulator = new ModbusEmulator({
          transport: 'rtu',
        } as any)
      }).toThrow('RTU transport requires port')
    })

    it('should create RTU transport with lock option', () => {
      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/pts/10',
        lock: false,
      })
      expect(emulator).toBeDefined()
      expect(emulator.getTransport()).toBeDefined()
    })
  })

  describe('request handling', () => {
    it('should handle requests through transport', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: {
          holding: { 0: 100 },
        },
      })
      await emulator.start()

      const transport = emulator.getTransport()
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      // @ts-expect-error - accessing protected method for testing
      const response = await transport.sendRequest(1, request)

      // Should return valid Modbus response
      expect(response[0]).toBe(0x01) // Slave ID
      expect(response[1]).toBe(0x03) // Function code
      expect(response[2]).toBe(0x02) // Byte count
      expect(response.readUInt16BE(3)).toBe(100) // Register value
    })

    it('should return exception for non-existent device', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      await emulator.start()

      const transport = emulator.getTransport()
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      // @ts-expect-error - accessing protected method for testing
      const response = await transport.sendRequest(1, request)

      // Should return exception response
      expect(response[0]).toBe(0x01) // Slave ID
      expect(response[1]).toBe(0x83) // Function code with error bit
      expect(response[2]).toBe(0x0b) // Gateway Target Device Failed to Respond
    })
  })
})
