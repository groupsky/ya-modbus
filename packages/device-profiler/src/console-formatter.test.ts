import { formatProgress, formatSummary } from './console-formatter.js'
import { ErrorType } from './error-classifier.js'
import { RegisterType } from './read-tester.js'
import type { ScanResult } from './register-scanner.js'

describe('formatProgress', () => {
  it('should format progress with percentage', () => {
    const output = formatProgress(50, 100)
    expect(output).toContain('50')
    expect(output).toContain('100')
    expect(output).toContain('50%')
  })

  it('should format progress at 0%', () => {
    const output = formatProgress(0, 100)
    expect(output).toContain('0')
    expect(output).toContain('100')
    expect(output).toContain('0%')
  })

  it('should format progress at 100%', () => {
    const output = formatProgress(100, 100)
    expect(output).toContain('100')
    expect(output).toContain('100%')
  })

  it('should format progress for single register', () => {
    const output = formatProgress(1, 1)
    expect(output).toContain('1')
    expect(output).toContain('100%')
  })

  it('should handle total of 0', () => {
    const output = formatProgress(0, 0)
    expect(output).toContain('0%')
  })
})

describe('formatSummary', () => {
  it('should format summary table with successful reads', () => {
    const results: ScanResult[] = [
      {
        address: 0,
        type: RegisterType.Holding,
        success: true,
        value: Buffer.from([0x01, 0x23]),
        timing: 10.5,
      },
      {
        address: 1,
        type: RegisterType.Holding,
        success: true,
        value: Buffer.from([0x45, 0x67]),
        timing: 12.3,
      },
    ]

    const output = formatSummary(results)

    expect(output).toContain('Address')
    expect(output).toContain('Type')
    expect(output).toContain('Status')
    expect(output).toContain('Value')
    expect(output).toContain('Timing')
    expect(output).toContain('0')
    expect(output).toContain('1')
    expect(output).toContain('holding')
    expect(output).toContain('0123')
    expect(output).toContain('4567')
    expect(output).toContain('10.5')
    expect(output).toContain('12.3')
  })

  it('should format summary table with failed reads', () => {
    const results: ScanResult[] = [
      {
        address: 100,
        type: RegisterType.Input,
        success: false,
        timing: 100.5,
        error: 'Timeout',
        errorType: ErrorType.Timeout,
      },
      {
        address: 101,
        type: RegisterType.Input,
        success: false,
        timing: 50.2,
        error: 'Bad CRC',
        errorType: ErrorType.CRC,
      },
    ]

    const output = formatSummary(results)

    expect(output).toContain('100')
    expect(output).toContain('101')
    expect(output).toContain('input')
    expect(output).toContain('Timeout')
    expect(output).toContain('Bad CRC')
    expect(output).toContain('100.5')
    expect(output).toContain('50.2')
  })

  it('should format summary table with mixed results', () => {
    const results: ScanResult[] = [
      {
        address: 0,
        type: RegisterType.Holding,
        success: true,
        value: Buffer.from([0xff, 0xff]),
        timing: 5.0,
      },
      {
        address: 1,
        type: RegisterType.Holding,
        success: false,
        timing: 100.0,
        error: 'Modbus exception 2',
        errorType: ErrorType.ModbusException,
      },
    ]

    const output = formatSummary(results)

    expect(output).toContain('0')
    expect(output).toContain('1')
    expect(output).toContain('FFFF')
    expect(output).toContain('Modbus exception 2')
  })

  it('should handle empty results', () => {
    const results: ScanResult[] = []
    const output = formatSummary(results)

    expect(output).toContain('Address')
    expect(output).toContain('Type')
  })

  it('should format register types correctly', () => {
    const results: ScanResult[] = [
      {
        address: 0,
        type: RegisterType.Holding,
        success: true,
        value: Buffer.from([0x00, 0x00]),
        timing: 1.0,
      },
      {
        address: 0,
        type: RegisterType.Input,
        success: true,
        value: Buffer.from([0x00, 0x00]),
        timing: 1.0,
      },
    ]

    const output = formatSummary(results)

    expect(output).toContain('holding')
    expect(output).toContain('input')
  })

  it('should format hex values correctly', () => {
    const results: ScanResult[] = [
      {
        address: 0,
        type: RegisterType.Holding,
        success: true,
        value: Buffer.from([0x00, 0x00]),
        timing: 1.0,
      },
      {
        address: 1,
        type: RegisterType.Holding,
        success: true,
        value: Buffer.from([0xab, 0xcd]),
        timing: 1.0,
      },
    ]

    const output = formatSummary(results)

    expect(output).toContain('0000')
    expect(output).toContain('ABCD')
  })

  it('should round timing values', () => {
    const results: ScanResult[] = [
      {
        address: 0,
        type: RegisterType.Holding,
        success: true,
        value: Buffer.from([0x00, 0x00]),
        timing: 12.3456,
      },
    ]

    const output = formatSummary(results)

    expect(output).toContain('12.3')
  })
})
