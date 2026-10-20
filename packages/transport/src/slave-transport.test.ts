import { Mutex } from 'async-mutex'
import type ModbusRTU from 'modbus-serial'

import { LastRequest } from './last-request.js'
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
      on: jest.fn(),
      isOpen: true,
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
      })

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
        }
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
        }
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
      })

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
      })

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
      })

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
      })

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
        })

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
        })

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

    it('should keep errno of plain-object errors from modbus-serial', async () => {
      const transport = new SlaveTransport(1, mockClient, mutex, 1)

      // modbus-serial rejects with plain objects that do not extend Error
      mockClient.readHoldingRegisters.mockRejectedValue({
        name: 'TransactionTimedOutError',
        message: 'Timed out',
        errno: 'ETIMEDOUT',
      })

      await expect(transport.readHoldingRegisters(0, 2)).rejects.toMatchObject({
        message: 'Timed out',
        errno: 'ETIMEDOUT',
      })
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
      })

      await expect(transport.readHoldingRegisters(10, 1)).resolves.toEqual(
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
        })

      await transport.readHoldingRegisters(0, 1)

      // setID should be called before each attempt (3 times total)
      expect(mockClient.setID).toHaveBeenCalledTimes(3)
      expect(mockClient.setID).toHaveBeenCalledWith(7)
    })
  })

  // Some meters ignore a request that comes too soon after another meter's reply (#655)
  describe('inter-device delay', () => {
    let lastRequest: LastRequest
    // Slave ID and time of each read that reached the client
    let reads: Array<[slaveId: number, at: number]>
    let slaveId: number
    let start: number

    // A read that takes `ms` milliseconds on the bus
    const readTaking = (ms: number) => () => {
      reads.push([slaveId, performance.now() - start])
      return new Promise<{ data: number[]; buffer: Buffer }>((resolve) =>
        setTimeout(() => resolve({ data: [0], buffer: Buffer.from([0, 0]) }), ms)
      )
    }

    const device = (id: number, interDeviceDelay: number): SlaveTransport =>
      new SlaveTransport(id, mockClient, mutex, 1, undefined, interDeviceDelay, lastRequest)

    beforeEach(() => {
      jest.useFakeTimers()
      start = performance.now()
      lastRequest = new LastRequest()
      reads = []
      mockClient.setID.mockImplementation((id: number) => {
        slaveId = id
      })
      mockClient.readHoldingRegisters.mockImplementation(readTaking(30))
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    // Run requests one after another, and let the fake time run until all have ended
    const runInTurn = async (...requests: Array<() => Promise<unknown>>): Promise<void> => {
      const done = requests.reduce<Promise<unknown>>(
        (previous, request) => previous.then(request, request),
        Promise.resolve()
      )
      await jest.runAllTimersAsync()
      await done
    }

    it('waits the delay of the next slave after the end of a request to another slave', async () => {
      const meter1 = device(1, 0)
      const meter2 = device(2, 150)

      await runInTurn(
        () => meter1.readHoldingRegisters(0, 1),
        () => meter2.readHoldingRegisters(0, 1),
        () => meter1.readHoldingRegisters(0, 1)
      )

      // The read of slave 1 ends at 30 ms. Slave 1 itself needs no pause.
      expect(reads).toEqual([
        [1, 0],
        [2, 180],
        [1, 210],
      ])
    })

    it('does not wait before the first request or before a request to the same slave', async () => {
      const meter = device(2, 150)

      await runInTurn(
        () => meter.readHoldingRegisters(0, 1),
        () => meter.readHoldingRegisters(1, 1)
      )

      expect(reads).toEqual([
        [2, 0],
        [2, 30],
      ])
    })

    it('counts the delay from the end of a failed request', async () => {
      mockClient.readHoldingRegisters.mockImplementationOnce(() => {
        reads.push([slaveId, performance.now() - start])
        return new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error('Timed out')), 1000)
        )
      })
      const meter1 = device(1, 0)
      const meter2 = device(2, 150)

      await runInTurn(
        () => meter1.readHoldingRegisters(0, 1),
        () => meter2.readHoldingRegisters(0, 1)
      )

      expect(reads).toEqual([
        [1, 0],
        [2, 1150],
      ])
    })

    it('sends a retry after the retry delay, without another pause', async () => {
      mockClient.readHoldingRegisters
        .mockImplementationOnce(readTaking(30))
        .mockImplementationOnce(() => {
          reads.push([slaveId, performance.now() - start])
          return new Promise((_resolve, reject) =>
            setTimeout(() => reject(new Error('Timed out')), 1000)
          )
        })
      const meter1 = device(1, 0)
      const meter2 = new SlaveTransport(2, mockClient, mutex, 2, undefined, 150, lastRequest)

      await runInTurn(
        () => meter1.readHoldingRegisters(0, 1),
        () => meter2.readHoldingRegisters(0, 1)
      )

      // The first try to slave 2 times out at 1180 ms, and the retry follows 100 ms later
      expect(reads).toEqual([
        [1, 0],
        [2, 180],
        [2, 1280],
      ])
    })

    it('does not wait when the request to another slave ended long enough ago', async () => {
      const meter1 = device(1, 0)
      const meter2 = device(2, 150)

      await runInTurn(() => meter1.readHoldingRegisters(0, 1))
      await jest.advanceTimersByTimeAsync(200)
      await runInTurn(() => meter2.readHoldingRegisters(0, 1))

      expect(reads).toEqual([
        [1, 0],
        [2, 230],
      ])
    })

    it('does not wait without a delay', async () => {
      const meter1 = new SlaveTransport(1, mockClient, mutex)
      const meter2 = new SlaveTransport(2, mockClient, mutex)

      await runInTurn(
        () => meter1.readHoldingRegisters(0, 1),
        () => meter2.readHoldingRegisters(0, 1)
      )

      expect(reads).toEqual([
        [1, 0],
        [2, 30],
      ])
    })
  })

  describe('when the device answers with the wrong number of bytes', () => {
    const reads = [
      { method: 'readHoldingRegisters', count: 2, expectedBytes: 4 },
      { method: 'readInputRegisters', count: 2, expectedBytes: 4 },
      { method: 'readCoils', count: 9, expectedBytes: 2 },
      { method: 'readDiscreteInputs', count: 9, expectedBytes: 2 },
    ] as const

    test.each(reads)(
      '$method sends the request again and returns the good answer',
      async ({ method, count, expectedBytes }) => {
        const good = Buffer.alloc(expectedBytes, 1)
        mockClient[method]
          .mockResolvedValueOnce({ buffer: Buffer.alloc(1) } as never)
          .mockResolvedValueOnce({ buffer: good } as never)
        const transport = new SlaveTransport(1, mockClient, mutex, 2)

        await expect(transport[method](0, count)).resolves.toBe(good)
        expect(mockClient[method]).toHaveBeenCalledTimes(2)
      }
    )

    test.each(reads)(
      '$method rejects and says what was expected when every answer is wrong',
      async ({ method, count, expectedBytes }) => {
        mockClient[method].mockResolvedValue({ buffer: Buffer.alloc(expectedBytes + 1) } as never)
        const transport = new SlaveTransport(1, mockClient, mutex, 2)

        await expect(transport[method](0, count)).rejects.toThrow(
          `Wrong answer length: expected ${expectedBytes} data bytes, got ${expectedBytes + 1}`
        )
      }
    )
  })
})
