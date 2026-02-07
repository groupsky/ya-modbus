/**
 * Tests for TcpTransport
 */

import { EventEmitter } from 'node:events'

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

import { TcpTransport } from './tcp.js'

// Store captured service vector for testing
let capturedServiceVector: any = null

// Mock server instance - needs to be declared before the mock
let mockServerInstance: any
let initializedListener: (() => void) | undefined
let errorListener: ((err: Error) => void) | undefined
let eventListeners: Map<string, Set<(...args: unknown[]) => void>>
// Track removeAllListeners calls across all mock instances
let allRemoveAllListenersCalls: Array<{ event?: string }> = []

// Mock modbus-serial
jest.mock('modbus-serial', () => {
  return {
    ServerTCP: jest.fn().mockImplementation((vector: any, _options: any) => {
      // Capture service vector for testing
      capturedServiceVector = vector

      // Reset listeners
      initializedListener = undefined
      errorListener = undefined
      eventListeners = new Map()

      // Create mock instance
      mockServerInstance = {
        close: jest.fn((cb: (err: Error | null) => void) => cb(null)),
        on: jest.fn((event: string, listener: any) => {
          if (event === 'initialized') {
            initializedListener = listener
          } else if (event === 'error') {
            errorListener = listener
          }
          // Track listeners
          if (!eventListeners.has(event)) {
            eventListeners.set(event, new Set())
          }
          eventListeners.get(event)!.add(listener)
        }),
        removeAllListeners: jest.fn((event?: string) => {
          allRemoveAllListenersCalls.push({ event })
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

      // ServerTCP emits 'initialized' after setup
      setImmediate(() => {
        if (initializedListener) {
          initializedListener()
        }
      })

      return mockServerInstance
    }),
  }
})

describe('TcpTransport', () => {
  let transport: TcpTransport

  beforeEach(() => {
    capturedServiceVector = null
    allRemoveAllListenersCalls = []
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await transport?.stop()
  })

  describe('lifecycle', () => {
    it('should create TCP transport with host and port config', () => {
      transport = new TcpTransport({ host: 'localhost', port: 502 })
      expect(transport).toBeDefined()
    })

    it('should create TCP transport with minimal config', () => {
      transport = new TcpTransport({ host: '0.0.0.0', port: 8502 })
      expect(transport).toBeDefined()
    })

    it('should start transport', async () => {
      transport = new TcpTransport({ host: 'localhost', port: 502 })
      await expect(transport.start()).resolves.not.toThrow()
    })

    it('should stop transport', async () => {
      transport = new TcpTransport({ host: 'localhost', port: 502 })
      await transport.start()
      await expect(transport.stop()).resolves.not.toThrow()
    })

    it('should not fail when stopping already stopped transport', async () => {
      transport = new TcpTransport({ host: 'localhost', port: 502 })
      await expect(transport.stop()).resolves.not.toThrow()
    })

    it('should throw error when starting already started transport', async () => {
      transport = new TcpTransport({ host: 'localhost', port: 502 })
      await transport.start()
      await expect(transport.start()).rejects.toThrow('Transport already started')
    })

    it('should not accumulate event listeners after repeated start/stop cycles', async () => {
      // This test verifies the fix for issue #253: Event listener memory leak
      // Before the fix, listeners are never removed during stop()
      // Each start() adds listeners, so repeated cycles on the same server accumulate them

      // Track listener counts across multiple transports using the same mock server
      const listenerCounts: number[] = []

      // Run 5 start/stop cycles
      for (let i = 0; i < 5; i++) {
        transport = new TcpTransport({ host: 'localhost', port: 502 })
        await transport.start()

        // Record listener count after start
        const count =
          mockServerInstance.listenerCount('initialized') +
          mockServerInstance.listenerCount('error')
        listenerCounts.push(count)

        await transport.stop()
      }

      // After the fix: all cycles should have the same listener count (2 listeners per cycle)
      // Before the fix: listener count would grow with each cycle
      const EXPECTED_LISTENERS_PER_CYCLE = 2 // 'initialized' + 'error'
      const CYCLE_COUNT = 5

      // Verify listener counts remain constant (primary regression test)
      expect(listenerCounts).toEqual(Array(CYCLE_COUNT).fill(EXPECTED_LISTENERS_PER_CYCLE))

      // Verify no listener accumulation - the most important behavior
      const minCount = Math.min(...listenerCounts)
      const maxCount = Math.max(...listenerCounts)
      expect(maxCount).toBe(minCount) // All counts should be equal (no growth)
      expect(maxCount).toBe(EXPECTED_LISTENERS_PER_CYCLE) // Should match expected count
    })
  })

  describe('request/response handling', () => {
    beforeEach(async () => {
      transport = new TcpTransport({ host: 'localhost', port: 502 })
      await transport.start()
    })

    it('should register request handler', () => {
      const handler = (): Promise<Buffer> => Promise.resolve(Buffer.from([0x01, 0x03]))
      expect(() => transport.onRequest(handler)).not.toThrow()
    })

    it('should throw error when sending before start', async () => {
      const stoppedTransport = new TcpTransport({ host: 'localhost', port: 502 })
      await expect(stoppedTransport.send(1, Buffer.from([0x01, 0x03]))).rejects.toThrow(
        'Transport not started'
      )
    })

    it('should resolve when sending after start', async () => {
      await expect(transport.send(1, Buffer.from([0x01, 0x03]))).resolves.toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('should not leak event listeners when start() fails due to port binding error', async () => {
      // Test for issue #274: Event listeners should be cleaned up on initialization failure
      // Before the fix, when start() fails with an error event, the 'initialized' and 'error'
      // listeners remain attached to the server instance, causing a memory leak
      const { ServerTCP } = await import('modbus-serial')
      const bindError = new Error('listen EADDRINUSE: address already in use')
      let errorCallback: ((err: Error) => void) | undefined
      let localMockInstance: any
      ;(ServerTCP as any).mockImplementationOnce((vector: any, _options: any) => {
        capturedServiceVector = vector
        initializedListener = undefined
        errorListener = undefined
        eventListeners = new Map()

        // Create mock that extends EventEmitter so EventEmitter.prototype.removeAllListeners.call() works
        localMockInstance = Object.create(EventEmitter.prototype)
        Object.assign(localMockInstance, {
          close: jest.fn((cb: (err: Error | null) => void) => cb(null)),
          socks: new Map(),
        })

        // Initialize EventEmitter state
        EventEmitter.call(localMockInstance)

        // Override on() to track listeners in both EventEmitter and our test Map
        const originalOn = localMockInstance.on.bind(localMockInstance)
        localMockInstance.on = jest.fn((event: string, listener: any) => {
          if (event === 'initialized') {
            initializedListener = listener
          } else if (event === 'error') {
            errorListener = listener
            errorCallback = listener
          }
          // Track listeners in our Map
          if (!eventListeners.has(event)) {
            eventListeners.set(event, new Set())
          }
          eventListeners.get(event)!.add(listener)
          // Also add to real EventEmitter
          return originalOn(event, listener)
        })

        // Simulate error during initialization (instead of initialized event)
        setImmediate(() => {
          if (errorCallback) {
            errorCallback(bindError)
          }
        })

        return localMockInstance
      })

      const testTransport = new TcpTransport({ host: 'localhost', port: 8502 })
      await expect(testTransport.start()).rejects.toThrow(
        'listen EADDRINUSE: address already in use'
      )

      // After failed start(), verify no listeners remain attached
      // This prevents memory leaks when repeatedly attempting to start on a busy port
      expect(localMockInstance.listenerCount('initialized')).toBe(0)
      expect(localMockInstance.listenerCount('error')).toBe(0)
    })

    it('should not leak event listeners when start() fails due to timeout', async () => {
      // Test for issue #274: Event listeners should be cleaned up on initialization timeout
      // Before the fix, when start() times out waiting for 'initialized' event, the listeners
      // remain attached to the server instance, causing a memory leak
      const { ServerTCP } = await import('modbus-serial')
      let localMockInstance: any
      ;(ServerTCP as any).mockImplementationOnce((vector: any, _options: any) => {
        capturedServiceVector = vector
        initializedListener = undefined
        errorListener = undefined
        eventListeners = new Map()

        // Create mock that extends EventEmitter so EventEmitter.prototype.removeAllListeners.call() works
        localMockInstance = Object.create(EventEmitter.prototype)
        Object.assign(localMockInstance, {
          close: jest.fn((cb: (err: Error | null) => void) => cb(null)),
          socks: new Map(),
        })

        // Initialize EventEmitter state
        EventEmitter.call(localMockInstance)

        // Override on() to track listeners in both EventEmitter and our test Map
        const originalOn = localMockInstance.on.bind(localMockInstance)
        localMockInstance.on = jest.fn((event: string, listener: any) => {
          if (event === 'initialized') {
            initializedListener = listener
          } else if (event === 'error') {
            errorListener = listener
          }
          // Track listeners in our Map
          if (!eventListeners.has(event)) {
            eventListeners.set(event, new Set())
          }
          eventListeners.get(event)!.add(listener)
          // Also add to real EventEmitter
          return originalOn(event, listener)
        })

        // Don't emit initialized or error - simulate hanging server

        return localMockInstance
      })

      const testTransport = new TcpTransport({ host: 'localhost', port: 8502 })
      await expect(testTransport.start()).rejects.toThrow(/timeout/i)

      // After failed start() due to timeout, verify no listeners remain attached
      // This prevents memory leaks when start() hangs and times out
      expect(localMockInstance.listenerCount('initialized')).toBe(0)
      expect(localMockInstance.listenerCount('error')).toBe(0)
    }, 15000) // Increase test timeout to allow for implementation timeout

    it('should reject start() on port binding error', async () => {
      // Test for issue #254: start() should reject when port binding fails
      const { ServerTCP } = await import('modbus-serial')
      const bindError = new Error('listen EADDRINUSE: address already in use')
      let errorCallback: ((err: Error) => void) | undefined
      ;(ServerTCP as any).mockImplementationOnce((vector: any, _options: any) => {
        capturedServiceVector = vector
        initializedListener = undefined
        errorListener = undefined

        const localMockInstance = {
          close: jest.fn((cb: (err: Error | null) => void) => cb(null)),
          on: jest.fn((event: string, listener: any) => {
            if (event === 'initialized') {
              initializedListener = listener
            } else if (event === 'error') {
              errorListener = listener
              errorCallback = listener
            }
          }),
          removeAllListeners: jest.fn(),
          socks: new Map(),
        }

        // Simulate error during initialization (instead of initialized event)
        setImmediate(() => {
          if (errorCallback) {
            errorCallback(bindError)
          }
        })

        return localMockInstance
      })

      const testTransport = new TcpTransport({ host: 'localhost', port: 8502 })
      await expect(testTransport.start()).rejects.toThrow(
        'listen EADDRINUSE: address already in use'
      )
    })

    it('should reject start() on initialization timeout', async () => {
      // Test for issue #254: start() should timeout if server never emits initialized or error
      const { ServerTCP } = await import('modbus-serial')

      ;(ServerTCP as any).mockImplementationOnce((vector: any, _options: any) => {
        capturedServiceVector = vector
        initializedListener = undefined
        errorListener = undefined

        const localMockInstance = {
          close: jest.fn((cb: (err: Error | null) => void) => cb(null)),
          on: jest.fn((event: string, listener: any) => {
            if (event === 'initialized') {
              initializedListener = listener
            } else if (event === 'error') {
              errorListener = listener
            }
          }),
          removeAllListeners: jest.fn(),
          socks: new Map(),
        }

        // Don't emit initialized or error - simulate hanging server

        return localMockInstance
      })

      const testTransport = new TcpTransport({ host: 'localhost', port: 8502 })
      await expect(testTransport.start()).rejects.toThrow(/timeout/i)
    }, 15000) // Increase test timeout to allow for implementation timeout

    it('should reject on stop error', async () => {
      const { ServerTCP } = await import('modbus-serial')
      const closeError = new Error('Failed to close server')
      let closeCallback: ((err: Error | null) => void) | undefined
      ;(ServerTCP as any).mockImplementationOnce((vector: any, _options: any) => {
        capturedServiceVector = vector
        initializedListener = undefined
        errorListener = undefined

        const localMockInstance = {
          close: jest.fn((cb: (err: Error | null) => void) => {
            closeCallback = cb
          }),
          on: jest.fn((event: string, listener: any) => {
            if (event === 'initialized') {
              initializedListener = listener
            } else if (event === 'error') {
              errorListener = listener
            }
          }),
          removeAllListeners: jest.fn(),
          socks: new Map(),
        }

        setImmediate(() => {
          if (initializedListener) {
            initializedListener()
          }
        })

        return localMockInstance
      })

      const testTransport = new TcpTransport({ host: 'localhost', port: 502 })
      await testTransport.start()

      const stopPromise = testTransport.stop()
      setImmediate(() => closeCallback?.(closeError))

      await expect(stopPromise).rejects.toThrow('Failed to close server')
    })

    it('should handle error event', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      transport = new TcpTransport({ host: 'localhost', port: 502 })
      await transport.start()

      // Trigger error event
      const testError = new Error('TCP server error')
      errorListener?.(testError)

      expect(consoleErrorSpy).toHaveBeenCalledWith('TCP transport error:', testError)
      consoleErrorSpy.mockRestore()
    })
  })

  describe('service vector', () => {
    beforeEach(async () => {
      transport = new TcpTransport({ host: 'localhost', port: 502 })
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
    it('should pass host to ServerTCP', async () => {
      const { ServerTCP } = await import('modbus-serial')
      transport = new TcpTransport({ host: '127.0.0.1', port: 502 })
      await transport.start()

      expect(ServerTCP).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          host: '127.0.0.1',
        })
      )
    })

    it('should pass port to ServerTCP', async () => {
      const { ServerTCP } = await import('modbus-serial')
      transport = new TcpTransport({ host: 'localhost', port: 8502 })
      await transport.start()

      expect(ServerTCP).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          port: 8502,
        })
      )
    })

    it('should listen to all unit IDs by default', async () => {
      const { ServerTCP } = await import('modbus-serial')
      transport = new TcpTransport({ host: 'localhost', port: 502 })
      await transport.start()

      expect(ServerTCP).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          unitID: 255,
        })
      )
    })
  })
})
