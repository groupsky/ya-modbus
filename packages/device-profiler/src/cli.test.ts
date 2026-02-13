import type { Transport } from '@ya-modbus/driver-types'

import { runProfileScan } from './cli.js'
import * as jsonFormatterModule from './json-formatter.js'
import { RegisterType } from './read-tester.js'

jest.mock('chalk')
jest.mock('cli-table3')
jest.mock('./json-formatter.js')

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
    it('should output JSON when format is json', async () => {
      const mockFormatJSON = jest.fn().mockReturnValue('{"test": "json"}')
      ;(jsonFormatterModule.formatJSON as jest.Mock) = mockFormatJSON

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

      expect(mockFormatJSON).toHaveBeenCalled()
      expect(mockConsoleLog).toHaveBeenCalledWith('{"test": "json"}')
      expect(mockTransport.close).toHaveBeenCalled()
    })

    it('should suppress progress output when format is json', async () => {
      const mockFormatJSON = jest.fn().mockReturnValue('{}')
      ;(jsonFormatterModule.formatJSON as jest.Mock) = mockFormatJSON

      const mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation()

      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.from([0x00, 0x00])),
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

    it('should pass correct metadata to JSON formatter', async () => {
      const mockFormatJSON = jest.fn().mockReturnValue('{}')
      ;(jsonFormatterModule.formatJSON as jest.Mock) = mockFormatJSON

      const mockTransport: Transport = {
        readInputRegisters: jest.fn().mockResolvedValue(Buffer.from([0xab, 0xcd])),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as Transport

      await runProfileScan({
        transport: mockTransport,
        type: RegisterType.Input,
        startAddress: 100,
        endAddress: 200,
        batchSize: 25,
        format: 'json',
        port: 'localhost:502',
      })

      expect(mockFormatJSON).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          type: RegisterType.Input,
          startAddress: 100,
          endAddress: 200,
          batchSize: 25,
          port: 'localhost:502',
        })
      )
    })
  })
})
