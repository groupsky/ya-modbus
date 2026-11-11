import { describe, it, expect } from '@jest/globals'
import { InvalidArgumentError } from 'commander'

import { parseWholeNumberOption } from './parse-whole-number-option.js'

describe('parseWholeNumberOption', () => {
  it.each([
    ['0', 0],
    ['15', 15],
    [' 5000 ', 5000],
  ])('parses %j as %i', (value, expected) => {
    expect(parseWholeNumberOption(value)).toBe(expected)
  })

  it.each(['', 'abc', '1.5', '-1', '100ms', '1e3'])('rejects %j', (value) => {
    expect(() => parseWholeNumberOption(value)).toThrow(InvalidArgumentError)
  })
})
