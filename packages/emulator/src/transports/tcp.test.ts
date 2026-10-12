/**
 * Tests for TcpTransport
 */

import { EventEmitter } from 'node:events'

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'

import { TcpTransport } from './tcp.js'
import { callServiceVector } from './test-helpers.js'

// Store captured service vector for testing
let capturedServiceVector: any = null

// Mock server instance - needs to be declared before the mock
let mockServerInstance: any
let initializedListener: (() => void) | undefined
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
      eventListeners = new Map()

      // Create mock instance
      mockServerInstance = {
        close: jest.fn((cb: (err: Error | null) => void) => cb(null)),
        on: jest.fn((event: string, listener: any) => {
          if (event === 'initialized') {
            initializedListener = listener
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

// Real EventEmitter standing in for a ServerTCP. Use it when a test needs to emit server
// events or count listeners; the mock above is enough for everything else.
function createEmitterServer(): EventEmitter & {
  close: jest.Mock<(cb: (err: Error | null) => void) => void>
  socks: Map<unknown, 0>
} {
  return Object.assign(new EventEmitter(), {
    close: jest.fn((cb: (err: Error | null) => void) => cb(null)),
    socks: new Map<unknown, 0>(),
  })
}

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

    it('should not leave the initialization timeout pending after start() succeeds', async () => {
      // A timeout that outlives start() would later delete the running server
      jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] })
      try {
        transport = new TcpTransport({ host: 'localhost', port: 502 })
        await transport.start()

        expect(jest.getTimerCount()).toBe(0)
      } finally {
        jest.useRealTimers()
      }
    })

    it('should not accumulate event listeners after repeated start/stop cycles', async () => {
      // Issue #253: every start() creates a new server, so nothing piles up on one server.
      // A running server keeps only the 'error' listener (issue #544).
      const { ServerTCP } = await import('modbus-serial')

      for (let i = 0; i < 5; i++) {
        const server = createEmitterServer()
        ;(ServerTCP as any).mockImplementationOnce(() => {
          setImmediate(() => server.emit('initialized'))
          return server
        })

        transport = new TcpTransport({ host: 'localhost', port: 502 })
        await transport.start()

        expect(server.listenerCount('initialized')).toBe(0)
        expect(server.listenerCount('error')).toBe(1)

        await transport.stop()

        expect(server.listenerCount('initialized')).toBe(0)
        expect(server.listenerCount('error')).toBe(0)
      }
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
    it('should close the server when stop() is called during initialization', async () => {
      // Issues #275 and #545: start() rejects, and the server is closed once it listens.
      // Otherwise it binds the port after stop() returned and keeps it.
      const { ServerTCP } = await import('modbus-serial')
      const server = createEmitterServer()
      ;(ServerTCP as any).mockImplementationOnce(() => server)

      const testTransport = new TcpTransport({ host: 'localhost', port: 8502 })
      let stopped = false
      const startPromise = testTransport.start()
      // Call stop() while initialization is still pending
      const stopPromise = testTransport.stop().then(() => {
        stopped = true
      })
      const settled = Promise.allSettled([startPromise, stopPromise])
      await new Promise((resolve) => setImmediate(resolve))

      // The port is not bound yet, so there is nothing to close and stop() is still waiting
      expect(server.close).not.toHaveBeenCalled()
      expect(stopped).toBe(false)

      server.emit('initialized')
      const [start, stop] = await settled

      expect(start).toEqual({
        status: 'rejected',
        reason: new Error('Transport stopped during initialization'),
      })
      expect(stop.status).toBe('fulfilled')
      expect(server.close).toHaveBeenCalledTimes(1)
      expect(server.listenerCount('initialized')).toBe(0)
    })

    it('should allow restart after stop() during initialization', async () => {
      // Test for issue #275 acceptance criteria: rapid start() -> stop() -> start() sequence
      // Verifies transport is reusable after stop() interrupts initialization
      const { ServerTCP } = await import('modbus-serial')
      const firstServer = createEmitterServer()
      const secondServer = createEmitterServer()
      ;(ServerTCP as any)
        .mockImplementationOnce(() => {
          setImmediate(() => firstServer.emit('initialized'))
          return firstServer
        })
        .mockImplementationOnce(() => {
          setImmediate(() => secondServer.emit('initialized'))
          return secondServer
        })

      const testTransport = new TcpTransport({ host: 'localhost', port: 8502 })

      // First attempt - stop during init
      const [start] = await Promise.allSettled([testTransport.start(), testTransport.stop()])
      expect(start).toEqual({
        status: 'rejected',
        reason: new Error('Transport stopped during initialization'),
      })

      // Verify first server was closed and cleaned up
      expect(firstServer.close).toHaveBeenCalledTimes(1)
      expect(firstServer.listenerCount('initialized')).toBe(0)

      // Second attempt - should succeed
      await expect(testTransport.start()).resolves.toBeUndefined()
      await expect(testTransport.send(1, Buffer.from([0x01, 0x03]))).resolves.toBeUndefined()

      await testTransport.stop()
      expect(secondServer.close).toHaveBeenCalledTimes(1)
    })

    it.each(['error', 'serverError'])(
      'should not close the server that reports %s after stop() during initialization',
      async (event) => {
        // modbus-serial reports a failed listen() as 'serverError'. A server that failed to
        // start has no port to release.
        const { ServerTCP } = await import('modbus-serial')
        const server = createEmitterServer()
        ;(ServerTCP as any).mockImplementationOnce(() => server)

        const testTransport = new TcpTransport({ host: 'localhost', port: 8502 })
        const settled = Promise.allSettled([testTransport.start(), testTransport.stop()])
        server.emit(event, new Error('listen EADDRINUSE'))
        const [start, stop] = await settled

        expect(start.status).toBe('rejected')
        expect(stop.status).toBe('fulfilled')
        expect(server.close).not.toHaveBeenCalled()
        expect(server.listenerCount('initialized')).toBe(0)
      }
    )

    it('should stop waiting for a server that does not initialize before the timeout', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] })
      try {
        const { ServerTCP } = await import('modbus-serial')
        const server = createEmitterServer() // does not emit anything before the timeout
        ;(ServerTCP as any).mockImplementationOnce(() => server)

        const testTransport = new TcpTransport({ host: 'localhost', port: 8502 })
        const settled = Promise.allSettled([testTransport.start(), testTransport.stop()])

        jest.advanceTimersByTime(10000)
        const [start, stop] = await settled

        expect(start.status).toBe('rejected')
        expect(stop.status).toBe('fulfilled')
        expect(server.close).not.toHaveBeenCalled()
        expect(jest.getTimerCount()).toBe(0)

        // A server that binds after the timeout is still closed
        server.emit('initialized')
        expect(server.close).toHaveBeenCalledTimes(1)
      } finally {
        jest.useRealTimers()
      }
    })

    it('should reject stop() when closing the server fails after stop() during initialization', async () => {
      const { ServerTCP } = await import('modbus-serial')
      const server = createEmitterServer()
      server.close.mockImplementation((cb) => cb(new Error('Failed to close server')))
      ;(ServerTCP as any).mockImplementationOnce(() => server)

      const testTransport = new TcpTransport({ host: 'localhost', port: 8502 })
      const settled = Promise.allSettled([testTransport.start(), testTransport.stop()])
      server.emit('initialized')
      const [start, stop] = await settled

      expect(start.status).toBe('rejected')
      expect(stop).toEqual({ status: 'rejected', reason: new Error('Failed to close server') })
    })

    it('should reject start() and remove listeners on port binding error', async () => {
      // Tests for issues #254 and #274: start() rejects when port binding fails, and the
      // 'initialized' and 'error' listeners do not stay attached to the failed server
      const { ServerTCP } = await import('modbus-serial')
      const server = createEmitterServer()
      ;(ServerTCP as any).mockImplementationOnce(() => {
        setImmediate(() => server.emit('error', new Error('listen EADDRINUSE')))
        return server
      })

      const testTransport = new TcpTransport({ host: 'localhost', port: 8502 })
      await expect(testTransport.start()).rejects.toThrow('listen EADDRINUSE')

      expect(server.listenerCount('initialized')).toBe(0)
      expect(server.listenerCount('error')).toBe(0)
    })

    it('should reject start() and remove listeners on initialization timeout', async () => {
      // Tests for issues #254 and #274: start() rejects if the server never emits 'initialized'
      // or 'error', and the listeners do not stay attached to the abandoned server
      const { ServerTCP } = await import('modbus-serial')
      const server = createEmitterServer() // hangs: never emits anything
      ;(ServerTCP as any).mockImplementationOnce(() => server)

      const testTransport = new TcpTransport({ host: 'localhost', port: 8502 })
      await expect(testTransport.start()).rejects.toThrow(/timeout/i)

      expect(server.listenerCount('initialized')).toBe(0)
      expect(server.listenerCount('error')).toBe(0)
    }, 15000) // Increase test timeout to allow for implementation timeout

    it('should not leave the initialization timeout pending after start() fails', async () => {
      jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] })
      try {
        const { ServerTCP } = await import('modbus-serial')
        const server = createEmitterServer()
        ;(ServerTCP as any).mockImplementationOnce(() => {
          setImmediate(() => server.emit('error', new Error('listen EADDRINUSE')))
          return server
        })

        const testTransport = new TcpTransport({ host: 'localhost', port: 8502 })
        await expect(testTransport.start()).rejects.toThrow('listen EADDRINUSE')

        expect(jest.getTimerCount()).toBe(0)
      } finally {
        jest.useRealTimers()
      }
    })

    it('should reject on stop error', async () => {
      const { ServerTCP } = await import('modbus-serial')
      const server = createEmitterServer()
      server.close.mockImplementation((cb) => {
        setImmediate(() => cb(new Error('Failed to close server')))
      })
      ;(ServerTCP as any).mockImplementationOnce(() => {
        setImmediate(() => server.emit('initialized'))
        return server
      })

      const testTransport = new TcpTransport({ host: 'localhost', port: 502 })
      await testTransport.start()

      await expect(testTransport.stop()).rejects.toThrow('Failed to close server')

      // The server is still running, so it keeps its 'error' listener
      expect(server.listenerCount('error')).toBe(1)
    })

    it('should log server errors that occur after start() succeeded', async () => {
      // Issue #544: the success path removed the 'error' listener, so a later 'error' event
      // had no listener and EventEmitter threw it as an uncaught exception. The emitter
      // removes listeners like the real server; a mock that keeps removed listeners hides this.
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      try {
        const { ServerTCP } = await import('modbus-serial')
        const server = createEmitterServer()
        ;(ServerTCP as any).mockImplementationOnce(() => {
          setImmediate(() => server.emit('initialized'))
          return server
        })

        transport = new TcpTransport({ host: 'localhost', port: 502 })
        await transport.start()

        const testError = new Error('TCP server error')
        expect(() => server.emit('error', testError)).not.toThrow()

        expect(consoleErrorSpy).toHaveBeenCalledWith('TCP transport error:', testError)
      } finally {
        consoleErrorSpy.mockRestore()
      }
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

      const result = await callServiceVector<number>(
        capturedServiceVector.getHoldingRegister.bind(capturedServiceVector),
        0,
        1
      )

      expect(mockHandler).toHaveBeenCalledWith(1, expect.any(Buffer))
      expect(result).toEqual(230)
    })

    it('should handle getInputRegister request', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x04, 0x02, 0x00, 0x34]) // Response: 52
      )
      transport.onRequest(mockHandler)

      const result = await callServiceVector<number>(
        capturedServiceVector.getInputRegister.bind(capturedServiceVector),
        0,
        1
      )

      expect(mockHandler).toHaveBeenCalledWith(1, expect.any(Buffer))
      expect(result).toEqual(52)
    })

    it('should handle getMultipleHoldingRegisters request', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x03, 0x04, 0x00, 0xe6, 0x00, 0x34]) // Response: [230, 52]
      )
      transport.onRequest(mockHandler)

      const result = await callServiceVector<number[]>(
        capturedServiceVector.getMultipleHoldingRegisters.bind(capturedServiceVector),
        0,
        2,
        1
      )

      expect(mockHandler).toHaveBeenCalledWith(1, expect.any(Buffer))
      expect(result).toEqual([230, 52])
    })

    it('should handle getMultipleInputRegisters request', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x04, 0x04, 0x00, 0xe6, 0x00, 0x34]) // Response: [230, 52]
      )
      transport.onRequest(mockHandler)

      const result = await callServiceVector<number[]>(
        capturedServiceVector.getMultipleInputRegisters.bind(capturedServiceVector),
        0,
        2,
        1
      )

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

      const result = await callServiceVector<boolean>(
        capturedServiceVector.getCoil.bind(capturedServiceVector),
        0,
        1
      )

      expect(mockHandler).toHaveBeenCalledWith(1, expect.any(Buffer))
      expect(result).toBe(true)
    })

    it('should handle getCoil request returning false', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x01, 0x01, 0x00]) // Response: false
      )
      transport.onRequest(mockHandler)

      const result = await callServiceVector<boolean>(
        capturedServiceVector.getCoil.bind(capturedServiceVector),
        0,
        1
      )

      expect(result).toBe(false)
    })

    it('should handle getDiscreteInput request', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x02, 0x01, 0x01]) // Response: true
      )
      transport.onRequest(mockHandler)

      const result = await callServiceVector<boolean>(
        capturedServiceVector.getDiscreteInput.bind(capturedServiceVector),
        0,
        1
      )

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
      await expect(
        callServiceVector(
          capturedServiceVector.getHoldingRegister.bind(capturedServiceVector),
          0,
          1
        )
      ).rejects.toThrow('No request handler set')
    })

    it('should throw error on invalid register read response', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x03, 0x02]) // Invalid: missing data
      )
      transport.onRequest(mockHandler)

      await expect(
        callServiceVector(
          capturedServiceVector.getHoldingRegister.bind(capturedServiceVector),
          0,
          1
        )
      ).rejects.toThrow('Invalid response')
    })

    it('should throw error on invalid coil read response', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x01, 0x01]) // Invalid: missing coil byte
      )
      transport.onRequest(mockHandler)

      await expect(
        callServiceVector(capturedServiceVector.getCoil.bind(capturedServiceVector), 0, 1)
      ).rejects.toThrow('Invalid response')
    })

    it('should throw error on undefined byte count in register response', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x03]) // Invalid: undefined byte count
      )
      transport.onRequest(mockHandler)

      await expect(
        callServiceVector(
          capturedServiceVector.getHoldingRegister.bind(capturedServiceVector),
          0,
          1
        )
      ).rejects.toThrow('Invalid response')
    })

    it('should throw error on undefined coil byte in coil response', async () => {
      const mockHandler = jest.fn().mockResolvedValue(
        Buffer.from([0x01, 0x01, 0x01]) // Invalid: undefined coil byte at index 3
      )
      transport.onRequest(mockHandler)

      await expect(
        callServiceVector(capturedServiceVector.getCoil.bind(capturedServiceVector), 0, 1)
      ).rejects.toThrow('Invalid response')
    })
  })

  describe('edge cases', () => {
    it('should handle stop() when server is not initialized', async () => {
      transport = new TcpTransport({ host: 'localhost', port: 502 })
      // Don't call start(), just call stop()
      await expect(transport.stop()).resolves.not.toThrow()
    })

    it('should handle stop() called multiple times', async () => {
      transport = new TcpTransport({ host: 'localhost', port: 502 })
      await transport.start()
      await transport.stop()
      // Second stop should work fine
      await expect(transport.stop()).resolves.not.toThrow()
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
