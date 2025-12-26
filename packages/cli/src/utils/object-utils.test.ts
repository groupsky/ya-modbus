import { omitUndefined } from './object-utils.js'

describe('omitUndefined', () => {
  test('should remove undefined properties', () => {
    const obj = {
      a: 1,
      b: undefined,
      c: 'hello',
      d: undefined,
      e: 0,
    }

    const result = omitUndefined(obj)

    expect(result).toEqual({
      a: 1,
      c: 'hello',
      e: 0,
    })
  })

  test('should preserve null values', () => {
    const obj = {
      a: 1,
      b: null,
      c: undefined,
    }

    const result = omitUndefined(obj)

    expect(result).toEqual({
      a: 1,
      b: null,
    })
  })

  test('should preserve false and 0', () => {
    const obj = {
      a: false,
      b: 0,
      c: '',
      d: undefined,
    }

    const result = omitUndefined(obj)

    expect(result).toEqual({
      a: false,
      b: 0,
      c: '',
    })
  })

  test('should handle empty objects', () => {
    const obj = {}

    const result = omitUndefined(obj)

    expect(result).toEqual({})
  })

  test('should handle objects with all undefined values', () => {
    const obj = {
      a: undefined,
      b: undefined,
    }

    const result = omitUndefined(obj)

    expect(result).toEqual({})
  })

  test('should not modify original object', () => {
    const obj = {
      a: 1,
      b: undefined,
      c: 'hello',
    }

    const original = { ...obj }
    const result = omitUndefined(obj)

    expect(obj).toEqual(original)
    expect(result).not.toBe(obj)
  })
})
