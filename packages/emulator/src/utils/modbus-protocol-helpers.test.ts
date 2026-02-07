/**
 * Tests for Modbus protocol helpers
 */

import { describe, it, expect } from '@jest/globals'

import {
  buildRegisterReadRequest,
  parseRegisterReadResponse,
  buildRegisterWriteRequest,
  buildCoilReadRequest,
  parseCoilReadResponse,
  buildCoilWriteRequest,
} from './modbus-protocol-helpers.js'

describe('Modbus Protocol Helpers', () => {
  describe('buildRegisterReadRequest', () => {
    it('should build read holding register request', () => {
      const request = buildRegisterReadRequest({
        unitID: 1,
        functionCode: 0x03,
        addr: 100,
        length: 10,
      })

      expect(request).toHaveLength(6)
      expect(request[0]).toBe(1) // Unit ID
      expect(request[1]).toBe(0x03) // Function code
      expect(request.readUInt16BE(2)).toBe(100) // Address
      expect(request.readUInt16BE(4)).toBe(10) // Length
    })

    it('should build read input register request', () => {
      const request = buildRegisterReadRequest({
        unitID: 2,
        functionCode: 0x04,
        addr: 200,
        length: 5,
      })

      expect(request[0]).toBe(2)
      expect(request[1]).toBe(0x04)
      expect(request.readUInt16BE(2)).toBe(200)
      expect(request.readUInt16BE(4)).toBe(5)
    })
  })

  describe('parseRegisterReadResponse', () => {
    it('should parse single register value', () => {
      // Response: unit=1, func=3, byteCount=2, value=230
      const response = Buffer.from([0x01, 0x03, 0x02, 0x00, 0xe6])

      const values = parseRegisterReadResponse(response, { unitID: 1, functionCode: 0x03 })

      expect(values).toEqual([230])
    })

    it('should parse multiple register values', () => {
      // Response: unit=1, func=3, byteCount=4, values=[230, 52]
      const response = Buffer.from([0x01, 0x03, 0x04, 0x00, 0xe6, 0x00, 0x34])

      const values = parseRegisterReadResponse(response, { unitID: 1, functionCode: 0x03 })

      expect(values).toEqual([230, 52])
    })

    it('should throw error on invalid response length', () => {
      const response = Buffer.from([0x01, 0x03, 0x02]) // Missing data

      expect(() => parseRegisterReadResponse(response, { unitID: 1, functionCode: 0x03 })).toThrow(
        'Invalid response'
      )
    })

    it('should throw error on undefined byte count', () => {
      const response = Buffer.from([0x01, 0x03]) // Missing byte count

      expect(() => parseRegisterReadResponse(response, { unitID: 1, functionCode: 0x03 })).toThrow(
        'Invalid response'
      )
    })

    it('should throw error when unitID does not match', () => {
      const response = Buffer.from([0x02, 0x03, 0x02, 0x00, 0xe6])

      expect(() => parseRegisterReadResponse(response, { unitID: 1, functionCode: 0x03 })).toThrow(
        'Response unitID mismatch: expected 1, got 2'
      )
    })

    it('should throw error when functionCode does not match (non-exception)', () => {
      const response = Buffer.from([0x01, 0x04, 0x02, 0x00, 0xe6])

      expect(() => parseRegisterReadResponse(response, { unitID: 1, functionCode: 0x03 })).toThrow(
        'Response function code mismatch: expected 3, got 4'
      )
    })

    it('should throw error on Modbus exception response', () => {
      // Exception response: unit=1, func=0x83 (0x03 + 0x80), exceptionCode=2
      const response = Buffer.from([0x01, 0x83, 0x02])

      expect(() => parseRegisterReadResponse(response, { unitID: 1, functionCode: 0x03 })).toThrow(
        'Modbus exception response: function code 3, exception code 2'
      )
    })

    it('should throw error when byte count is odd', () => {
      const response = Buffer.from([0x01, 0x03, 0x03, 0x00, 0xe6, 0x00])

      expect(() => parseRegisterReadResponse(response, { unitID: 1, functionCode: 0x03 })).toThrow(
        'Invalid byte count: 3 (must be even for 16-bit registers)'
      )
    })

    it('should throw error when byte count exceeds maximum', () => {
      const byteCount = 252 // Exceeds max of 250
      const response = Buffer.alloc(3 + byteCount)
      response[0] = 0x01
      response[1] = 0x03
      response[2] = byteCount

      expect(() => parseRegisterReadResponse(response, { unitID: 1, functionCode: 0x03 })).toThrow(
        'Invalid byte count: 252 (maximum is 250)'
      )
    })

    it('should throw error when byte count does not match buffer length', () => {
      // Declares 6 bytes but only provides 4
      const response = Buffer.from([0x01, 0x03, 0x06, 0x00, 0xe6, 0x00, 0x34])

      expect(() => parseRegisterReadResponse(response, { unitID: 1, functionCode: 0x03 })).toThrow(
        'Invalid response: buffer length 7 does not match expected length 9 (3 + byteCount 6)'
      )
    })
  })

  describe('buildRegisterWriteRequest', () => {
    it('should build single register write request (0x06)', () => {
      const request = buildRegisterWriteRequest({
        unitID: 1,
        functionCode: 0x06,
        addr: 100,
        values: [230],
      })

      expect(request).toHaveLength(6)
      expect(request[0]).toBe(1)
      expect(request[1]).toBe(0x06)
      expect(request.readUInt16BE(2)).toBe(100)
      expect(request.readUInt16BE(4)).toBe(230)
    })

    it('should build multiple register write request (0x10)', () => {
      const request = buildRegisterWriteRequest({
        unitID: 1,
        functionCode: 0x10,
        addr: 100,
        values: [230, 52],
      })

      expect(request).toHaveLength(11) // 7 + 2*2
      expect(request[0]).toBe(1)
      expect(request[1]).toBe(0x10)
      expect(request.readUInt16BE(2)).toBe(100) // Address
      expect(request.readUInt16BE(4)).toBe(2) // Register count
      expect(request[6]).toBe(4) // Byte count
      expect(request.readUInt16BE(7)).toBe(230) // First value
      expect(request.readUInt16BE(9)).toBe(52) // Second value
    })

    it('should handle empty values array gracefully', () => {
      const request = buildRegisterWriteRequest({
        unitID: 1,
        functionCode: 0x06,
        addr: 100,
        values: [],
      })

      expect(request.readUInt16BE(4)).toBe(0) // Uses 0 when array is empty
    })
  })

  describe('buildCoilReadRequest', () => {
    it('should build read coil request', () => {
      const request = buildCoilReadRequest({
        unitID: 1,
        functionCode: 0x01,
        addr: 50,
        length: 8,
      })

      expect(request).toHaveLength(6)
      expect(request[0]).toBe(1)
      expect(request[1]).toBe(0x01)
      expect(request.readUInt16BE(2)).toBe(50)
      expect(request.readUInt16BE(4)).toBe(8)
    })

    it('should build read discrete input request', () => {
      const request = buildCoilReadRequest({
        unitID: 2,
        functionCode: 0x02,
        addr: 75,
        length: 1,
      })

      expect(request[0]).toBe(2)
      expect(request[1]).toBe(0x02)
      expect(request.readUInt16BE(2)).toBe(75)
      expect(request.readUInt16BE(4)).toBe(1)
    })
  })

  describe('parseCoilReadResponse', () => {
    it('should parse true coil value', () => {
      // Response: unit=1, func=1, byteCount=1, coilByte=0x01 (bit 0 = 1)
      const response = Buffer.from([0x01, 0x01, 0x01, 0x01])

      const value = parseCoilReadResponse(response, { unitID: 1, functionCode: 0x01 })

      expect(value).toBe(true)
    })

    it('should parse false coil value', () => {
      // Response: unit=1, func=1, byteCount=1, coilByte=0x00 (bit 0 = 0)
      const response = Buffer.from([0x01, 0x01, 0x01, 0x00])

      const value = parseCoilReadResponse(response, { unitID: 1, functionCode: 0x01 })

      expect(value).toBe(false)
    })

    it('should parse true from coil byte with multiple bits set', () => {
      // Response: coilByte=0xFF (bit 0 = 1)
      const response = Buffer.from([0x01, 0x01, 0x01, 0xff])

      const value = parseCoilReadResponse(response, { unitID: 1, functionCode: 0x01 })

      expect(value).toBe(true)
    })

    it('should parse false from coil byte with other bits set', () => {
      // Response: coilByte=0xFE (bit 0 = 0, other bits = 1)
      const response = Buffer.from([0x01, 0x01, 0x01, 0xfe])

      const value = parseCoilReadResponse(response, { unitID: 1, functionCode: 0x01 })

      expect(value).toBe(false)
    })

    it('should throw error on invalid response length', () => {
      const response = Buffer.from([0x01, 0x01, 0x01]) // Missing coil byte

      expect(() => parseCoilReadResponse(response, { unitID: 1, functionCode: 0x01 })).toThrow(
        'Invalid response'
      )
    })

    it('should throw error on undefined byte count', () => {
      const response = Buffer.from([0x01, 0x01]) // Missing byte count

      expect(() => parseCoilReadResponse(response, { unitID: 1, functionCode: 0x01 })).toThrow(
        'Invalid response'
      )
    })

    it('should throw error on undefined coil byte', () => {
      const response = Buffer.from([0x01, 0x01, 0x01]) // byte count present but no data

      expect(() => parseCoilReadResponse(response, { unitID: 1, functionCode: 0x01 })).toThrow(
        'Invalid response'
      )
    })

    it('should throw error when unitID does not match', () => {
      const response = Buffer.from([0x02, 0x01, 0x01, 0x01])

      expect(() => parseCoilReadResponse(response, { unitID: 1, functionCode: 0x01 })).toThrow(
        'Response unitID mismatch: expected 1, got 2'
      )
    })

    it('should throw error when functionCode does not match (non-exception)', () => {
      const response = Buffer.from([0x01, 0x02, 0x01, 0x01])

      expect(() => parseCoilReadResponse(response, { unitID: 1, functionCode: 0x01 })).toThrow(
        'Response function code mismatch: expected 1, got 2'
      )
    })

    it('should throw error on Modbus exception response', () => {
      // Exception response: unit=1, func=0x81 (0x01 + 0x80), exceptionCode=3
      const response = Buffer.from([0x01, 0x81, 0x03])

      expect(() => parseCoilReadResponse(response, { unitID: 1, functionCode: 0x01 })).toThrow(
        'Modbus exception response: function code 1, exception code 3'
      )
    })
  })

  describe('buildCoilWriteRequest', () => {
    it('should build write coil true request', () => {
      const request = buildCoilWriteRequest({
        unitID: 1,
        functionCode: 0x05,
        addr: 50,
        value: true,
      })

      expect(request).toHaveLength(6)
      expect(request[0]).toBe(1)
      expect(request[1]).toBe(0x05)
      expect(request.readUInt16BE(2)).toBe(50)
      expect(request.readUInt16BE(4)).toBe(0xff00)
    })

    it('should build write coil false request', () => {
      const request = buildCoilWriteRequest({
        unitID: 1,
        functionCode: 0x05,
        addr: 50,
        value: false,
      })

      expect(request.readUInt16BE(4)).toBe(0x0000)
    })
  })
})
