/**
 * Tests for error formatting utilities
 */

import { formatRangeError, formatEnumError } from './errors'

describe('formatRangeError', () => {
  it('should format range error with integer bounds', () => {
    const error = formatRangeError('device address', 1, 247)
    expect(error).toBe('Invalid device address: must be between 1 and 247')
  })

  it('should format range error with decimal bounds', () => {
    const error = formatRangeError('temperature correction', -10.0, 10.0)
    expect(error).toBe('Invalid temperature correction: must be between -10 and 10')
  })

  it('should handle negative ranges', () => {
    const error = formatRangeError('offset', -100, -50)
    expect(error).toBe('Invalid offset: must be between -100 and -50')
  })

  it('should handle zero in range', () => {
    const error = formatRangeError('value', 0, 100)
    expect(error).toBe('Invalid value: must be between 0 and 100')
  })
})

describe('formatEnumError', () => {
  it('should format enum error with number values', () => {
    const error = formatEnumError('baud rate', [9600, 14400, 19200])
    expect(error).toBe('Invalid baud rate: must be one of 9600, 14400, 19200')
  })

  it('should format enum error with string values', () => {
    const error = formatEnumError('parity', ['none', 'even', 'odd'])
    expect(error).toBe('Invalid parity: must be one of none, even, odd')
  })

  it('should handle single value', () => {
    const error = formatEnumError('mode', ['auto'])
    expect(error).toBe('Invalid mode: must be one of auto')
  })

  it('should handle mixed types', () => {
    const error = formatEnumError('option', [1, 'two', 3])
    expect(error).toBe('Invalid option: must be one of 1, two, 3')
  })

  it('should handle empty array', () => {
    const error = formatEnumError('value', [])
    expect(error).toBe('Invalid value: must be one of ')
  })
})
