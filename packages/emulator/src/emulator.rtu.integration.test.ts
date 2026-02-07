/**
 * Integration tests for ModbusEmulator with RTU transport
 *
 * These tests verify the emulator correctly handles Modbus operations through
 * the RTU transport's service vector (modbus-serial callbacks).
 *
 * We mock modbus-serial to avoid requiring real hardware, but we test that
 * the emulator properly integrates with RTU transport by exercising the
 * service vector callbacks.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

import { ModbusEmulator } from './emulator.js'

// Store captured service vector for testing
let capturedServiceVector: any = null

// Mock modbus-serial
jest.mock('modbus-serial', () => {
  return {
    ServerSerial: jest.fn().mockImplementation((vector: any, options: any) => {
      // Capture service vector for testing
      capturedServiceVector = vector

      // Call openCallback immediately to simulate successful connection
      if (options.openCallback) {
        setImmediate(() => options.openCallback(null))
      }

      return {
        close: jest.fn((cb: (err: Error | null) => void) => cb(null)),
        on: jest.fn(),
        socks: new Map(),
      }
    }),
  }
})

describe('ModbusEmulator RTU Integration', () => {
  let emulator: ModbusEmulator

  beforeEach(() => {
    capturedServiceVector = null
  })

  afterEach(async () => {
    if (emulator) {
      await emulator.stop()
    }
  })

  describe('Read operations', () => {
    beforeEach(async () => {
      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/ttyUSB0',
      })

      emulator.addDevice({
        slaveId: 1,
        registers: {
          holding: {
            0: 230,
            1: 52,
            2: 1196,
          },
          input: {
            0: 500,
            1: 60,
          },
        },
      })

      await emulator.start()
    })

    it('should read single holding register via RTU service vector', async () => {
      const result = await capturedServiceVector.getHoldingRegister(0, 1)

      expect(result).toEqual([230])
    })

    it('should read multiple holding registers via RTU service vector', async () => {
      const result = await capturedServiceVector.getMultipleHoldingRegisters(0, 3, 1)

      expect(result).toEqual([230, 52, 1196])
    })

    it('should read single input register via RTU service vector', async () => {
      const result = await capturedServiceVector.getInputRegister(0, 1)

      expect(result).toEqual([500])
    })

    it('should read multiple input registers via RTU service vector', async () => {
      const result = await capturedServiceVector.getMultipleInputRegisters(0, 2, 1)

      expect(result).toEqual([500, 60])
    })
  })

  describe('Write operations', () => {
    beforeEach(async () => {
      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/ttyUSB0',
      })

      emulator.addDevice({ slaveId: 1 })

      await emulator.start()
    })

    it('should write single register via RTU service vector', async () => {
      await capturedServiceVector.setRegister(0, 300, 1)

      // Verify by reading back
      const result = await capturedServiceVector.getHoldingRegister(0, 1)
      expect(result).toEqual([300])
    })

    it('should write multiple registers via RTU service vector', async () => {
      await capturedServiceVector.setRegisterArray(0, [500, 100, 200], 1)

      // Verify by reading back
      const result = await capturedServiceVector.getMultipleHoldingRegisters(0, 3, 1)
      expect(result).toEqual([500, 100, 200])
    })
  })

  describe('Multiple devices', () => {
    beforeEach(async () => {
      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/ttyUSB0',
      })

      emulator.addDevice({
        slaveId: 1,
        registers: {
          holding: { 0: 100 },
        },
      })

      emulator.addDevice({
        slaveId: 2,
        registers: {
          holding: { 0: 200 },
        },
      })

      await emulator.start()
    })

    it('should route requests to correct device via unit ID', async () => {
      // Read from device 1
      const result1 = await capturedServiceVector.getHoldingRegister(0, 1)
      expect(result1).toEqual([100])

      // Read from device 2
      const result2 = await capturedServiceVector.getHoldingRegister(0, 2)
      expect(result2).toEqual([200])
    })
  })

  describe('Error handling', () => {
    it('should handle requests to non-existent device', async () => {
      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/ttyUSB0',
      })

      emulator.addDevice({ slaveId: 1 })

      await emulator.start()

      // Requesting from non-existent device 99 should throw
      await expect(capturedServiceVector.getHoldingRegister(0, 99)).rejects.toThrow()
    })
  })

  describe('Configuration', () => {
    it('should require port for RTU transport', () => {
      expect(() => {
        emulator = new ModbusEmulator({
          transport: 'rtu',
          // @ts-expect-error - testing missing port
          port: undefined,
        })
      }).toThrow('RTU transport requires port')
    })

    it('should accept all serial port options', async () => {
      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 38400,
        parity: 'odd',
        dataBits: 7,
        stopBits: 2,
      })

      await expect(emulator.start()).resolves.not.toThrow()
    })

    it('should pass configuration to ServerSerial', async () => {
      const { ServerSerial } = await import('modbus-serial')

      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 115200,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
      })

      await emulator.start()

      expect(ServerSerial).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          path: '/dev/ttyUSB0',
          baudRate: 115200,
          parity: 'even',
          dataBits: 8,
          stopBits: 1,
          unitID: 255,
        })
      )
    })
  })
})
