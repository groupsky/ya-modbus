/**
 * Tests for RtuTransport
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

import { RtuTransport } from './rtu.js'

// Store captured service vector for testing
let capturedServiceVector: any = null
let mockServerInstance: any
let eventListeners: Map<string, Set<(...args: unknown[]) => void>>

// Mock modbus-serial
jest.mock('modbus-serial', () => {
  return {
    ServerSerial: jest
      .fn()
      .mockImplementation((vector: any, options: any, _serialportOptions?: any) => {
        // Capture service vector for testing
        capturedServiceVector = vector
        eventListeners = new Map()

        // Call openCallback immediately to simulate successful connection
        if (options.openCallback) {
          setImmediate(() => options.openCallback(null))
        }

        mockServerInstance = {
          close: jest.fn((cb: (err: Error | null) => void) => cb(null)),
          on: jest.fn((event: string, listener: (...args: unknown[]) => void) => {
            // Track listeners
            if (!eventListeners.has(event)) {
              eventListeners.set(event, new Set())
            }
            eventListeners.get(event)!.add(listener)
          }),
          removeAllListeners: jest.fn((event?: string) => {
            if (event) {
              eventListeners.delete(event)
            } else {
              eventListeners.clear()
            }
          }),
          listenerCount: jest.fn((event: string) => {
            return eventListeners.get(event)?.size ?? 0
          }),
          socks: new Map(),
        }

        return mockServerInstance
      }),
  }
})

describe('RtuTransport', () => {
  let transport: RtuTransport

  beforeEach(() => {
    capturedServiceVector = null
    jest.clearAllMocks()
  })

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

    it('should not accumulate event listeners after repeated start/stop cycles', async () => {
      // This test verifies the fix for issue #253: Event listener memory leak
      // RTU transport has the same issue as TCP - 'error' listener is never removed

      // Track listener counts across multiple transports
      const listenerCounts: number[] = []

      // Run 5 start/stop cycles
      for (let i = 0; i < 5; i++) {
        transport = new RtuTransport({ port: '/dev/ttyUSB0' })
        await transport.start()

        // Record listener count after start (only 'error' listener in RTU)
        const count = mockServerInstance.listenerCount('error')
        listenerCounts.push(count)

        await transport.stop()
      }

      // After the fix: all cycles should have the same listener count (1 listener per cycle)
      // Before the fix: listener count would grow with each cycle
      expect(listenerCounts).toEqual([1, 1, 1, 1, 1])

      // Verify removeAllListeners was called during each stop
      expect(mockServerInstance.removeAllListeners).toHaveBeenCalled()
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

    it('should resolve when sending after start', async () => {
      await expect(transport.send(1, Buffer.from([0x01, 0x03]))).resolves.toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('should reject on start error', async () => {
      const { ServerSerial } = await import('modbus-serial')
      const startError = new Error('Failed to open port')

      ;(ServerSerial as any).mockImplementationOnce((vector: any, options: any) => {
        if (options.openCallback) {
          setImmediate(() => options.openCallback(startError))
        }
        return {
          close: jest.fn(),
          on: jest.fn(),
          socks: new Map(),
        }
      })

      transport = new RtuTransport({ port: '/dev/ttyUSB0' })
      await expect(transport.start()).rejects.toThrow('Failed to open port')
    })

    it('should reject on stop error', async () => {
      const { ServerSerial } = await import('modbus-serial')
      const closeError = new Error('Failed to close port')
      let closeCallback: ((err: Error | null) => void) | undefined
      ;(ServerSerial as any).mockImplementationOnce((vector: any, options: any) => {
        if (options.openCallback) {
          setImmediate(() => options.openCallback(null))
        }
        return {
          close: jest.fn((cb: (err: Error | null) => void) => {
            closeCallback = cb
          }),
          on: jest.fn(),
          removeAllListeners: jest.fn(),
          socks: new Map(),
        }
      })

      const testTransport = new RtuTransport({ port: '/dev/ttyUSB0' })
      await testTransport.start()

      const stopPromise = testTransport.stop()
      setImmediate(() => closeCallback?.(closeError))

      await expect(stopPromise).rejects.toThrow('Failed to close port')
    })

    it('should handle error event', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      let errorHandler: ((err: Error) => void) | undefined

      const { ServerSerial } = await import('modbus-serial')
      ;(ServerSerial as any).mockImplementationOnce((vector: any, options: any) => {
        if (options.openCallback) {
          setImmediate(() => options.openCallback(null))
        }
        return {
          close: jest.fn((cb: (err: Error | null) => void) => cb(null)),
          on: jest.fn((event: string, handler: any) => {
            if (event === 'error') {
              errorHandler = handler
            }
          }),
          removeAllListeners: jest.fn(),
          socks: new Map(),
        }
      })

      transport = new RtuTransport({ port: '/dev/ttyUSB0' })
      await transport.start()

      // Trigger error event
      const testError = new Error('Serial port error')
      errorHandler?.(testError)

      expect(consoleErrorSpy).toHaveBeenCalledWith('RTU transport error:', testError)
      consoleErrorSpy.mockRestore()
    })
  })

  describe('service vector', () => {
    beforeEach(async () => {
      transport = new RtuTransport({ port: '/dev/ttyUSB0' })
      await transport.start()
    })

    it('should handle getHoldingRegister request', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x03, 0x02, 0x00, 0xe6]) // Response: 230
      )
      transport.onRequest(mockHandler)

      const result = await capturedServiceVector.getHoldingRegister(0, 1)

      expect(mockHandler).toHaveBeenCalledWith(1, expect.any(Buffer))
      expect(result).toEqual([230])
    })

    it('should handle getInputRegister request', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x04, 0x02, 0x00, 0x34]) // Response: 52
      )
      transport.onRequest(mockHandler)

      const result = await capturedServiceVector.getInputRegister(0, 1)

      expect(mockHandler).toHaveBeenCalledWith(1, expect.any(Buffer))
      expect(result).toEqual([52])
    })

    it('should handle getMultipleHoldingRegisters request', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x03, 0x04, 0x00, 0xe6, 0x00, 0x34]) // Response: [230, 52]
      )
      transport.onRequest(mockHandler)

      const result = await capturedServiceVector.getMultipleHoldingRegisters(0, 2, 1)

      expect(mockHandler).toHaveBeenCalledWith(1, expect.any(Buffer))
      expect(result).toEqual([230, 52])
    })

    it('should handle getMultipleInputRegisters request', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x04, 0x04, 0x00, 0xe6, 0x00, 0x34]) // Response: [230, 52]
      )
      transport.onRequest(mockHandler)

      const result = await capturedServiceVector.getMultipleInputRegisters(0, 2, 1)

      expect(mockHandler).toHaveBeenCalledWith(1, expect.any(Buffer))
      expect(result).toEqual([230, 52])
    })

    it('should handle setRegister request', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x06, 0x00, 0x00, 0x00, 0xe6]) // Response
      )
      transport.onRequest(mockHandler)

      await capturedServiceVector.setRegister(0, 230, 1)

      expect(mockHandler).toHaveBeenCalledWith(1, expect.any(Buffer))
      const request = mockHandler.mock.calls[0][1]
      expect(request[1]).toBe(0x06) // Function code
      expect(request.readUInt16BE(4)).toBe(230) // Value
    })

    it('should handle setRegisterArray request', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x10, 0x00, 0x00, 0x00, 0x02]) // Response
      )
      transport.onRequest(mockHandler)

      await capturedServiceVector.setRegisterArray(0, [230, 52], 1)

      expect(mockHandler).toHaveBeenCalledWith(1, expect.any(Buffer))
      const request = mockHandler.mock.calls[0][1]
      expect(request[1]).toBe(0x10) // Function code
      expect(request.readUInt16BE(4)).toBe(2) // Register count
    })

    it('should handle getCoil request', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x01, 0x01, 0x01]) // Response: true
      )
      transport.onRequest(mockHandler)

      const result = await capturedServiceVector.getCoil(0, 1)

      expect(mockHandler).toHaveBeenCalledWith(1, expect.any(Buffer))
      expect(result).toBe(true)
    })

    it('should handle getCoil request returning false', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x01, 0x01, 0x00]) // Response: false
      )
      transport.onRequest(mockHandler)

      const result = await capturedServiceVector.getCoil(0, 1)

      expect(result).toBe(false)
    })

    it('should handle getDiscreteInput request', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x02, 0x01, 0x01]) // Response: true
      )
      transport.onRequest(mockHandler)

      const result = await capturedServiceVector.getDiscreteInput(0, 1)

      expect(mockHandler).toHaveBeenCalledWith(1, expect.any(Buffer))
      expect(result).toBe(true)
    })

    it('should handle setCoil request', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x05, 0x00, 0x00, 0xff, 0x00]) // Response
      )
      transport.onRequest(mockHandler)

      await capturedServiceVector.setCoil(0, true, 1)

      expect(mockHandler).toHaveBeenCalledWith(1, expect.any(Buffer))
      const request = mockHandler.mock.calls[0][1]
      expect(request[1]).toBe(0x05) // Function code
      expect(request.readUInt16BE(4)).toBe(0xff00) // True value
    })

    it('should handle setCoil request with false', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x05, 0x00, 0x00, 0x00, 0x00]) // Response
      )
      transport.onRequest(mockHandler)

      await capturedServiceVector.setCoil(0, false, 1)

      const request = mockHandler.mock.calls[0][1]
      expect(request.readUInt16BE(4)).toBe(0x0000) // False value
    })

    it('should throw error when request handler not set', async () => {
      await expect(capturedServiceVector.getHoldingRegister(0, 1)).rejects.toThrow(
        'No request handler set'
      )
    })

    it('should throw error on invalid register read response', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x03, 0x02]) // Invalid: missing data
      )
      transport.onRequest(mockHandler)

      await expect(capturedServiceVector.getHoldingRegister(0, 1)).rejects.toThrow(
        'Invalid response'
      )
    })

    it('should throw error on invalid coil read response', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x01, 0x01]) // Invalid: missing coil byte
      )
      transport.onRequest(mockHandler)

      await expect(capturedServiceVector.getCoil(0, 1)).rejects.toThrow('Invalid response')
    })

    it('should throw error on undefined byte count in register response', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x03]) // Invalid: undefined byte count
      )
      transport.onRequest(mockHandler)

      await expect(capturedServiceVector.getHoldingRegister(0, 1)).rejects.toThrow(
        'Invalid response'
      )
    })

    it('should throw error on undefined coil byte in coil response', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x01, 0x01]) // Invalid: undefined coil byte at index 3
      )
      transport.onRequest(mockHandler)

      await expect(capturedServiceVector.getCoil(0, 1)).rejects.toThrow('Invalid response')
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
        }),
        expect.any(Object)
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
        }),
        expect.any(Object)
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
        }),
        expect.any(Object)
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
        }),
        expect.any(Object)
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
        }),
        expect.any(Object)
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
        }),
        expect.any(Object)
      )
    })

    it('should default to lock: true when not specified', async () => {
      const { ServerSerial } = await import('modbus-serial')
      transport = new RtuTransport({ port: '/dev/ttyUSB0' })
      await transport.start()

      expect(ServerSerial).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          lock: true,
        })
      )
    })

    it('should pass lock: false when specified', async () => {
      const { ServerSerial } = await import('modbus-serial')
      transport = new RtuTransport({ port: '/dev/ttyUSB0', lock: false })
      await transport.start()

      expect(ServerSerial).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          lock: false,
        })
      )
    })

    it('should pass lock: true when explicitly specified', async () => {
      const { ServerSerial } = await import('modbus-serial')
      transport = new RtuTransport({ port: '/dev/ttyUSB0', lock: true })
      await transport.start()

      expect(ServerSerial).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          lock: true,
        })
      )
    })

    it('should pass lock option with all other serial parameters', async () => {
      const { ServerSerial } = await import('modbus-serial')
      transport = new RtuTransport({
        port: '/dev/ttyUSB0',
        baudRate: 19200,
        parity: 'even',
        dataBits: 8,
        stopBits: 2,
        lock: false,
      })
      await transport.start()

      expect(ServerSerial).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          path: '/dev/ttyUSB0',
          baudRate: 19200,
          parity: 'even',
          dataBits: 8,
          stopBits: 2,
          unitID: 255,
        }),
        expect.objectContaining({
          lock: false,
        })
      )
    })
  })
})
