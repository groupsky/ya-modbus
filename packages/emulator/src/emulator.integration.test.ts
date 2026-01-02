/**
 * Integration tests for ModbusEmulator with function codes
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'

import { ModbusEmulator } from './emulator.js'
import type { MemoryTransport } from './transports/memory.js'

describe('ModbusEmulator Integration', () => {
  let emulator: ModbusEmulator

  afterEach(async () => {
    if (emulator) {
      await emulator.stop()
    }
  })

  describe('Read operations', () => {
    beforeEach(async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })

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

    it('should read holding registers via transport', async () => {
      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x02])

      // @ts-expect-error - accessing protected method for testing
      const response = await transport.sendRequest(1, request)

      expect(response[0]).toBe(0x01)
      expect(response[1]).toBe(0x03)
      expect(response[2]).toBe(0x04) // 2 registers * 2 bytes
      expect(response.readUInt16BE(3)).toBe(230)
      expect(response.readUInt16BE(5)).toBe(52)
    })

    it('should read input registers via transport', async () => {
      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x04, 0x00, 0x00, 0x00, 0x02])

      // @ts-expect-error - accessing protected method for testing
      const response = await transport.sendRequest(1, request)

      expect(response[1]).toBe(0x04)
      expect(response.readUInt16BE(3)).toBe(500)
      expect(response.readUInt16BE(5)).toBe(60)
    })
  })

  describe('Write operations', () => {
    beforeEach(async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({ slaveId: 1 })
      await emulator.start()
    })

    it('should write single register via transport', async () => {
      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x06, 0x00, 0x00, 0x01, 0x2c]) // Write 300 to register 0

      // @ts-expect-error - accessing protected method for testing
      const response = await transport.sendRequest(1, request)

      expect(response).toEqual(request)

      // Verify by reading back
      const readRequest = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      // @ts-expect-error - accessing protected method for testing
      const readResponse = await transport.sendRequest(1, readRequest)

      expect(readResponse.readUInt16BE(3)).toBe(300)
    })

    it('should write multiple registers via transport', async () => {
      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([
        0x01, // Slave ID
        0x10, // Function code
        0x00,
        0x00, // Start address
        0x00,
        0x03, // Quantity
        0x06, // Byte count
        0x01,
        0xf4, // 500
        0x00,
        0x64, // 100
        0x00,
        0xc8, // 200
      ])

      // @ts-expect-error - accessing protected method for testing
      const response = await transport.sendRequest(1, request)

      expect(response[1]).toBe(0x10)
      expect(response.readUInt16BE(4)).toBe(3) // Quantity written

      // Verify by reading back
      const readRequest = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x03])
      // @ts-expect-error - accessing protected method for testing
      const readResponse = await transport.sendRequest(1, readRequest)

      expect(readResponse.readUInt16BE(3)).toBe(500)
      expect(readResponse.readUInt16BE(5)).toBe(100)
      expect(readResponse.readUInt16BE(7)).toBe(200)
    })
  })

  describe('Multiple devices', () => {
    beforeEach(async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })

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

    it('should route requests to correct device', async () => {
      const transport = emulator.getTransport() as MemoryTransport

      // Read from device 1
      const request1 = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      // @ts-expect-error - accessing protected method for testing
      const response1 = await transport.sendRequest(1, request1)
      expect(response1.readUInt16BE(3)).toBe(100)

      // Read from device 2
      const request2 = Buffer.from([0x02, 0x03, 0x00, 0x00, 0x00, 0x01])
      // @ts-expect-error - accessing protected method for testing
      const response2 = await transport.sendRequest(2, request2)
      expect(response2.readUInt16BE(3)).toBe(200)
    })

    it('should return exception for non-existent device', async () => {
      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x03, 0x03, 0x00, 0x00, 0x00, 0x01]) // Slave ID 3 doesn't exist

      // @ts-expect-error - accessing protected method for testing
      const response = await transport.sendRequest(3, request)

      expect(response[0]).toBe(0x03) // Slave ID
      expect(response[1]).toBe(0x83) // Function code with error bit
      expect(response[2]).toBe(0x0b) // Gateway Target Device Failed to Respond
    })
  })

  describe('Error handling', () => {
    beforeEach(async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({ slaveId: 1 })
      await emulator.start()
    })

    it('should return exception for invalid function code', async () => {
      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x99, 0x00, 0x00, 0x00, 0x01])

      // @ts-expect-error - accessing protected method for testing
      const response = await transport.sendRequest(1, request)

      expect(response[1]).toBe(0x99 | 0x80) // Function code with error bit
      expect(response[2]).toBe(0x01) // ILLEGAL_FUNCTION
    })
  })
})
