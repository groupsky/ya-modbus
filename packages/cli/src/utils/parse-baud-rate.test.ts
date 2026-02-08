import { parseBaudRate } from './parse-baud-rate.js'

describe('parseBaudRate', () => {
  test.each([
    ['single baud rate', '9600', [9600]],
    ['single baud rate (19200)', '19200', [19200]],
    ['multiple baud rates', '9600,19200', [9600, 19200]],
    ['multiple rates unsorted', '19200,9600', [9600, 19200]],
    ['simple range', '9600-19200', [9600, 14400, 19200]],
    ['range with intermediate values', '2400-9600', [2400, 4800, 9600]],
    ['mixed rates and ranges', '2400,9600-19200', [2400, 9600, 14400, 19200]],
    ['complex mixed', '2400,9600-19200,57600', [2400, 9600, 14400, 19200, 57600]],
    [
      'all standard rates',
      '2400,4800,9600,14400,19200,38400,57600,115200',
      [2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200],
    ],
  ])('%s: parseBaudRate(%s) should return %j', (_, input, expected) => {
    expect(parseBaudRate(input)).toEqual(expected)
  })

  test('should deduplicate baud rates', () => {
    expect(parseBaudRate('9600,9600,19200,19200')).toEqual([9600, 19200])
  })

  test('should deduplicate overlapping ranges', () => {
    expect(parseBaudRate('9600-19200,14400-38400')).toEqual([9600, 14400, 19200, 38400])
  })

  test('should sort baud rates in ascending order', () => {
    expect(parseBaudRate('115200,9600,38400,19200')).toEqual([9600, 19200, 38400, 115200])
  })

  test('should handle single-element range', () => {
    expect(parseBaudRate('9600-9600')).toEqual([9600])
  })

  test('should handle spaces around commas', () => {
    expect(parseBaudRate('9600, 19200, 38400')).toEqual([9600, 19200, 38400])
  })

  test('should handle spaces in ranges', () => {
    expect(parseBaudRate('9600 - 19200')).toEqual([9600, 14400, 19200])
  })

  test('should skip empty parts in comma-separated list', () => {
    expect(parseBaudRate('9600,,19200')).toEqual([9600, 19200])
  })

  test.each([
    ['invalid baud rate', '1200'],
    ['invalid in list', '9600,1200,19200'],
    ['invalid range start', '1200-9600'],
    ['invalid range end', '9600-10000'],
    ['both invalid in range', '1200-10000'],
  ])('should throw error for unsupported baud rate: %s', (_, input) => {
    expect(() => parseBaudRate(input)).toThrow(/unsupported baud rate/i)
  })

  test.each([
    ['non-numeric', 'abc'],
    ['non-numeric in list', '9600,abc,19200'],
    ['invalid range format', '9600-19200-38400'],
    ['range with non-numeric', 'a-b'],
    ['decimal', '9600.5'],
    ['decimal in list', '9600,19200.5'],
    ['decimal range start', '9600.5-19200'],
    ['decimal range end', '9600-19200.5'],
  ])('should throw error for invalid format: %s', (_, input) => {
    expect(() => parseBaudRate(input)).toThrow(/invalid/i)
  })

  test('should throw error for reversed range', () => {
    expect(() => parseBaudRate('19200-9600')).toThrow(/start.*end/i)
  })

  test('should throw error for empty string', () => {
    expect(() => parseBaudRate('')).toThrow(/empty string/i)
  })

  test('should throw error for whitespace-only string', () => {
    expect(() => parseBaudRate('  ')).toThrow(/empty string/i)
  })

  test('should handle range with only endpoints', () => {
    expect(parseBaudRate('9600-14400')).toEqual([9600, 14400])
  })
})
