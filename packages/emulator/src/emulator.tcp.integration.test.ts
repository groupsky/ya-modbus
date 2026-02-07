/**
 * Integration tests for ModbusEmulator with TCP transport
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

import { ModbusEmulator } from './emulator.js'
import { callServiceVector } from './transports/test-helpers.js'

// Store captured service vector for testing
let capturedServiceVector: any = null
let initializedListener: (() => void) | undefined

// Mock modbus-serial ServerTCP
jest.mock('modbus-serial', () => {
  return {
    ServerTCP: jest.fn().mockImplementation((vector: any, _options: any) => {
      // Capture service vector for testing
      capturedServiceVector = vector

      // Reset listeners
      initializedListener = undefined

      // Create mock server instance
      const mockInstance = {
        close: jest.fn((cb: (err: Error | null) => void) => cb(null)),
        on: jest.fn((event: string, listener: any) => {
          if (event === 'initialized') {
            initializedListener = listener
          }
        }),
        socks: new Map(),
      }

      // Emit initialized event after setup
      setImmediate(() => {
        if (initializedListener) {
          initializedListener()
        }
      })

      return mockInstance
    }),
  }
})

describe('ModbusEmulator with TCP transport', () => {
  let emulator: ModbusEmulator

  beforeEach(() => {
    capturedServiceVector = null
  })

  afterEach(async () => {
    await emulator?.stop()
  })

  describe('read operations', () => {
    beforeEach(async () => {
      emulator = new ModbusEmulator({
        transport: 'tcp',
        host: 'localhost',
        port: 502,
      })
      emulator.addDevice({
        slaveId: 1,
        registers: {
          holding: { 0: 230 },
          input: { 0: 52 },
        },
      })
      await emulator.start()
    })

    it('should read single holding register via TCP service vector', async () => {
      const result = await callServiceVector<number>(
        capturedServiceVector.getHoldingRegister.bind(capturedServiceVector),
        0,
        1
      )
      expect(result).toEqual(230)
    })

    it('should read single input register via TCP service vector', async () => {
      const result = await callServiceVector<number>(
        capturedServiceVector.getInputRegister.bind(capturedServiceVector),
        0,
        1
      )
      expect(result).toEqual(52)
    })

    it('should read multiple holding registers via TCP service vector', async () => {
      emulator.addDevice({
        slaveId: 2,
        registers: {
          holding: { 0: 100, 1: 200 },
        },
      })

      const result = await callServiceVector<number[]>(
        capturedServiceVector.getMultipleHoldingRegisters.bind(capturedServiceVector),
        0,
        2,
        2
      )
      expect(result).toEqual([100, 200])
    })

    it('should read multiple input registers via TCP service vector', async () => {
      emulator.addDevice({
        slaveId: 2,
        registers: {
          input: { 0: 150, 1: 250 },
        },
      })

      const result = await callServiceVector<number[]>(
        capturedServiceVector.getMultipleInputRegisters.bind(capturedServiceVector),
        0,
        2,
        2
      )
      expect(result).toEqual([150, 250])
    })
  })

  describe('write operations', () => {
    beforeEach(async () => {
      emulator = new ModbusEmulator({
        transport: 'tcp',
        host: 'localhost',
        port: 502,
      })
      emulator.addDevice({
        slaveId: 1,
        registers: {
          holding: { 0: 100 },
        },
      })
      await emulator.start()
    })

    it('should write single register via TCP service vector', async () => {
      await capturedServiceVector.setRegister(0, 300, 1)

      // Verify by reading back
      const result = await callServiceVector<number>(
        capturedServiceVector.getHoldingRegister.bind(capturedServiceVector),
        0,
        1
      )
      expect(result).toEqual(300)
    })

    it('should write multiple registers via TCP service vector', async () => {
      emulator.addDevice({
        slaveId: 2,
        registers: {
          holding: { 0: 0, 1: 0 },
        },
      })

      await capturedServiceVector.setRegisterArray(0, [400, 500], 2)

      // Verify by reading back
      const result = await callServiceVector<number[]>(
        capturedServiceVector.getMultipleHoldingRegisters.bind(capturedServiceVector),
        0,
        2,
        2
      )
      expect(result).toEqual([400, 500])
    })
  })

  describe('multiple devices', () => {
    beforeEach(async () => {
      emulator = new ModbusEmulator({
        transport: 'tcp',
        host: 'localhost',
        port: 502,
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
      const result1 = await callServiceVector<number>(
        capturedServiceVector.getHoldingRegister.bind(capturedServiceVector),
        0,
        1
      )
      expect(result1).toEqual(100)

      const result2 = await callServiceVector<number>(
        capturedServiceVector.getHoldingRegister.bind(capturedServiceVector),
        0,
        2
      )
      expect(result2).toEqual(200)
    })
  })

  describe('error handling', () => {
    it('should handle requests to non-existent device', async () => {
      emulator = new ModbusEmulator({
        transport: 'tcp',
        host: 'localhost',
        port: 502,
      })

      emulator.addDevice({ slaveId: 1 })

      await emulator.start()

      // Requesting from non-existent device 99 should throw
      await expect(
        callServiceVector(
          capturedServiceVector.getHoldingRegister.bind(capturedServiceVector),
          0,
          99
        )
      ).rejects.toThrow()
    })
  })

  describe('configuration', () => {
    it('should require host for TCP transport', () => {
      expect(
        () =>
          new ModbusEmulator({
            transport: 'tcp',
            port: 502,
          } as any)
      ).toThrow('TCP transport requires host')
    })

    it('should require port for TCP transport', () => {
      expect(
        () =>
          new ModbusEmulator({
            transport: 'tcp',
            host: 'localhost',
          } as any)
      ).toThrow('TCP transport requires port')
    })

    it('should create TCP transport with valid config', async () => {
      const { ServerTCP } = await import('modbus-serial')

      emulator = new ModbusEmulator({
        transport: 'tcp',
        host: '127.0.0.1',
        port: 8502,
      })
      emulator.addDevice({
        slaveId: 1,
        registers: {
          holding: { 0: 100 },
        },
      })
      await emulator.start()

      expect(ServerTCP).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          host: '127.0.0.1',
          port: 8502,
          unitID: 255,
        })
      )
    })
  })
})
