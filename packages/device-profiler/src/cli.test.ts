import type { Transport } from '@ya-modbus/driver-types'

import { runProfileScan } from './cli.js'
import { RegisterType } from './read-tester.js'

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
})
