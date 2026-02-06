/**
 * Integration tests for RTU transport with emulator
 *
 * These tests verify the RTU transport integrates correctly with the emulator.
 * They use mocked serial port to avoid requiring real hardware.
 *
 * For real serial port testing, use virtual serial port pairs (socat) or
 * physical hardware with the examples in packages/emulator/examples/.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

import { ModbusEmulator } from '../emulator.js'

// Mock modbus-serial for integration tests
jest.mock('modbus-serial', () => {
  return {
    ServerSerial: jest.fn().mockImplementation((_vector: any, options: any) => {
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

describe('RTU Transport Integration', () => {
  let emulator: ModbusEmulator

  afterEach(async () => {
    if (emulator) {
      await emulator.stop()
    }
  })

  describe('Emulator initialization', () => {
    it('should create emulator with RTU transport', () => {
      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/ttyUSB0',
      })

      expect(emulator).toBeDefined()
    })

    it('should start emulator with RTU transport', async () => {
      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
      })

      await expect(emulator.start()).resolves.not.toThrow()
    })

    it('should stop emulator with RTU transport', async () => {
      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/ttyUSB0',
      })

      await emulator.start()
      await expect(emulator.stop()).resolves.not.toThrow()
    })

    it('should throw error when port is not specified', () => {
      expect(
        () =>
          new ModbusEmulator({
            transport: 'rtu',
            // @ts-expect-error - testing missing port
            port: undefined,
          })
      ).toThrow('RTU transport requires port')
    })

    it('should throw error when port is not a string', () => {
      expect(
        () =>
          new ModbusEmulator({
            transport: 'rtu',
            // @ts-expect-error - testing invalid port type
            port: 1234,
          })
      ).toThrow('RTU transport requires port')
    })
  })

  describe('Device management', () => {
    beforeEach(async () => {
      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 19200,
        parity: 'even',
      })

      await emulator.start()
    })

    it('should add device to RTU emulator', () => {
      const device = emulator.addDevice({
        slaveId: 1,
        registers: {
          holding: {
            0: 100,
          },
        },
      })

      expect(device).toBeDefined()
      expect(emulator.getDevice(1)).toBe(device)
    })

    it('should add multiple devices to RTU emulator', () => {
      const device1 = emulator.addDevice({ slaveId: 1 })
      const device2 = emulator.addDevice({ slaveId: 2 })
      const device3 = emulator.addDevice({ slaveId: 3 })

      expect(emulator.getDevice(1)).toBe(device1)
      expect(emulator.getDevice(2)).toBe(device2)
      expect(emulator.getDevice(3)).toBe(device3)
    })

    it('should remove device from RTU emulator', () => {
      emulator.addDevice({ slaveId: 1 })
      emulator.removeDevice(1)

      expect(emulator.getDevice(1)).toBeUndefined()
    })
  })

  describe('Configuration options', () => {
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

    it('should work with minimal configuration', async () => {
      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/ttyUSB0',
      })

      await expect(emulator.start()).resolves.not.toThrow()
    })

    it('should work with common 9600 baud configuration', async () => {
      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      })

      await expect(emulator.start()).resolves.not.toThrow()
    })

    it('should work with common 19200 baud configuration', async () => {
      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 19200,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
      })

      await expect(emulator.start()).resolves.not.toThrow()
    })
  })

  describe('ServerSerial integration', () => {
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

    it('should register error handler with ServerSerial', async () => {
      const mockServerInstance = {
        close: jest.fn((cb: (err: Error | null) => void) => cb(null)),
        on: jest.fn(),
        socks: new Map(),
      }

      const { ServerSerial } = await import('modbus-serial')
      ;(ServerSerial as any).mockImplementationOnce((_vector: any, options: any) => {
        if (options.openCallback) {
          setImmediate(() => options.openCallback(null))
        }
        return mockServerInstance
      })

      emulator = new ModbusEmulator({
        transport: 'rtu',
        port: '/dev/ttyUSB0',
      })

      await emulator.start()

      expect(mockServerInstance.on).toHaveBeenCalledWith('error', expect.any(Function))
    })
  })
})
