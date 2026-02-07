/**
 * Tests for TCP transport async callback compatibility with modbus-serial
 *
 * This test reproduces issue #303: modbus-serial ServerTCP doesn't properly
 * await Promise-based service vector callbacks, causing "Modbus exception 4:
 * Slave device failure" errors.
 *
 * The test simulates how modbus-serial internally uses service vector callbacks
 * to demonstrate the incompatibility with Promise-based async functions.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'

import { TcpTransport } from './tcp.js'

// Store captured service vector for testing
let capturedServiceVector: any = null

// Mock modbus-serial ServerTCP
jest.mock('modbus-serial', () => {
  return {
    ServerTCP: jest.fn().mockImplementation((vector: any, _options: any) => {
      capturedServiceVector = vector

      const mockInstance = {
        close: jest.fn((cb: (err: Error | null) => void) => cb(null)),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
        socks: new Map(),
      }

      // Simulate ServerTCP emitting initialized event
      setImmediate(() => {
        const listeners = (mockInstance.on as jest.Mock).mock.calls
          .filter((call) => call[0] === 'initialized')
          .map((call) => call[1])
        listeners.forEach((listener) => listener())
      })

      return mockInstance
    }),
  }
})

/**
 * Simulates how modbus-serial ServerTCP/ServerSerial internally handles
 * service vector callbacks. The real implementation has a bug where it
 * doesn't properly await Promise-based callbacks.
 *
 * @param callback - Service vector callback (can be Promise or callback-style)
 * @param args - Arguments to pass to callback
 * @returns Promise that resolves with the result or rejects with timeout
 */
async function simulateModbusSerialCall<T>(
  callback: (...args: any[]) => any,
  ...args: any[]
): Promise<T> {
  return new Promise((resolve, reject) => {
    // Timeout after 100ms (simulating modbus-serial's timeout behavior)
    const timeout = setTimeout(() => {
      reject(new Error('Modbus exception 4: Slave device failure (timeout)'))
    }, 100)

    // Check if callback accepts a callback parameter (last arg is function)
    // This simulates how modbus-serial detects callback vs promise style
    const isCallbackStyle = callback.length > args.length

    if (isCallbackStyle) {
      // Callback style: last parameter is the callback function
      const cb = (err: Error | null, result?: T): void => {
        clearTimeout(timeout)
        if (err) {
          reject(err)
        } else {
          resolve(result as T)
        }
      }
      // Call with callback
      callback(...args, cb)
    } else {
      // Promise style: modbus-serial doesn't await properly (BUG!)
      // It calls the function but doesn't await the result
      const result = callback(...args)

      // BUG: modbus-serial checks if result is a Promise but doesn't await it properly
      // It expects an immediate value, not a Promise
      if (result instanceof Promise) {
        // This is the bug: modbus-serial doesn't await here
        // It times out waiting for response
        // Uncomment this line to "fix" the bug:
        // result.then((val) => { clearTimeout(timeout); resolve(val); });
      } else {
        // Synchronous return works
        clearTimeout(timeout)
        resolve(result)
      }
    }
  })
}

describe('TcpTransport async callback compatibility', () => {
  let transport: TcpTransport

  beforeEach(() => {
    jest.clearAllMocks()
    capturedServiceVector = null
  })

  afterEach(async () => {
    await transport?.stop()
  })

  describe('Callback-style implementation (fix for #303)', () => {
    beforeEach(async () => {
      transport = new TcpTransport({ host: 'localhost', port: 502 })
      await transport.start()

      // Mock handler that returns appropriate responses based on function code
      const mockHandler = jest
        .fn()
        .mockImplementation((slaveId: number, request: Buffer): Promise<Buffer> => {
          const functionCode = request[1]
          switch (functionCode) {
            case 0x03: // Read holding registers
              return Promise.resolve(Buffer.from([0x01, 0x03, 0x02, 0x00, 0xe6]))
            case 0x04: // Read input registers
              return Promise.resolve(Buffer.from([0x01, 0x04, 0x02, 0x00, 0x34]))
            case 0x01: // Read coils
              return Promise.resolve(Buffer.from([0x01, 0x01, 0x01, 0x01]))
            case 0x02: // Read discrete inputs
              return Promise.resolve(Buffer.from([0x01, 0x02, 0x01, 0x01]))
            default:
              return Promise.resolve(Buffer.from([0x01, functionCode, 0x02, 0x00, 0x00]))
          }
        })
      transport.onRequest(mockHandler)
    })

    it('should work correctly when simulating real modbus-serial behavior (fixes #303)', () => {
      // Now using callback-style, this should work with real modbus-serial behavior
      return expect(
        simulateModbusSerialCall<number[]>(capturedServiceVector.getHoldingRegister, 0, 1)
      ).resolves.toEqual([230])
    })

    it('should work for getMultipleHoldingRegisters', () => {
      // Mock returns single register, test with length 1
      return expect(
        simulateModbusSerialCall<number[]>(
          capturedServiceVector.getMultipleHoldingRegisters,
          0,
          1,
          1
        )
      ).resolves.toEqual([230])
    })

    it('should work for getInputRegister', () => {
      return expect(
        simulateModbusSerialCall<number[]>(capturedServiceVector.getInputRegister, 0, 1)
      ).resolves.toEqual([52])
    })

    it('should work for getMultipleInputRegisters', () => {
      // Mock returns single register, test with length 1
      return expect(
        simulateModbusSerialCall<number[]>(capturedServiceVector.getMultipleInputRegisters, 0, 1, 1)
      ).resolves.toEqual([52])
    })

    it('should work for getCoil', () => {
      return expect(
        simulateModbusSerialCall<boolean>(capturedServiceVector.getCoil, 0, 1)
      ).resolves.toBe(true)
    })

    it('should work for getDiscreteInput', () => {
      return expect(
        simulateModbusSerialCall<boolean>(capturedServiceVector.getDiscreteInput, 0, 1)
      ).resolves.toBe(true)
    })
  })

  describe('Callback-style (workaround)', () => {
    it('should work with callback-style service vector', async () => {
      // This test shows that callback-style works correctly with modbus-serial
      // This is the workaround for issue #303

      // Create a callback-style service vector (the fix)
      const callbackStyleVector = {
        getHoldingRegister: (
          addr: number,
          unitID: number,
          cb: (err: Error | null, values?: number[]) => void
        ) => {
          // Simulate async operation
          setImmediate(() => {
            cb(null, [230])
          })
        },
      }

      const result = await simulateModbusSerialCall<number[]>(
        callbackStyleVector.getHoldingRegister,
        0,
        1
      )

      expect(result).toEqual([230])
    })

    it('should work with callback-style for multiple registers', async () => {
      const callbackStyleVector = {
        getMultipleHoldingRegisters: (
          addr: number,
          length: number,
          unitID: number,
          cb: (err: Error | null, values?: number[]) => void
        ) => {
          setImmediate(() => {
            cb(null, [230, 52])
          })
        },
      }

      const result = await simulateModbusSerialCall<number[]>(
        callbackStyleVector.getMultipleHoldingRegisters,
        0,
        2,
        1
      )

      expect(result).toEqual([230, 52])
    })
  })
})
