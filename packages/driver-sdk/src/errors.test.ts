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

  it('should format range error with actual value (integer)', () => {
    const error = formatRangeError('device address', 256, 1, 247)
    expect(error).toBe('Invalid device address: received 256, must be between 1 and 247')
  })

  it('should format range error with actual value (decimal)', () => {
    const error = formatRangeError('temperature', 55.5, -20.0, 50.0)
    expect(error).toBe('Invalid temperature: received 55.5, must be between -20 and 50')
  })

  it('should format range error with actual value (string)', () => {
    const error = formatRangeError('port', 'invalid', 1, 65535)
    expect(error).toBe('Invalid port: received invalid, must be between 1 and 65535')
  })

  it('should format range error with actual value (null)', () => {
    const error = formatRangeError('count', null, 0, 100)
    expect(error).toBe('Invalid count: received null, must be between 0 and 100')
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

  it('should format enum error with actual value (number)', () => {
    const error = formatEnumError('baud rate', 115200, [9600, 14400, 19200])
    expect(error).toBe('Invalid baud rate: received 115200, must be one of 9600, 14400, 19200')
  })

  it('should format enum error with actual value (string)', () => {
    const error = formatEnumError('parity', 'mark', ['none', 'even', 'odd'])
    expect(error).toBe('Invalid parity: received mark, must be one of none, even, odd')
  })

  it('should format enum error with actual value (null)', () => {
    const error = formatEnumError('mode', null, ['auto', 'manual'])
    expect(error).toBe('Invalid mode: received null, must be one of auto, manual')
  })

  it('should format enum error with actual value (object)', () => {
    const error = formatEnumError('type', { invalid: true }, [1, 2, 3])
    expect(error).toBe('Invalid type: received [object Object], must be one of 1, 2, 3')
  })
})
