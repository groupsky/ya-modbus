import { Mutex } from 'async-mutex'
import type ModbusRTU from 'modbus-serial'

import { SlaveTransport } from './slave-transport.js'

describe('SlaveTransport', () => {
  let mockClient: jest.Mocked<ModbusRTU>
  let mutex: Mutex

  beforeEach(() => {
    mockClient = {
      setID: jest.fn(),
      readHoldingRegisters: jest.fn(),
      readInputRegisters: jest.fn(),
      readCoils: jest.fn(),
      readDiscreteInputs: jest.fn(),
      writeRegister: jest.fn(),
      writeRegisters: jest.fn(),
      writeCoil: jest.fn(),
      writeCoils: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<ModbusRTU>
    mutex = new Mutex()
  })

  describe('slave ID management', () => {
    it('should set slave ID before each read operation', async () => {
      const transport = new SlaveTransport(5, mockClient, mutex, 3)
      const callOrder: string[] = []

      mockClient.setID.mockImplementation((id: number) => {
        callOrder.push(`setID-${id}`)
      })

      mockClient.readHoldingRegisters.mockImplementation(() => {
        callOrder.push('readHoldingRegisters')
        return Promise.resolve({
          data: [0x1234],
          buffer: Buffer.from([0x12, 0x34]),
        } as never)
      })

      await transport.readHoldingRegisters(0, 1)

      expect(mockClient.setID).toHaveBeenCalledWith(5)
      expect(callOrder).toEqual(['setID-5', 'readHoldingRegisters'])
    })

    it('should set slave ID before each write operation', async () => {
      const transport = new SlaveTransport(3, mockClient, mutex, 3)
      const callOrder: string[] = []

      mockClient.setID.mockImplementation((id: number) => {
        callOrder.push(`setID-${id}`)
      })

      mockClient.writeRegister.mockImplementation(() => {
        callOrder.push('writeRegister')
        return Promise.resolve({} as never)
      })

      await transport.writeSingleRegister(10, 0x5678)

      expect(mockClient.setID).toHaveBeenCalledWith(3)
      expect(callOrder).toEqual(['setID-3', 'writeRegister'])
    })

    it('should use different slave IDs for different transport instances', async () => {
      const transport1 = new SlaveTransport(1, mockClient, mutex, 3)
      const transport2 = new SlaveTransport(2, mockClient, mutex, 3)

      mockClient.readHoldingRegisters.mockResolvedValue({
        data: [0x0000],
        buffer: Buffer.from([0x00, 0x00]),
      } as never)

      await transport1.readHoldingRegisters(0, 1)
      await transport2.readHoldingRegisters(0, 1)

      expect(mockClient.setID).toHaveBeenNthCalledWith(1, 1)
      expect(mockClient.setID).toHaveBeenNthCalledWith(2, 2)
      expect(mockClient.readHoldingRegisters).toHaveBeenCalledTimes(2)
    })
  })

  describe('mutex serialization', () => {
    it('should serialize operations on the same slave', async () => {
      const transport = new SlaveTransport(1, mockClient, mutex, 3)
      const executionOrder: string[] = []

      mockClient.readHoldingRegisters.mockImplementation(async (address: number) => {
        executionOrder.push(`start-${address}`)
        await new Promise((resolve) => setTimeout(resolve, 50))
        executionOrder.push(`end-${address}`)
        return {
          data: [0x0000],
          buffer: Buffer.from([0x00, 0x00]),
        } as never
      })

      // Start two operations concurrently
      const promise1 = transport.readHoldingRegisters(0, 1)
      const promise2 = transport.readHoldingRegisters(10, 1)

      await Promise.all([promise1, promise2])

      // Operations should be serialized
      expect(executionOrder).toEqual(['start-0', 'end-0', 'start-10', 'end-10'])
    })

    it('should serialize operations across different slaves sharing the same bus', async () => {
      const transport1 = new SlaveTransport(1, mockClient, mutex, 3)
      const transport2 = new SlaveTransport(2, mockClient, mutex, 3)
      const executionOrder: string[] = []

      mockClient.readHoldingRegisters.mockImplementation(async () => {
        const slaveId = mockClient.setID.mock.calls[mockClient.setID.mock.calls.length - 1][0]
        executionOrder.push(`start-slave${slaveId}`)
        await new Promise((resolve) => setTimeout(resolve, 50))
        executionOrder.push(`end-slave${slaveId}`)
        return {
          data: [0x0000],
          buffer: Buffer.from([0x00, 0x00]),
        } as never
      })

      // Start operations on different slaves concurrently
      const promise1 = transport1.readHoldingRegisters(0, 1)
      const promise2 = transport2.readHoldingRegisters(0, 1)

      await Promise.all([promise1, promise2])

      // Operations should be serialized even across different slaves
      expect(executionOrder).toEqual(['start-slave1', 'end-slave1', 'start-slave2', 'end-slave2'])
      expect(mockClient.setID).toHaveBeenCalledTimes(2)
    })
  })

  describe('Transport interface implementation', () => {
    it('should implement readHoldingRegisters', async () => {
      const transport = new SlaveTransport(1, mockClient, mutex, 3)

      mockClient.readHoldingRegisters.mockResolvedValue({
        data: [0x00f5, 0x0064],
        buffer: Buffer.from([0x00, 0xf5, 0x00, 0x64]),
      } as never)

      const result = await transport.readHoldingRegisters(0, 2)

      expect(mockClient.setID).toHaveBeenCalledWith(1)
      expect(mockClient.readHoldingRegisters).toHaveBeenCalledWith(0, 2)
      expect(result).toBeInstanceOf(Buffer)
      expect(result.length).toBe(4)
    })

    it('should implement readInputRegisters', async () => {
      const transport = new SlaveTransport(2, mockClient, mutex, 3)

      mockClient.readInputRegisters.mockResolvedValue({
        data: [0x0100, 0x0200],
        buffer: Buffer.from([0x01, 0x00, 0x02, 0x00]),
      } as never)

      const result = await transport.readInputRegisters(10, 2)

      expect(mockClient.setID).toHaveBeenCalledWith(2)
      expect(mockClient.readInputRegisters).toHaveBeenCalledWith(10, 2)
      expect(result).toBeInstanceOf(Buffer)
    })

    it('should implement readCoils', async () => {
      const transport = new SlaveTransport(3, mockClient, mutex, 3)

      mockClient.readCoils.mockResolvedValue({
        data: [true, false, true],
        buffer: Buffer.from([0x05]),
      } as never)

      const result = await transport.readCoils(0, 3)

      expect(mockClient.setID).toHaveBeenCalledWith(3)
      expect(mockClient.readCoils).toHaveBeenCalledWith(0, 3)
      expect(result).toBeInstanceOf(Buffer)
    })

    it('should implement readDiscreteInputs', async () => {
      const transport = new SlaveTransport(4, mockClient, mutex, 3)

      mockClient.readDiscreteInputs.mockResolvedValue({
        data: [false, true],
        buffer: Buffer.from([0x02]),
      } as never)

      const result = await transport.readDiscreteInputs(5, 2)

      expect(mockClient.setID).toHaveBeenCalledWith(4)
      expect(mockClient.readDiscreteInputs).toHaveBeenCalledWith(5, 2)
      expect(result).toBeInstanceOf(Buffer)
    })

    it('should implement writeSingleRegister', async () => {
      const transport = new SlaveTransport(5, mockClient, mutex, 3)

      mockClient.writeRegister.mockResolvedValue({} as never)

      await transport.writeSingleRegister(100, 0x1234)

      expect(mockClient.setID).toHaveBeenCalledWith(5)
      expect(mockClient.writeRegister).toHaveBeenCalledWith(100, 0x1234)
    })

    it('should implement writeMultipleRegisters', async () => {
      const transport = new SlaveTransport(6, mockClient, mutex, 3)

      mockClient.writeRegisters.mockResolvedValue({} as never)

      const values = Buffer.from([0x12, 0x34, 0x56, 0x78])
      await transport.writeMultipleRegisters(50, values)

      expect(mockClient.setID).toHaveBeenCalledWith(6)
      expect(mockClient.writeRegisters).toHaveBeenCalledWith(50, values)
    })

    it('should implement writeSingleCoil', async () => {
      const transport = new SlaveTransport(7, mockClient, mutex, 3)

      mockClient.writeCoil.mockResolvedValue({} as never)

      await transport.writeSingleCoil(10, true)

      expect(mockClient.setID).toHaveBeenCalledWith(7)
      expect(mockClient.writeCoil).toHaveBeenCalledWith(10, true)
    })

    it('should implement writeMultipleCoils', async () => {
      const transport = new SlaveTransport(8, mockClient, mutex, 3)

      mockClient.writeCoils.mockResolvedValue({} as never)

      const values = Buffer.from([0xff, 0x00])
      await transport.writeMultipleCoils(20, values)

      expect(mockClient.setID).toHaveBeenCalledWith(8)
      const expectedBools = [
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
      ]
      expect(mockClient.writeCoils).toHaveBeenCalledWith(20, expectedBools)
    })

    it('should implement close without using mutex', async () => {
      const transport = new SlaveTransport(1, mockClient, mutex, 3)

      let closeCallback: (() => void) | undefined
      mockClient.close.mockImplementation((callback?: () => void) => {
        closeCallback = callback
      })

      // Acquire mutex to verify close doesn't wait for it
      const release = await mutex.acquire()

      const closePromise = transport.close()

      // Simulate async close completion
      if (closeCallback) {
        closeCallback()
      }

      await closePromise

      expect(mockClient.close).toHaveBeenCalled()
      expect(mockClient.setID).not.toHaveBeenCalled()

      release()
    })
  })

  describe('retry logic', () => {
    it('should retry on transient failures', async () => {
      const transport = new SlaveTransport(1, mockClient, mutex, 3)

      mockClient.readHoldingRegisters
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          data: [0x00f5],
          buffer: Buffer.from([0x00, 0xf5]),
        } as never)

      const result = await transport.readHoldingRegisters(0, 1)

      expect(mockClient.readHoldingRegisters).toHaveBeenCalledTimes(3)
      expect(mockClient.setID).toHaveBeenCalledTimes(3)
      expect(result).toBeInstanceOf(Buffer)
    })

    it('should throw after max retries exceeded', async () => {
      const transport = new SlaveTransport(1, mockClient, mutex, 3)

      mockClient.readHoldingRegisters.mockRejectedValue(new Error('Connection lost'))

      await expect(transport.readHoldingRegisters(0, 1)).rejects.toThrow('Connection lost')
      expect(mockClient.readHoldingRegisters).toHaveBeenCalledTimes(3)
      expect(mockClient.setID).toHaveBeenCalledTimes(3)
    })

    it('should respect custom maxRetries', async () => {
      const transport = new SlaveTransport(1, mockClient, mutex, 5)

      mockClient.readHoldingRegisters.mockRejectedValue(new Error('Failed'))

      await expect(transport.readHoldingRegisters(0, 1)).rejects.toThrow('Failed')
      expect(mockClient.readHoldingRegisters).toHaveBeenCalledTimes(5)
    })

    it('should call logger on retry attempts', async () => {
      const logger = jest.fn()
      const transport = new SlaveTransport(1, mockClient, mutex, 3, logger)

      mockClient.readHoldingRegisters
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce({
          data: [0x1234],
          buffer: Buffer.from([0x12, 0x34]),
        } as never)

      const result = await transport.readHoldingRegisters(0, 1)

      expect(result).toBeInstanceOf(Buffer)
      expect(mockClient.readHoldingRegisters).toHaveBeenCalledTimes(3)
      expect(logger).toHaveBeenCalledTimes(2)
      expect(logger).toHaveBeenNthCalledWith(1, 1, expect.objectContaining({ message: 'Error 1' }))
      expect(logger).toHaveBeenNthCalledWith(2, 2, expect.objectContaining({ message: 'Error 2' }))
    })
  })

  describe('error handling', () => {
    it('should propagate errors from modbus-serial', async () => {
      const transport = new SlaveTransport(1, mockClient, mutex, 3)
      const testError = new Error('Modbus error')

      mockClient.readHoldingRegisters.mockRejectedValue(testError)

      await expect(transport.readHoldingRegisters(0, 2)).rejects.toThrow('Modbus error')
    })

    it('should release mutex on error', async () => {
      const transport = new SlaveTransport(1, mockClient, mutex, 3)
      const testError = new Error('Transport error')

      mockClient.readHoldingRegisters.mockRejectedValue(testError)

      // First operation fails
      await expect(transport.readHoldingRegisters(0, 2)).rejects.toThrow('Transport error')

      // Second operation should still work (mutex was released)
      mockClient.readHoldingRegisters.mockResolvedValue({
        data: [0x0000],
        buffer: Buffer.from([0x00, 0x00]),
      } as never)

      await expect(transport.readHoldingRegisters(10, 2)).resolves.toEqual(
        Buffer.from([0x00, 0x00])
      )
    })

    it('should set slave ID on each retry attempt', async () => {
      const transport = new SlaveTransport(7, mockClient, mutex, 3)

      mockClient.readHoldingRegisters
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce({
          data: [0x1234],
          buffer: Buffer.from([0x12, 0x34]),
        } as never)

      await transport.readHoldingRegisters(0, 1)

      // setID should be called before each attempt (3 times total)
      expect(mockClient.setID).toHaveBeenCalledTimes(3)
      expect(mockClient.setID).toHaveBeenCalledWith(7)
    })
  })
})
