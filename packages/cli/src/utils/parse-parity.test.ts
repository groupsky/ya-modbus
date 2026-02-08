import { parseParity } from './parse-parity.js'

describe('parseParity', () => {
  test.each([
    ['single parity', 'none', ['none']],
    ['single parity (even)', 'even', ['even']],
    ['single parity (odd)', 'odd', ['odd']],
    ['multiple parities', 'none,even', ['none', 'even']],
    ['all parities', 'none,even,odd', ['none', 'even', 'odd']],
    ['parities in different order', 'odd,none,even', ['none', 'even', 'odd']],
  ])('%s: parseParity(%s) should return %j', (_, input, expected) => {
    expect(parseParity(input)).toEqual(expected)
  })

  test('should deduplicate parities', () => {
    expect(parseParity('none,none,even,even')).toEqual(['none', 'even'])
  })

  test('should preserve standard order (none, even, odd)', () => {
    expect(parseParity('odd,even,none')).toEqual(['none', 'even', 'odd'])
  })

  test('should handle spaces around commas', () => {
    expect(parseParity('none, even, odd')).toEqual(['none', 'even', 'odd'])
  })

  test('should handle mixed case', () => {
    expect(parseParity('NONE,Even,ODD')).toEqual(['none', 'even', 'odd'])
  })

  test.each([
    ['invalid parity value', 'invalid'],
    ['invalid in list', 'none,invalid,even'],
    ['empty part in list', 'none,,even'],
    ['typo', 'evn'],
    ['number', '1'],
  ])('should throw error for invalid parity: %s', (_, input) => {
    expect(() => parseParity(input)).toThrow(/invalid parity/i)
  })

  test('should throw error for empty string', () => {
    expect(() => parseParity('')).toThrow(/empty string/i)
  })

  test('should throw error for whitespace-only string', () => {
    expect(() => parseParity('  ')).toThrow(/empty string/i)
  })
})
