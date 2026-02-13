/**
 * Tests for JSON formatter
 */

import { formatJSON, type JSONFormatterOptions } from './json-formatter.js'
import { RegisterType } from './read-tester.js'
import type { ScanResult } from './register-scanner.js'

describe('formatJSON', () => {
  it('should format empty results with basic metadata', () => {
    const results: ScanResult[] = []
    const options: JSONFormatterOptions = {
      type: RegisterType.Holding,
      startAddress: 0,
      endAddress: 100,
      batchSize: 10,
      port: '/dev/ttyUSB0',
    }

    const output = formatJSON(results, options)
    const parsed = JSON.parse(output)

    expect(parsed).toHaveProperty('timestamp')
    expect(new Date(parsed.timestamp)).toBeInstanceOf(Date)
    expect(parsed.scan).toEqual({
      type: 'holding',
      startAddress: 0,
      endAddress: 100,
      batchSize: 10,
    })
    expect(parsed.connection).toEqual({
      port: '/dev/ttyUSB0',
    })
    expect(parsed.results).toEqual([])
    expect(parsed.summary).toEqual({
      total: 0,
      successful: 0,
      failed: 0,
      totalTimeMs: 0,
      averageTimeMs: 0,
    })
  })

  it('should format successful scan results', () => {
    const results: ScanResult[] = [
      {
        address: 0,
        type: RegisterType.Holding,
        success: true,
        value: Buffer.from([0x12, 0x34]),
        timing: 15,
      },
      {
        address: 1,
        type: RegisterType.Holding,
        success: true,
        value: Buffer.from([0xab, 0xcd]),
        timing: 20,
      },
    ]
    const options: JSONFormatterOptions = {
      type: RegisterType.Holding,
      startAddress: 0,
      endAddress: 100,
      batchSize: 10,
      port: 'localhost:502',
    }

    const output = formatJSON(results, options)
    const parsed = JSON.parse(output)

    expect(parsed.results).toHaveLength(2)
    expect(parsed.results[0]).toEqual({
      address: 0,
      type: 'holding',
      success: true,
      value: '1234',
      timing: 15,
    })
    expect(parsed.results[1]).toEqual({
      address: 1,
      type: 'holding',
      success: true,
      value: 'abcd',
      timing: 20,
    })
    expect(parsed.summary).toEqual({
      total: 2,
      successful: 2,
      failed: 0,
      totalTimeMs: 35,
      averageTimeMs: 17.5,
    })
  })

  it('should format failed scan results with error details', () => {
    const results: ScanResult[] = [
      {
        address: 0,
        type: RegisterType.Input,
        success: false,
        timing: 1000,
        error: 'Timeout waiting for response',
        errorType: 'timeout',
      },
      {
        address: 1,
        type: RegisterType.Input,
        success: false,
        timing: 5,
        error: 'CRC check failed',
        errorType: 'crc',
      },
    ]
    const options: JSONFormatterOptions = {
      type: RegisterType.Input,
      startAddress: 0,
      endAddress: 10,
      batchSize: 5,
      port: '/dev/ttyUSB0',
    }

    const output = formatJSON(results, options)
    const parsed = JSON.parse(output)

    expect(parsed.scan.type).toBe('input')
    expect(parsed.results).toHaveLength(2)
    expect(parsed.results[0]).toEqual({
      address: 0,
      type: 'input',
      success: false,
      value: null,
      timing: 1000,
      error: 'Timeout waiting for response',
      errorType: 'timeout',
    })
    expect(parsed.results[1]).toEqual({
      address: 1,
      type: 'input',
      success: false,
      value: null,
      timing: 5,
      error: 'CRC check failed',
      errorType: 'crc',
    })
    expect(parsed.summary).toEqual({
      total: 2,
      successful: 0,
      failed: 2,
      totalTimeMs: 1005,
      averageTimeMs: 502.5,
    })
  })

  it('should format mixed success and failure results', () => {
    const results: ScanResult[] = [
      {
        address: 0,
        type: RegisterType.Holding,
        success: true,
        value: Buffer.from([0xff, 0xff]),
        timing: 10,
      },
      {
        address: 1,
        type: RegisterType.Holding,
        success: false,
        timing: 1000,
        error: 'Device timeout',
        errorType: 'timeout',
      },
      {
        address: 2,
        type: RegisterType.Holding,
        success: true,
        value: Buffer.from([0x00, 0x00]),
        timing: 12,
      },
    ]
    const options: JSONFormatterOptions = {
      type: RegisterType.Holding,
      startAddress: 0,
      endAddress: 2,
      batchSize: 1,
      port: 'localhost:502',
    }

    const output = formatJSON(results, options)
    const parsed = JSON.parse(output)

    expect(parsed.results).toHaveLength(3)
    expect(parsed.summary).toEqual({
      total: 3,
      successful: 2,
      failed: 1,
      totalTimeMs: 1022,
      averageTimeMs: 340.67,
    })
  })

  it('should use 2-space indentation for readability', () => {
    const results: ScanResult[] = []
    const options: JSONFormatterOptions = {
      type: RegisterType.Holding,
      startAddress: 0,
      endAddress: 10,
      batchSize: 5,
      port: '/dev/ttyUSB0',
    }

    const output = formatJSON(results, options)

    // Check that output contains proper indentation
    expect(output).toContain('  "timestamp"')
    expect(output).toContain('  "scan"')
    expect(output).toContain('    "type"')
  })
})
