import type { Transport } from '@ya-modbus/driver-types'

import { ErrorType } from './error-classifier.js'
import { RegisterType } from './read-tester.js'
import { scanRegisters, type ScanResult } from './register-scanner.js'

describe('scanRegisters', () => {
  describe('successful batch scanning', () => {
    it('should scan range with batch reads', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest
          .fn()
          .mockResolvedValue(Buffer.from([0x00, 0x01, 0x00, 0x02, 0x00, 0x03])),
      } as unknown as Transport

      const results: ScanResult[] = []
      await scanRegisters({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 2,
        onResult: (result) => results.push(result),
      })

      expect(results).toHaveLength(3)
      expect(results[0]).toMatchObject({ address: 0, success: true })
      expect(results[1]).toMatchObject({ address: 1, success: true })
      expect(results[2]).toMatchObject({ address: 2, success: true })
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledTimes(1)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0, 3)
    })

    it('should respect custom batch size', async () => {
      const mockTransport: Transport = {
        readInputRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x01, 0x00, 0x02])),
      } as unknown as Transport

      await scanRegisters({
        transport: mockTransport,
        type: RegisterType.Input,
        startAddress: 0,
        endAddress: 3,
        batchSize: 2,
      })

      expect(mockTransport.readInputRegisters).toHaveBeenCalledTimes(2)
      expect(mockTransport.readInputRegisters).toHaveBeenCalledWith(0, 2)
      expect(mockTransport.readInputRegisters).toHaveBeenCalledWith(2, 2)
    })
  })

  describe('fallback to individual reads', () => {
    it('should fallback to individual reads on batch error', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest
          .fn()
          .mockRejectedValueOnce(new Error('Modbus exception 2'))
          .mockResolvedValueOnce(Buffer.from([0x00, 0x01]))
          .mockRejectedValueOnce(new Error('Modbus exception 2'))
          .mockRejectedValueOnce(new Error('Modbus exception 2'))
          .mockResolvedValueOnce(Buffer.from([0x00, 0x03])),
      } as unknown as Transport

      const results: ScanResult[] = []
      await scanRegisters({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 3,
        batchSize: 4,
        onResult: (result) => results.push(result),
      })

      expect(results).toHaveLength(4)
      expect(results[0]).toMatchObject({ address: 0, success: true })
      expect(results[1]).toMatchObject({
        address: 1,
        success: false,
        errorType: ErrorType.ModbusException,
      })
      expect(results[2]).toMatchObject({
        address: 2,
        success: false,
        errorType: ErrorType.ModbusException,
      })
      expect(results[3]).toMatchObject({ address: 3, success: true })

      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledTimes(5)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0, 4)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0, 1)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(1, 1)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(2, 1)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(3, 1)
    })
  })

  describe('progress callbacks', () => {
    it('should call onProgress callback', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x01, 0x00, 0x02])),
      } as unknown as Transport

      const progressCalls: Array<[number, number]> = []
      await scanRegisters({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 1,
        onProgress: (current, total) => progressCalls.push([current, total]),
      })

      expect(progressCalls.length).toBeGreaterThan(0)
      expect(progressCalls[progressCalls.length - 1]).toEqual([2, 2])
    })

    it('should call onResult for each register', async () => {
      const mockTransport: Transport = {
        readInputRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x01])),
      } as unknown as Transport

      const results: ScanResult[] = []
      await scanRegisters({
        transport: mockTransport,
        type: RegisterType.Input,
        startAddress: 100,
        endAddress: 100,
        onResult: (result) => results.push(result),
      })

      expect(results).toHaveLength(1)
      expect(results[0].address).toBe(100)
    })
  })

  describe('register type handling', () => {
    it('should scan holding registers', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x01])),
        readInputRegisters: jest.fn(),
      } as unknown as Transport

      await scanRegisters({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 0,
      })

      expect(mockTransport.readHoldingRegisters).toHaveBeenCalled()
      expect(mockTransport.readInputRegisters).not.toHaveBeenCalled()
    })

    it('should scan input registers', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn(),
        readInputRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x01])),
      } as unknown as Transport

      await scanRegisters({
        transport: mockTransport,
        type: RegisterType.Input,
        startAddress: 0,
        endAddress: 0,
      })

      expect(mockTransport.readInputRegisters).toHaveBeenCalled()
      expect(mockTransport.readHoldingRegisters).not.toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('should handle single register scan', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x01])),
      } as unknown as Transport

      const results: ScanResult[] = []
      await scanRegisters({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 42,
        endAddress: 42,
        onResult: (result) => results.push(result),
      })

      expect(results).toHaveLength(1)
      expect(results[0].address).toBe(42)
    })

    it('should work without onResult callback', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x01])),
      } as unknown as Transport

      await scanRegisters({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 0,
      })

      expect(mockTransport.readHoldingRegisters).toHaveBeenCalled()
    })

    it('should work without onProgress callback on fallback', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest
          .fn()
          .mockRejectedValueOnce(new Error('Batch failed'))
          .mockResolvedValueOnce(Buffer.from([0x00, 0x01])),
      } as unknown as Transport

      await scanRegisters({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 0,
      })

      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledTimes(2)
    })

    it('should handle address 0', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x00])),
      } as unknown as Transport

      const results: ScanResult[] = []
      await scanRegisters({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 0,
        onResult: (result) => results.push(result),
      })

      expect(results[0].address).toBe(0)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0, 1)
    })
  })
})
