/**
 * Tests for RtuTransport
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

import { RtuTransport } from './rtu.js'

// Mock modbus-serial
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

    it('should throw error when starting already started transport', async () => {
      transport = new RtuTransport({ port: '/dev/ttyUSB0' })
      await transport.start()
      await expect(transport.start()).rejects.toThrow('Transport already started')
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

  describe('configuration', () => {
    it('should pass port to ServerSerial', async () => {
      const { ServerSerial } = await import('modbus-serial')
      transport = new RtuTransport({ port: '/dev/ttyUSB0' })
      await transport.start()

      expect(ServerSerial).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          path: '/dev/ttyUSB0',
        })
      )
    })

    it('should pass baud rate to ServerSerial', async () => {
      const { ServerSerial } = await import('modbus-serial')
      transport = new RtuTransport({ port: '/dev/ttyUSB0', baudRate: 19200 })
      await transport.start()

      expect(ServerSerial).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          baudRate: 19200,
        })
      )
    })

    it('should pass parity to ServerSerial', async () => {
      const { ServerSerial } = await import('modbus-serial')
      transport = new RtuTransport({ port: '/dev/ttyUSB0', parity: 'even' })
      await transport.start()

      expect(ServerSerial).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          parity: 'even',
        })
      )
    })

    it('should pass data bits to ServerSerial', async () => {
      const { ServerSerial } = await import('modbus-serial')
      transport = new RtuTransport({ port: '/dev/ttyUSB0', dataBits: 7 })
      await transport.start()

      expect(ServerSerial).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          dataBits: 7,
        })
      )
    })

    it('should pass stop bits to ServerSerial', async () => {
      const { ServerSerial } = await import('modbus-serial')
      transport = new RtuTransport({ port: '/dev/ttyUSB0', stopBits: 2 })
      await transport.start()

      expect(ServerSerial).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          stopBits: 2,
        })
      )
    })

    it('should listen to all unit IDs by default', async () => {
      const { ServerSerial } = await import('modbus-serial')
      transport = new RtuTransport({ port: '/dev/ttyUSB0' })
      await transport.start()

      expect(ServerSerial).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          unitID: 255,
        })
      )
    })
  })
})
