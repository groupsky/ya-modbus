import type { Transport } from '@ya-modbus/driver-types'

import { runProfileScan } from './cli.js'
import { RegisterType } from './read-tester.js'

jest.mock('chalk')
jest.mock('cli-table3')

describe('runProfileScan', () => {
  let mockConsoleLog: jest.SpyInstance
  let mockConsoleError: jest.SpyInstance

  beforeEach(() => {
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation()
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    mockConsoleLog.mockRestore()
    mockConsoleError.mockRestore()
  })

  /**
   * Transport read that answers every register with the same byte pair
   * (a real transport returns two bytes for each register requested)
   */
  function readsWithByte(byte: number): jest.Mock {
    return jest
      .fn()
      .mockImplementation((_address: number, count: number) =>
        Promise.resolve(Buffer.alloc(count * 2, byte))
      )
  }

  it('should scan registers and display progress', async () => {
    const mockTransport: Transport = {
      readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x01, 0x23, 0x45, 0x67])),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as Transport

    await runProfileScan({
      transport: mockTransport,
      type: RegisterType.Holding,
      startAddress: 0,
      endAddress: 1,
    })

    expect(mockConsoleLog).toHaveBeenCalled()
    expect(mockTransport.close).toHaveBeenCalled()
  })

  it('should scan input registers', async () => {
    const mockTransport: Transport = {
      readInputRegisters: jest.fn().mockResolvedValue(Buffer.from([0xab, 0xcd])),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as Transport

    await runProfileScan({
      transport: mockTransport,
      type: RegisterType.Input,
      startAddress: 100,
      endAddress: 100,
    })

    expect(mockTransport.readInputRegisters).toHaveBeenCalled()
    expect(mockTransport.close).toHaveBeenCalled()
  })

  it('should handle scan errors gracefully', async () => {
    const mockTransport: Transport = {
      readHoldingRegisters: jest.fn().mockRejectedValue(new Error('Connection failed')),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as Transport

    await runProfileScan({
      transport: mockTransport,
      type: RegisterType.Holding,
      startAddress: 0,
      endAddress: 0,
    })

    expect(mockTransport.close).toHaveBeenCalled()
  })

  it('should display summary table', async () => {
    const mockTransport: Transport = {
      readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x00])),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as Transport

    await runProfileScan({
      transport: mockTransport,
      type: RegisterType.Holding,
      startAddress: 0,
      endAddress: 0,
    })

    const logOutput = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
    expect(logOutput).toContain('Address')
    expect(mockTransport.close).toHaveBeenCalled()
  })

  it('should close transport even if scan fails', async () => {
    const scanError = new Error('Scan failed')
    const mockTransport: Transport = {
      readHoldingRegisters: jest.fn().mockRejectedValue(scanError),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as Transport

    await runProfileScan({
      transport: mockTransport,
      type: RegisterType.Holding,
      startAddress: 0,
      endAddress: 0,
    })

    expect(mockTransport.close).toHaveBeenCalled()
  })

  it('should respect custom batch size', async () => {
    const mockTransport: Transport = {
      readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x00])),
      close: jest.fn().mockResolvedValue(undefined),
    } as unknown as Transport

    await runProfileScan({
      transport: mockTransport,
      type: RegisterType.Holding,
      startAddress: 0,
      endAddress: 5,
      batchSize: 2,
    })

    expect(mockTransport.close).toHaveBeenCalled()
  })

  describe('JSON output format', () => {
    /** Parse the single JSON document that the scan printed */
    function printedJSON(): unknown {
      expect(mockConsoleLog).toHaveBeenCalledTimes(1)
      return JSON.parse(mockConsoleLog.mock.calls[0][0] as string)
    }

    it('should print the scan as one JSON document when format is json', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x12, 0x34])),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      await runProfileScan({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 0,
        format: 'json',
        port: '/dev/ttyUSB0',
      })

      expect(printedJSON()).toEqual({
        timestamp: expect.any(String),
        scan: { type: 'holding', startAddress: 0, endAddress: 0, batchSize: 10 },
        connection: { port: '/dev/ttyUSB0' },
        results: [
          { address: 0, type: 'holding', success: true, value: 4660, timing: expect.any(Number) },
        ],
        summary: {
          total: 1,
          successful: 1,
          failed: 0,
          totalTimeMs: expect.any(Number),
          averageTimeMs: expect.any(Number),
        },
      })
      expect(mockTransport.close).toHaveBeenCalled()
    })

    it('should suppress progress output when format is json', async () => {
      const mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation()

      const mockTransport: Transport = {
        readHoldingRegisters: readsWithByte(0x00),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      await runProfileScan({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 5,
        format: 'json',
        port: 'localhost:502',
      })

      // Progress should not be written to stdout in JSON mode
      expect(mockStdoutWrite).not.toHaveBeenCalled()
      mockStdoutWrite.mockRestore()

      // The only line on the console is the JSON document
      printedJSON()
    })

    it('should output table when format is table (default)', async () => {
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x00])),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      await runProfileScan({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 0,
        format: 'table',
        port: '/dev/ttyUSB0',
      })

      const logOutput = mockConsoleLog.mock.calls.map((call) => call[0]).join('\n')
      expect(logOutput).toContain('Address')
      expect(mockTransport.close).toHaveBeenCalled()
    })

    it('should report the scan settings and the values read', async () => {
      const mockTransport: Transport = {
        readInputRegisters: readsWithByte(0xab),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      await runProfileScan({
        transport: mockTransport,
        type: RegisterType.Input,
        startAddress: 100,
        endAddress: 104,
        batchSize: 2,
        format: 'json',
        port: 'localhost:502',
      })

      const output = printedJSON()
      expect(output).toMatchObject({
        scan: { type: 'input', startAddress: 100, endAddress: 104, batchSize: 2 },
        connection: { port: 'localhost:502' },
        summary: { total: 5, successful: 5, failed: 0 },
      })
      expect(output).toHaveProperty(
        'results',
        [100, 101, 102, 103, 104].map((address) =>
          expect.objectContaining({ address, type: 'input', success: true, value: 0xabab })
        )
      )
    })

    it('should report registers that failed to read with their error', async () => {
      // The batch read fails, so the scan falls back to one read per register
      const mockTransport: Transport = {
        readHoldingRegisters: jest
          .fn()
          .mockImplementation((address: number, count: number) =>
            count === 1 && address === 0
              ? Promise.resolve(Buffer.from([0x00, 0x2a]))
              : Promise.reject(new Error('Timeout waiting for response'))
          ),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      await runProfileScan({
        transport: mockTransport,
        type: RegisterType.Holding,
        startAddress: 0,
        endAddress: 1,
        format: 'json',
        port: '/dev/ttyUSB0',
      })

      expect(printedJSON()).toMatchObject({
        results: [
          { address: 0, success: true, value: 42 },
          {
            address: 1,
            success: false,
            value: null,
            error: 'Timeout waiting for response',
            errorType: 'timeout',
          },
        ],
        summary: { total: 2, successful: 1, failed: 1 },
      })
    })
  })
})
