import type { Transport } from '@ya-modbus/driver-types'

import { ErrorType } from './error-classifier.js'
import { testRead, RegisterType } from './read-tester.js'

describe('testRead', () => {
  describe('successful reads', () => {
    it('should read holding register and measure timing', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x01, 0x02])),
      } as unknown as Transport

      const result = await testRead(mockTransport, RegisterType.Holding, 100, 1)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(Buffer.from([0x01, 0x02]))
      expect(result.timing).toBeGreaterThanOrEqual(0)
      expect(result.timing).toBeLessThan(1000)
      expect(result.error).toBeUndefined()
      expect(result.errorType).toBeUndefined()
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(100, 1)
    })

    it('should read input register and measure timing', async () => {
      const mockTransport: Transport = {
        readInputRegisters: jest.fn().mockResolvedValue(Buffer.from([0xab, 0xcd])),
      } as unknown as Transport

      const result = await testRead(mockTransport, RegisterType.Input, 200, 1)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(Buffer.from([0xab, 0xcd]))
      expect(result.timing).toBeGreaterThanOrEqual(0)
      expect(result.error).toBeUndefined()
      expect(result.errorType).toBeUndefined()
      expect(mockTransport.readInputRegisters).toHaveBeenCalledWith(200, 1)
    })

    it('should read multiple registers', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x01, 0x02, 0x03, 0x04])),
      } as unknown as Transport

      const result = await testRead(mockTransport, RegisterType.Holding, 0, 2)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(Buffer.from([0x01, 0x02, 0x03, 0x04]))
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0, 2)
    })
  })

  describe('failed reads', () => {
    it('should classify timeout error', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockRejectedValue(new Error('Timed out')),
      } as unknown as Transport

      const result = await testRead(mockTransport, RegisterType.Holding, 100, 1)

      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()
      expect(result.timing).toBeGreaterThanOrEqual(0)
      expect(result.error).toBe('Timed out')
      expect(result.errorType).toBe(ErrorType.Timeout)
    })

    it('should classify CRC error', async () => {
      const mockTransport: Transport = {
        readInputRegisters: jest.fn().mockRejectedValue(new Error('Bad CRC')),
      } as unknown as Transport

      const result = await testRead(mockTransport, RegisterType.Input, 200, 1)

      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()
      expect(result.error).toBe('Bad CRC')
      expect(result.errorType).toBe(ErrorType.CRC)
    })

    it('should classify Modbus exception error', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest
          .fn()
          .mockRejectedValue(new Error('Modbus exception 2: Illegal data address')),
      } as unknown as Transport

      const result = await testRead(mockTransport, RegisterType.Holding, 999, 1)

      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()
      expect(result.error).toBe('Modbus exception 2: Illegal data address')
      expect(result.errorType).toBe(ErrorType.ModbusException)
    })

    it('should classify unknown error', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockRejectedValue(new Error('Port not open')),
      } as unknown as Transport

      const result = await testRead(mockTransport, RegisterType.Holding, 100, 1)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Port not open')
      expect(result.errorType).toBe(ErrorType.Unknown)
    })
  })

  describe('timing measurement', () => {
    it('should measure timing even for fast operations', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x00])),
      } as unknown as Transport

      const result = await testRead(mockTransport, RegisterType.Holding, 0, 1)

      expect(result.timing).toBeGreaterThanOrEqual(0)
      expect(typeof result.timing).toBe('number')
    })

    it('should measure timing for failed operations', async () => {
      const mockTransport: Transport = {
        readInputRegisters: jest.fn().mockImplementation(() => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 10)
          })
        }),
      } as unknown as Transport

      const result = await testRead(mockTransport, RegisterType.Input, 100, 1)

      expect(result.success).toBe(false)
      expect(result.timing).toBeGreaterThanOrEqual(9)
    })
  })

  describe('edge cases', () => {
    it('should handle address 0', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x00])),
      } as unknown as Transport

      const result = await testRead(mockTransport, RegisterType.Holding, 0, 1)

      expect(result.success).toBe(true)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0, 1)
    })

    it('should handle maximum address', async () => {
      const mockTransport: Transport = {
        readInputRegisters: jest.fn().mockResolvedValue(Buffer.from([0xff, 0xff])),
      } as unknown as Transport

      const result = await testRead(mockTransport, RegisterType.Input, 65535, 1)

      expect(result.success).toBe(true)
      expect(mockTransport.readInputRegisters).toHaveBeenCalledWith(65535, 1)
    })

    it('should handle non-Error thrown values', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockRejectedValue('String error'),
      } as unknown as Transport

      const result = await testRead(mockTransport, RegisterType.Holding, 0, 1)

      expect(result.success).toBe(false)
      expect(result.error).toBe('String error')
    })
  })
})
