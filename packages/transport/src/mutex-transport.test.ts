import type { Transport } from '@ya-modbus/driver-types'
import { Mutex } from 'async-mutex'

import { MutexTransport } from './mutex-transport.js'

describe('MutexTransport', () => {
  let mockTransport: jest.Mocked<Transport>
  let mutex: Mutex
  let mutexTransport: MutexTransport

  beforeEach(() => {
    mockTransport = {
      readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.alloc(4)),
      readInputRegisters: jest.fn().mockResolvedValue(Buffer.alloc(4)),
      readCoils: jest.fn().mockResolvedValue(Buffer.alloc(1)),
      readDiscreteInputs: jest.fn().mockResolvedValue(Buffer.alloc(1)),
      writeSingleRegister: jest.fn().mockResolvedValue(undefined),
      writeSingleCoil: jest.fn().mockResolvedValue(undefined),
      writeMultipleRegisters: jest.fn().mockResolvedValue(undefined),
      writeMultipleCoils: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    }
    mutex = new Mutex()
    mutexTransport = new MutexTransport(mockTransport, mutex)
  })

  describe('readHoldingRegisters', () => {
    it('should delegate to underlying transport', async () => {
      const result = await mutexTransport.readHoldingRegisters(0, 2)

      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0, 2)
      expect(result).toEqual(Buffer.alloc(4))
    })

    it('should serialize multiple calls', async () => {
      const executionOrder: string[] = []

      mockTransport.readHoldingRegisters.mockImplementation(async (address: number) => {
        executionOrder.push(`start-${address}`)
        await new Promise((resolve) => setTimeout(resolve, 50))
        executionOrder.push(`end-${address}`)
        return Buffer.alloc(4)
      })

      // Start two operations concurrently
      const promise1 = mutexTransport.readHoldingRegisters(0, 2)
      const promise2 = mutexTransport.readHoldingRegisters(10, 2)

      await Promise.all([promise1, promise2])

      // Operations should be serialized (not interleaved)
      expect(executionOrder).toEqual(['start-0', 'end-0', 'start-10', 'end-10'])
    })
  })

  describe('readInputRegisters', () => {
    it('should delegate to underlying transport', async () => {
      const result = await mutexTransport.readInputRegisters(0, 2)

      expect(mockTransport.readInputRegisters).toHaveBeenCalledWith(0, 2)
      expect(result).toEqual(Buffer.alloc(4))
    })
  })

  describe('readCoils', () => {
    it('should delegate to underlying transport', async () => {
      const result = await mutexTransport.readCoils(0, 8)

      expect(mockTransport.readCoils).toHaveBeenCalledWith(0, 8)
      expect(result).toEqual(Buffer.alloc(1))
    })
  })

  describe('readDiscreteInputs', () => {
    it('should delegate to underlying transport', async () => {
      const result = await mutexTransport.readDiscreteInputs(0, 8)

      expect(mockTransport.readDiscreteInputs).toHaveBeenCalledWith(0, 8)
      expect(result).toEqual(Buffer.alloc(1))
    })
  })

  describe('writeSingleRegister', () => {
    it('should delegate to underlying transport', async () => {
      await mutexTransport.writeSingleRegister(0, 1234)

      expect(mockTransport.writeSingleRegister).toHaveBeenCalledWith(0, 1234)
    })
  })

  describe('writeSingleCoil', () => {
    it('should delegate to underlying transport', async () => {
      await mutexTransport.writeSingleCoil(0, true)

      expect(mockTransport.writeSingleCoil).toHaveBeenCalledWith(0, true)
    })
  })

  describe('writeMultipleRegisters', () => {
    it('should delegate to underlying transport', async () => {
      const values = Buffer.from([0x12, 0x34, 0x56, 0x78])
      await mutexTransport.writeMultipleRegisters(0, values)

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(0, values)
    })
  })

  describe('writeMultipleCoils', () => {
    it('should delegate to underlying transport', async () => {
      const values = Buffer.from([0xff])
      await mutexTransport.writeMultipleCoils(0, values)

      expect(mockTransport.writeMultipleCoils).toHaveBeenCalledWith(0, values)
    })
  })

  describe('close', () => {
    it('should delegate to underlying transport without mutex', async () => {
      await mutexTransport.close()

      expect(mockTransport.close).toHaveBeenCalledTimes(1)
    })

    it('should not acquire mutex for close', async () => {
      // Acquire the mutex manually
      const release = await mutex.acquire()

      // Close should succeed even though mutex is held
      await mutexTransport.close()

      expect(mockTransport.close).toHaveBeenCalledTimes(1)

      release()
    })
  })

  describe('error handling', () => {
    it('should propagate errors from underlying transport', async () => {
      const testError = new Error('Transport error')
      mockTransport.readHoldingRegisters.mockRejectedValue(testError)

      await expect(mutexTransport.readHoldingRegisters(0, 2)).rejects.toThrow('Transport error')
    })

    it('should release mutex on error', async () => {
      const testError = new Error('Transport error')
      mockTransport.readHoldingRegisters.mockRejectedValue(testError)

      // First operation fails
      await expect(mutexTransport.readHoldingRegisters(0, 2)).rejects.toThrow('Transport error')

      // Second operation should still work (mutex was released)
      mockTransport.readHoldingRegisters.mockResolvedValue(Buffer.alloc(4))
      await expect(mutexTransport.readHoldingRegisters(10, 2)).resolves.toEqual(Buffer.alloc(4))
    })
  })

  describe('mutex serialization across operations', () => {
    it('should serialize mixed read and write operations', async () => {
      const executionOrder: string[] = []

      mockTransport.readHoldingRegisters.mockImplementation(async () => {
        executionOrder.push('read-start')
        await new Promise((resolve) => setTimeout(resolve, 50))
        executionOrder.push('read-end')
        return Buffer.alloc(4)
      })

      mockTransport.writeSingleRegister.mockImplementation(async () => {
        executionOrder.push('write-start')
        await new Promise((resolve) => setTimeout(resolve, 10))
        executionOrder.push('write-end')
      })

      // Start read and write concurrently
      const readPromise = mutexTransport.readHoldingRegisters(0, 2)
      const writePromise = mutexTransport.writeSingleRegister(10, 1234)

      await Promise.all([readPromise, writePromise])

      // Operations should be serialized
      expect(executionOrder).toEqual(['read-start', 'read-end', 'write-start', 'write-end'])
    })

    it('should handle many concurrent operations', async () => {
      let callCount = 0

      mockTransport.readHoldingRegisters.mockImplementation(async () => {
        callCount++
        await new Promise((resolve) => setTimeout(resolve, 1))
        return Buffer.alloc(4)
      })

      // Start 10 operations concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        mutexTransport.readHoldingRegisters(i, 2)
      )

      await Promise.all(promises)

      // All operations should have completed
      expect(callCount).toBe(10)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledTimes(10)
    })
  })
})
