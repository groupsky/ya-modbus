/**
 * Tests for Modbus function code handlers
 */

import { describe, it, expect, beforeEach } from '@jest/globals'

import { EmulatedDevice } from '../device.js'

import { handleModbusRequest } from './function-codes.js'

describe('Modbus Function Codes', () => {
  let device: EmulatedDevice

  beforeEach(() => {
    device = new EmulatedDevice({
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
  })

  describe('0x03 - Read Holding Registers', () => {
    it('should read single holding register', () => {
      // Request: slave_id(1) + function_code(3) + start_address(0) + quantity(1)
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      const response = handleModbusRequest(device, request)

      // Response: slave_id(1) + function_code(3) + byte_count(2) + data(230 = 0x00E6)
      expect(response[0]).toBe(0x01) // Slave ID
      expect(response[1]).toBe(0x03) // Function code
      expect(response[2]).toBe(0x02) // Byte count
      expect(response.readUInt16BE(3)).toBe(230) // Register value
    })

    it('should read multiple holding registers', () => {
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x03])
      const response = handleModbusRequest(device, request)

      expect(response[0]).toBe(0x01)
      expect(response[1]).toBe(0x03)
      expect(response[2]).toBe(0x06) // 3 registers * 2 bytes
      expect(response.readUInt16BE(3)).toBe(230) // Register 0
      expect(response.readUInt16BE(5)).toBe(52) // Register 1
      expect(response.readUInt16BE(7)).toBe(1196) // Register 2
    })

    it('should return zeros for undefined registers', () => {
      const request = Buffer.from([0x01, 0x03, 0x00, 0x0a, 0x00, 0x02]) // Read registers 10-11
      const response = handleModbusRequest(device, request)

      expect(response[1]).toBe(0x03)
      expect(response[2]).toBe(0x04) // 2 registers * 2 bytes
      expect(response.readUInt16BE(3)).toBe(0)
      expect(response.readUInt16BE(5)).toBe(0)
    })

    it('should handle reading from middle of register space', () => {
      const request = Buffer.from([0x01, 0x03, 0x00, 0x01, 0x00, 0x02]) // Read registers 1-2
      const response = handleModbusRequest(device, request)

      expect(response[2]).toBe(0x04)
      expect(response.readUInt16BE(3)).toBe(52)
      expect(response.readUInt16BE(5)).toBe(1196)
    })
  })

  describe('0x04 - Read Input Registers', () => {
    it('should read single input register', () => {
      const request = Buffer.from([0x01, 0x04, 0x00, 0x00, 0x00, 0x01])
      const response = handleModbusRequest(device, request)

      expect(response[0]).toBe(0x01)
      expect(response[1]).toBe(0x04)
      expect(response[2]).toBe(0x02)
      expect(response.readUInt16BE(3)).toBe(500)
    })

    it('should read multiple input registers', () => {
      const request = Buffer.from([0x01, 0x04, 0x00, 0x00, 0x00, 0x02])
      const response = handleModbusRequest(device, request)

      expect(response[2]).toBe(0x04)
      expect(response.readUInt16BE(3)).toBe(500)
      expect(response.readUInt16BE(5)).toBe(60)
    })
  })

  describe('0x06 - Write Single Register', () => {
    it('should write single holding register', () => {
      const request = Buffer.from([0x01, 0x06, 0x00, 0x00, 0x01, 0x2c]) // Write 300 to register 0
      const response = handleModbusRequest(device, request)

      // Response echoes the request
      expect(response).toEqual(request)

      // Verify register was updated
      expect(device.getHoldingRegister(0)).toBe(300)
    })

    it('should write to new register', () => {
      const request = Buffer.from([0x01, 0x06, 0x00, 0x0a, 0x00, 0x64]) // Write 100 to register 10
      const response = handleModbusRequest(device, request)

      expect(response).toEqual(request)
      expect(device.getHoldingRegister(10)).toBe(100)
    })
  })

  describe('0x10 - Write Multiple Registers', () => {
    it('should write multiple holding registers', () => {
      // Write 3 registers starting at address 0
      const request = Buffer.from([
        0x01, // Slave ID
        0x10, // Function code
        0x00,
        0x00, // Start address
        0x00,
        0x03, // Quantity
        0x06, // Byte count (3 * 2)
        0x01,
        0xf4, // 500
        0x00,
        0x64, // 100
        0x00,
        0xc8, // 200
      ])
      const response = handleModbusRequest(device, request)

      // Response: slave_id + function_code + start_address + quantity
      expect(response[0]).toBe(0x01)
      expect(response[1]).toBe(0x10)
      expect(response.readUInt16BE(2)).toBe(0) // Start address
      expect(response.readUInt16BE(4)).toBe(3) // Quantity

      // Verify registers were updated
      expect(device.getHoldingRegister(0)).toBe(500)
      expect(device.getHoldingRegister(1)).toBe(100)
      expect(device.getHoldingRegister(2)).toBe(200)
    })

    it('should write single register using multiple write', () => {
      const request = Buffer.from([
        0x01,
        0x10,
        0x00,
        0x05, // Address 5
        0x00,
        0x01, // Quantity 1
        0x02, // Byte count
        0x00,
        0x0a, // Value 10
      ])
      const response = handleModbusRequest(device, request)

      expect(response.readUInt16BE(2)).toBe(5)
      expect(response.readUInt16BE(4)).toBe(1)
      expect(device.getHoldingRegister(5)).toBe(10)
    })
  })

  describe('Error handling', () => {
    it('should return exception for invalid function code', () => {
      const request = Buffer.from([0x01, 0x99, 0x00, 0x00, 0x00, 0x01])
      const response = handleModbusRequest(device, request)

      expect(response[0]).toBe(0x01) // Slave ID
      expect(response[1]).toBe(0x99 | 0x80) // Function code with error bit set (0x99 + 0x80 = 0x19 in display)
      expect(response[2]).toBe(0x01) // Exception code: ILLEGAL_FUNCTION
    })

    it('should handle empty request', () => {
      const request = Buffer.from([])
      const response = handleModbusRequest(device, request)

      expect(response[1]).toBe(0x80) // Error bit set, no function code
      expect(response[2]).toBe(0x03) // ILLEGAL_DATA_VALUE
    })

    it('should handle single byte request', () => {
      const request = Buffer.from([0x01])
      const response = handleModbusRequest(device, request)

      expect(response[0]).toBe(0x01)
      expect(response[1]).toBe(0x80) // Error bit set
      expect(response[2]).toBe(0x03) // ILLEGAL_DATA_VALUE
    })

    it('should validate request length for read holding registers', () => {
      const request = Buffer.from([0x01, 0x03, 0x00]) // Too short
      const response = handleModbusRequest(device, request)

      expect(response[1]).toBe(0x83) // 0x03 with error bit
      expect(response[2]).toBe(0x03) // ILLEGAL_DATA_VALUE
    })

    it('should validate request length for read input registers', () => {
      const request = Buffer.from([0x01, 0x04, 0x00]) // Too short
      const response = handleModbusRequest(device, request)

      expect(response[1]).toBe(0x84) // 0x04 with error bit
      expect(response[2]).toBe(0x03) // ILLEGAL_DATA_VALUE
    })

    it('should validate request length for write single register', () => {
      const request = Buffer.from([0x01, 0x06, 0x00, 0x00]) // Too short
      const response = handleModbusRequest(device, request)

      expect(response[1]).toBe(0x86) // 0x06 with error bit
      expect(response[2]).toBe(0x03) // ILLEGAL_DATA_VALUE
    })

    it('should validate request length for write multiple registers', () => {
      const request = Buffer.from([0x01, 0x10, 0x00, 0x00, 0x00, 0x01]) // Too short, missing byte count and data
      const response = handleModbusRequest(device, request)

      expect(response[1]).toBe(0x90) // 0x10 with error bit
      expect(response[2]).toBe(0x03) // ILLEGAL_DATA_VALUE
    })

    it('should validate byte count for write multiple registers', () => {
      const request = Buffer.from([
        0x01,
        0x10,
        0x00,
        0x00, // Start address
        0x00,
        0x02, // Quantity (2 registers)
        0x04, // Byte count
        0x00,
        0x01, // Only 2 bytes instead of 4
      ])
      const response = handleModbusRequest(device, request)

      expect(response[1]).toBe(0x90)
      expect(response[2]).toBe(0x03) // ILLEGAL_DATA_VALUE
    })

    it('should catch exceptions from device operations and return error response', () => {
      // Mock device method to throw an unexpected error
      jest.spyOn(device, 'getHoldingRegister').mockImplementationOnce(() => {
        throw new Error('Unexpected device error')
      })

      const request = Buffer.from([
        0x01,
        0x03, // Read holding registers
        0x00,
        0x00, // Start address
        0x00,
        0x01, // Quantity
      ])

      const response = handleModbusRequest(device, request)

      // Should return exception response
      expect(response[1]).toBe(0x83) // 0x03 with error bit
      expect(response[2]).toBe(0x03) // ILLEGAL_DATA_VALUE
    })
  })
})
