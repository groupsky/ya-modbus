import { InvalidArgumentError } from 'commander'

import { parseWholeNumberOption } from './parse-whole-number-option.js'

describe('parseWholeNumberOption', () => {
  test.each([
    ['0', 0],
    ['1', 1],
    ['9600', 9600],
    [' 500 ', 500],
  ])('accepts %p', (value, expected) => {
    expect(parseWholeNumberOption(value)).toBe(expected)
  })

  test.each(['1.5', '2.0', '1.5s', '100ms', '96OO', 'abc', '', '-1', '1e3', '0x10'])(
    'rejects %p',
    (value) => {
      expect(() => parseWholeNumberOption(value)).toThrow(InvalidArgumentError)
      expect(() => parseWholeNumberOption(value)).toThrow('Expected a whole number')
    }
  )
})
