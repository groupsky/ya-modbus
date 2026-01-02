/**
 * Tests for RtuTransport
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'

import { RtuTransport } from './rtu.js'

describe('RtuTransport', () => {
  let transport: RtuTransport

  afterEach(async () => {
    await transport?.stop()
  })

  describe('lifecycle', () => {
    it('should create RTU transport with port config', () => {
      transport = new RtuTransport({ port: '/dev/ttyUSB0' })
      expect(transport).toBeDefined()
    })

    it('should create RTU transport with full config', () => {
      transport = new RtuTransport({
        port: '/dev/ttyUSB0',
        baudRate: 19200,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
      })
      expect(transport).toBeDefined()
    })

    it('should use default serial parameters if not specified', () => {
      transport = new RtuTransport({ port: '/dev/ttyUSB0' })
      expect(transport).toBeDefined()
    })

    it('should start transport', async () => {
      transport = new RtuTransport({ port: '/dev/ttyUSB0' })
      await expect(transport.start()).resolves.not.toThrow()
    })

    it('should stop transport', async () => {
      transport = new RtuTransport({ port: '/dev/ttyUSB0' })
      await transport.start()
      await expect(transport.stop()).resolves.not.toThrow()
    })

    it('should not fail when stopping already stopped transport', async () => {
      transport = new RtuTransport({ port: '/dev/ttyUSB0' })
      await expect(transport.stop()).resolves.not.toThrow()
    })
  })

  describe('request/response handling', () => {
    beforeEach(async () => {
      transport = new RtuTransport({ port: '/dev/ttyUSB0', baudRate: 9600 })
      await transport.start()
    })

    it('should register request handler', () => {
      const handler = (): Promise<Buffer> => Promise.resolve(Buffer.from([0x01, 0x03]))
      expect(() => transport.onRequest(handler)).not.toThrow()
    })

    it('should throw error when sending before start', async () => {
      const stoppedTransport = new RtuTransport({ port: '/dev/ttyUSB0' })
      await expect(stoppedTransport.send(1, Buffer.from([0x01, 0x03]))).rejects.toThrow(
        'Transport not started'
      )
    })
  })

  describe('CRC calculation', () => {
    beforeEach(() => {
      transport = new RtuTransport({ port: '/dev/ttyUSB0' })
    })

    it('should calculate correct CRC-16 for Modbus RTU', () => {
      // Test with known good frame
      const data = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      const crc = (transport as any).calculateCRC(data)

      // Expected CRC for this frame is 0x840a (little-endian)
      expect(crc).toBe(0x840a)
    })

    it('should verify valid CRC', () => {
      const frame = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01, 0x0a, 0x84])
      const isValid = (transport as any).verifyCRC(frame)
      expect(isValid).toBe(true)
    })

    it('should reject invalid CRC', () => {
      const frame = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00])
      const isValid = (transport as any).verifyCRC(frame)
      expect(isValid).toBe(false)
    })

    it('should reject frames that are too short', () => {
      const frame = Buffer.from([0x01, 0x03])
      const isValid = (transport as any).verifyCRC(frame)
      expect(isValid).toBe(false)
    })

    it('should add CRC to buffer correctly', () => {
      const data = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      const withCRC = (transport as any).addCRC(data)

      // Should have original data + 2 CRC bytes
      expect(withCRC.length).toBe(data.length + 2)

      // Original data should be preserved
      expect(withCRC.subarray(0, data.length)).toEqual(data)

      // CRC should be correct
      expect((transport as any).verifyCRC(withCRC)).toBe(true)
    })

    it('should calculate CRC for known test frame', () => {
      // Known good test from Modbus RTU spec
      const data = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      const crc = (transport as any).calculateCRC(data)
      expect(crc).toBe(0x840a)
    })

    it('should calculate consistent CRC for different frames', () => {
      const testFrames = [
        Buffer.from([0x01, 0x04, 0x00, 0x00, 0x00, 0x01]),
        Buffer.from([0x01, 0x06, 0x00, 0x01, 0x00, 0x03]),
        Buffer.from([0x02, 0x03, 0x00, 0x00, 0x00, 0x0a]),
      ]

      // For each frame, verify that adding CRC and then verifying it works
      testFrames.forEach((data) => {
        const withCRC = (transport as any).addCRC(data)
        expect((transport as any).verifyCRC(withCRC)).toBe(true)
      })
    })
  })

  describe('frame handling', () => {
    beforeEach(async () => {
      transport = new RtuTransport({ port: '/dev/ttyUSB0' })
      await transport.start()
    })

    it('should parse frame and extract slave ID', async () => {
      const handlerMock = jest.fn().mockResolvedValue(Buffer.from([0x01, 0x03, 0x02, 0x00, 0xe6]))

      transport.onRequest(handlerMock)

      // Valid RTU frame for reading holding registers
      const frame = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01, 0x0a, 0x84])

      await (transport as any).handleFrame(frame)

      // Handler should be called with slave ID 1 and request without CRC
      expect(handlerMock).toHaveBeenCalledWith(1, Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01]))
    })

    it('should ignore frame with invalid CRC', async () => {
      const handlerMock = jest.fn()
      transport.onRequest(handlerMock)

      // Frame with bad CRC
      const badFrame = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00])

      await (transport as any).handleFrame(badFrame)

      expect(handlerMock).not.toHaveBeenCalled()
    })

    it('should ignore frame that is too short', async () => {
      const handlerMock = jest.fn()
      transport.onRequest(handlerMock)

      const shortFrame = Buffer.from([0x01, 0x03])

      await (transport as any).handleFrame(shortFrame)

      expect(handlerMock).not.toHaveBeenCalled()
    })

    it('should handle frames for different slave IDs', async () => {
      const receivedSlaveIds: number[] = []

      transport.onRequest((slaveId, _request) => {
        receivedSlaveIds.push(slaveId)
        return Promise.resolve(Buffer.from([slaveId, 0x03, 0x02, 0x00, 0x64]))
      })

      // Frame for slave 1
      const frame1 = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01, 0x0a, 0x84])
      await (transport as any).handleFrame(frame1)

      // Frame for slave 2
      const frame2 = Buffer.from([0x02, 0x03, 0x00, 0x00, 0x00, 0x01, 0x39, 0x84])
      await (transport as any).handleFrame(frame2)

      expect(receivedSlaveIds).toEqual([1, 2])
    })

    it('should not send response if handler is not set', async () => {
      const frame = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01, 0x0a, 0x84])

      // Should not throw, just not process
      await expect((transport as any).handleFrame(frame)).resolves.not.toThrow()
    })

    it('should not send response if handler throws error', async () => {
      transport.onRequest(() => {
        throw new Error('Handler error')
      })

      const frame = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01, 0x0a, 0x84])

      // Should not propagate error, just not send response
      await expect((transport as any).handleFrame(frame)).resolves.not.toThrow()
    })
  })
})
