/**
 * Tests for YAML formatter
 */

import yaml from 'js-yaml'

import { ErrorType } from './error-classifier.js'
import { formatJSON } from './json-formatter.js'
import { RegisterType } from './read-tester.js'
import type { ScanResult } from './register-scanner.js'
import { formatYAML, type YAMLFormatterOptions } from './yaml-formatter.js'

const options: YAMLFormatterOptions = {
  type: RegisterType.Holding,
  startAddress: 0,
  endAddress: 2,
  batchSize: 10,
  port: 'localhost:502',
}

const mixedResults: ScanResult[] = [
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
    success: false,
    timing: 1000,
    error: 'Timeout waiting for response',
    errorType: ErrorType.Timeout,
  },
  {
    address: 2,
    type: RegisterType.Holding,
    success: true,
    value: Buffer.from([0xff, 0xff]),
    timing: 12.5,
  },
]

describe('formatYAML', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-02-13T18:17:41.367Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should describe the scan with the same data as the JSON output', () => {
    const parsed = yaml.load(formatYAML(mixedResults, options))

    expect(parsed).toEqual(JSON.parse(formatJSON(mixedResults, options)))
    expect(parsed).toMatchObject({
      timestamp: '2026-02-13T18:17:41.367Z',
      scan: { type: 'holding', startAddress: 0, endAddress: 2, batchSize: 10 },
      connection: { port: 'localhost:502' },
      summary: { total: 3, successful: 2, failed: 1 },
    })
  })

  it('should format empty results', () => {
    const parsed = yaml.load(formatYAML([], options))

    expect(parsed).toMatchObject({
      results: [],
      summary: { total: 0, successful: 0, failed: 0, totalTimeMs: 0, averageTimeMs: 0 },
    })
  })

  it('should write block style with 2-space indentation', () => {
    const output = formatYAML(mixedResults.slice(0, 1), options)

    expect(output).toContain('scan:\n  type: holding\n  startAddress: 0\n')
    expect(output).toContain('results:\n  - address: 0\n    type: holding\n')
  })

  it('should not end with a newline, like formatJSON', () => {
    expect(formatYAML(mixedResults, options)).not.toMatch(/\n$/)
  })

  it('should keep a long error message on one line', () => {
    const error = `Timeout waiting for response ${'from the device '.repeat(20)}`.trim()
    const results: ScanResult[] = [
      {
        address: 0,
        type: RegisterType.Holding,
        success: false,
        timing: 1000,
        error,
        errorType: ErrorType.Timeout,
      },
    ]

    const output = formatYAML(results, options)

    expect(output).toContain(`error: ${error}\n`)
  })

  it.each([
    { name: 'a colon followed by a space', error: 'Timeout: waiting for response' },
    { name: 'a hash', error: 'value # not a comment' },
    { name: 'a quote', error: "device didn't answer" },
    { name: 'a line break', error: 'first line\nsecond line' },
    { name: 'a leading dash', error: '- not a list item' },
  ])('should keep an error message with $name as text', ({ error }) => {
    const results: ScanResult[] = [
      {
        address: 0,
        type: RegisterType.Holding,
        success: false,
        timing: 5,
        error,
        errorType: ErrorType.Unknown,
      },
    ]

    const parsed = yaml.load(formatYAML(results, options)) as { results: Array<{ error: string }> }

    expect(parsed.results[0]?.error).toBe(error)
  })

  it.each(['yes', 'no', 'on', 'off', 'true', 'null', '12345'])(
    'should quote the error message "%s" so that no YAML reader takes it for another type',
    (error) => {
      const results: ScanResult[] = [
        {
          address: 0,
          type: RegisterType.Holding,
          success: false,
          timing: 5,
          error,
          errorType: ErrorType.Unknown,
        },
      ]

      expect(formatYAML(results, options)).toContain(`error: '${error}'`)
    }
  )

  it.each(['', '/dev/ttyUSB0', 'localhost:502', '192.168.1.10:502', 'COM3'])(
    'should keep the port "%s" as text',
    (port) => {
      const parsed = yaml.load(formatYAML([], { ...options, port })) as {
        connection: { port: string }
      }

      expect(parsed.connection.port).toBe(port)
    }
  )
})
