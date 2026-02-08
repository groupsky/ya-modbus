import { parseInteger } from './parse-integer.js'

describe('parseInteger', () => {
  test('parses valid integer', () => {
    expect(parseInteger('123', '123', 'ID')).toBe(123)
  })

  test('parses zero', () => {
    expect(parseInteger('0', '0', 'ID')).toBe(0)
  })

  test('parses negative number', () => {
    expect(parseInteger('-5', '-5', 'ID')).toBe(-5)
  })

  test('throws error for decimal number', () => {
    expect(() => parseInteger('12.5', '12.5', 'ID')).toThrow(/decimal numbers not allowed/i)
  })

  test('throws error for non-numeric string', () => {
    expect(() => parseInteger('abc', 'abc', 'ID')).toThrow(/expected a number/i)
  })

  test('includes context in error message', () => {
    expect(() => parseInteger('abc', '1,abc,3', 'ID')).toThrow(/1,abc,3/)
  })

  test('includes label in error message', () => {
    expect(() => parseInteger('12.5', '12.5', 'baud rate')).toThrow(/baud rate/)
  })
})
