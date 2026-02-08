import { parseIdRange } from './parse-id-range.js'

describe('parseIdRange', () => {
  test.each([
    ['single ID', '1', [1]],
    ['multiple IDs', '1,2,3', [1, 2, 3]],
    ['simple range', '3-5', [3, 4, 5]],
    ['mixed IDs and ranges', '1,2,5-7', [1, 2, 5, 6, 7]],
    ['complex mixed', '1,3-5,7,10-12', [1, 3, 4, 5, 7, 10, 11, 12]],
  ])('%s: parseIdRange(%s) should return %j', (_, input, expected) => {
    expect(parseIdRange(input)).toEqual(expected)
  })

  test('should deduplicate IDs', () => {
    expect(parseIdRange('1,1,2,2,3')).toEqual([1, 2, 3])
  })

  test('should deduplicate overlapping ranges', () => {
    expect(parseIdRange('1-3,2-4')).toEqual([1, 2, 3, 4])
  })

  test('should sort IDs in ascending order', () => {
    expect(parseIdRange('5,1,3,2,4')).toEqual([1, 2, 3, 4, 5])
  })

  test('should handle ranges in any order', () => {
    expect(parseIdRange('10-12,1-3,5-7')).toEqual([1, 2, 3, 5, 6, 7, 10, 11, 12])
  })

  test('should handle single-element range', () => {
    expect(parseIdRange('5-5')).toEqual([5])
  })

  test('should handle spaces around commas', () => {
    expect(parseIdRange('1, 2, 3')).toEqual([1, 2, 3])
  })

  test('should handle spaces in ranges', () => {
    expect(parseIdRange('1 - 3')).toEqual([1, 2, 3])
  })

  test.each([
    ['ID too low', '0,1,2'],
    ['ID too high', '1,248,2'],
    ['range start too low', '0-2'],
    ['range end too high', '245-248'],
  ])('should throw error for invalid Modbus address: %s', (_, input) => {
    expect(() => parseIdRange(input)).toThrow(/valid Modbus slave address/)
  })

  test.each([
    ['non-numeric ID', 'abc'],
    ['non-numeric in list', '1,abc,3'],
    ['invalid range format', '1-2-3'],
    ['range with non-numeric', 'a-b'],
  ])('should throw error for invalid format: %s', (_, input) => {
    expect(() => parseIdRange(input)).toThrow(/invalid/i)
  })

  test('should throw error for reversed range', () => {
    expect(() => parseIdRange('5-3')).toThrow(/start.*end/i)
  })

  test('should throw error for empty string', () => {
    expect(() => parseIdRange('')).toThrow(/empty string/i)
  })

  test('should throw error for whitespace-only string', () => {
    expect(() => parseIdRange('  ')).toThrow(/empty string/i)
  })
})
