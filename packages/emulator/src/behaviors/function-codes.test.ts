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

  describe('coils and discrete inputs', () => {
    let bitDevice: EmulatedDevice

    beforeEach(() => {
      bitDevice = new EmulatedDevice({
        slaveId: 1,
        registers: {
          coils: { 0: true, 2: true, 8: true },
          discreteInputs: { 1: true, 9: true },
        },
      })
    })

    describe('0x01 - Read Coils', () => {
      it('should pack coils into bytes, the lowest address in the least significant bit', () => {
        // Coils 0-9: 1,0,1,0,0,0,0,0 | 1,0
        const request = Buffer.from([0x01, 0x01, 0x00, 0x00, 0x00, 0x0a])

        const response = handleModbusRequest(bitDevice, request)

        expect(response).toEqual(Buffer.from([0x01, 0x01, 0x02, 0b00000101, 0b00000001]))
      })

      it('should read coils that are not configured as off', () => {
        const request = Buffer.from([0x01, 0x01, 0x00, 0x03, 0x00, 0x05])

        const response = handleModbusRequest(bitDevice, request)

        expect(response).toEqual(Buffer.from([0x01, 0x01, 0x01, 0x00]))
      })

      it('should read from the middle of the coil space', () => {
        // Coils 8-9: 1,0
        const request = Buffer.from([0x01, 0x01, 0x00, 0x08, 0x00, 0x02])

        const response = handleModbusRequest(bitDevice, request)

        expect(response).toEqual(Buffer.from([0x01, 0x01, 0x01, 0b00000001]))
      })

      it('should pack by the offset from the start address, not by the absolute address', () => {
        // Coils 2-9: 1,0,0,0,0,0,1,0 (coils 2 and 8 are on)
        const request = Buffer.from([0x01, 0x01, 0x00, 0x02, 0x00, 0x08])

        const response = handleModbusRequest(bitDevice, request)

        expect(response).toEqual(Buffer.from([0x01, 0x01, 0x01, 0b01000001]))
      })

      it('should read the maximum of 2000 coils', () => {
        bitDevice.setCoil(1999, true)
        const request = Buffer.from([0x01, 0x01, 0x00, 0x00, 0x07, 0xd0])

        const response = handleModbusRequest(bitDevice, request)

        expect(response).toHaveLength(3 + 250)
        expect(response[2]).toBe(250)
        // Coil 1999 is bit 7 of the last byte
        expect(response[3 + 249]).toBe(0b10000000)
      })

      it('should read up to the last address 65535', () => {
        bitDevice.setCoil(0xffff, true)
        const request = Buffer.from([0x01, 0x01, 0xff, 0xff, 0x00, 0x01])

        const response = handleModbusRequest(bitDevice, request)

        expect(response).toEqual(Buffer.from([0x01, 0x01, 0x01, 0x01]))
      })
    })

    describe('0x02 - Read Discrete Inputs', () => {
      it('should pack discrete inputs into bytes, the lowest address in the least significant bit', () => {
        // Discrete inputs 0-9: 0,1,0,0,0,0,0,0 | 0,1
        const request = Buffer.from([0x01, 0x02, 0x00, 0x00, 0x00, 0x0a])

        const response = handleModbusRequest(bitDevice, request)

        expect(response).toEqual(Buffer.from([0x01, 0x02, 0x02, 0b00000010, 0b00000010]))
      })

      it('should not read coils', () => {
        const request = Buffer.from([0x01, 0x02, 0x00, 0x00, 0x00, 0x01])

        const response = handleModbusRequest(bitDevice, request)

        expect(response).toEqual(Buffer.from([0x01, 0x02, 0x01, 0x00]))
      })
    })

    describe('0x05 - Write Single Coil', () => {
      it.each([
        { name: 'on', value: [0xff, 0x00], expected: true },
        { name: 'off', value: [0x00, 0x00], expected: false },
      ])('should switch a coil $name and echo the request', ({ value, expected }) => {
        const request = Buffer.from([0x01, 0x05, 0x00, 0x00, ...value])

        const response = handleModbusRequest(bitDevice, request)

        expect(response).toEqual(request)
        expect(bitDevice.getCoil(0)).toBe(expected)
      })

      it('should write a coil that is not configured', () => {
        const request = Buffer.from([0x01, 0x05, 0x01, 0x00, 0xff, 0x00])

        handleModbusRequest(bitDevice, request)

        expect(bitDevice.getCoil(256)).toBe(true)
      })

      it('should reject a value that is neither 0xFF00 nor 0x0000', () => {
        const request = Buffer.from([0x01, 0x05, 0x00, 0x00, 0x12, 0x34])

        const response = handleModbusRequest(bitDevice, request)

        expect(response).toEqual(Buffer.from([0x01, 0x85, 0x03]))
        expect(bitDevice.getCoil(0)).toBe(true)
      })
    })

    describe('0x0F - Write Multiple Coils', () => {
      it('should write coils from bytes, the lowest address in the least significant bit', () => {
        // Coils 4-13: 1,0,1,1,0,0,0,0 | 1,1
        const request = Buffer.from([
          0x01, 0x0f, 0x00, 0x04, 0x00, 0x0a, 0x02, 0b00001101, 0b00000011,
        ])

        const response = handleModbusRequest(bitDevice, request)

        expect(response).toEqual(Buffer.from([0x01, 0x0f, 0x00, 0x04, 0x00, 0x0a]))
        const written = Array.from({ length: 10 }, (_, i) => bitDevice.getCoil(4 + i))
        expect(written).toEqual([true, false, true, true, false, false, false, false, true, true])
      })

      it('should ignore the padding bits of the last byte', () => {
        // 3 coils, the data byte has all bits set
        const request = Buffer.from([0x01, 0x0f, 0x00, 0x10, 0x00, 0x03, 0x01, 0xff])

        handleModbusRequest(bitDevice, request)

        expect(bitDevice.getCoil(0x12)).toBe(true)
        expect(bitDevice.getCoil(0x13)).toBe(false)
      })

      it('should write up to the last address 65535', () => {
        const request = Buffer.from([0x01, 0x0f, 0xff, 0xfe, 0x00, 0x02, 0x01, 0b00000011])

        const response = handleModbusRequest(bitDevice, request)

        expect(response).toEqual(Buffer.from([0x01, 0x0f, 0xff, 0xfe, 0x00, 0x02]))
        expect(bitDevice.getCoil(0xffff)).toBe(true)
      })

      it('should not change the coils around the written range', () => {
        const request = Buffer.from([0x01, 0x0f, 0x00, 0x01, 0x00, 0x01, 0x01, 0x00])

        handleModbusRequest(bitDevice, request)

        expect(bitDevice.getCoil(0)).toBe(true)
        expect(bitDevice.getCoil(1)).toBe(false)
        expect(bitDevice.getCoil(2)).toBe(true)
      })

      it('should write the maximum of 1968 coils', () => {
        const data = Array(246).fill(0xff)
        const request = Buffer.from([0x01, 0x0f, 0x00, 0x00, 0x07, 0xb0, 246, ...data])

        const response = handleModbusRequest(bitDevice, request)

        expect(response).toEqual(Buffer.from([0x01, 0x0f, 0x00, 0x00, 0x07, 0xb0]))
        expect(bitDevice.getCoil(1967)).toBe(true)
        expect(bitDevice.getCoil(1968)).toBe(false)
      })
    })

    describe('requests past the last address', () => {
      const ILLEGAL_DATA_ADDRESS = 0x02

      it.each([
        { name: 'read coils', request: [0x01, 0x01, 0xff, 0xff, 0x00, 0x02] },
        { name: 'read discrete inputs', request: [0x01, 0x02, 0xff, 0xff, 0x00, 0x02] },
        { name: 'write multiple coils', request: [0x01, 0x0f, 0xff, 0xff, 0x00, 0x02, 0x01, 0x03] },
      ])('should answer $name with exception 0x02', ({ request }) => {
        const response = handleModbusRequest(bitDevice, Buffer.from(request))

        expect(response).toEqual(Buffer.from([0x01, request[1]! | 0x80, ILLEGAL_DATA_ADDRESS]))
        expect(bitDevice.getCoil(0xffff)).toBe(false)
      })
    })

    describe('invalid requests', () => {
      const ILLEGAL_DATA_VALUE = 0x03

      it.each([
        { name: 'read coils: too short', request: [0x01, 0x01, 0x00, 0x00, 0x00] },
        { name: 'read coils: no coils', request: [0x01, 0x01, 0x00, 0x00, 0x00, 0x00] },
        { name: 'read coils: more than 2000', request: [0x01, 0x01, 0x00, 0x00, 0x07, 0xd1] },
        { name: 'read discrete inputs: too short', request: [0x01, 0x02, 0x00] },
        { name: 'read discrete inputs: no inputs', request: [0x01, 0x02, 0x00, 0x00, 0x00, 0x00] },
        {
          name: 'read discrete inputs: more than 2000',
          request: [0x01, 0x02, 0x00, 0x00, 0x07, 0xd1],
        },
        { name: 'write single coil: too short', request: [0x01, 0x05, 0x00, 0x00, 0xff] },
        { name: 'write multiple coils: too short', request: [0x01, 0x0f, 0x00, 0x00, 0x00, 0x01] },
        {
          name: 'write multiple coils: no coils',
          request: [0x01, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x00],
        },
        {
          name: 'write multiple coils: more than 1968',
          request: [0x01, 0x0f, 0x00, 0x00, 0x07, 0xb1, 247, ...Array(247).fill(0xff)],
        },
        {
          name: 'write multiple coils: byte count does not fit the quantity',
          request: [0x01, 0x0f, 0x00, 0x00, 0x00, 0x09, 0x01, 0xff],
        },
        {
          name: 'write multiple coils: data shorter than the byte count',
          request: [0x01, 0x0f, 0x00, 0x00, 0x00, 0x09, 0x02, 0xff],
        },
      ])('should answer $name with exception 0x03', ({ request }) => {
        const response = handleModbusRequest(bitDevice, Buffer.from(request))

        expect(response).toEqual(Buffer.from([0x01, request[1]! | 0x80, ILLEGAL_DATA_VALUE]))
        expect(bitDevice.getCoil(0)).toBe(true)
        expect(bitDevice.getCoil(1)).toBe(false)
      })
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
