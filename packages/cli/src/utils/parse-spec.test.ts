import { parseSpec } from './parse-spec.js'

describe('parseSpec', () => {
  // Simple number parser for testing
  const numberOptions = {
    label: 'number',
    formatExamples: ['"1,2,3"'],
    parseSingle: (value: string, context: string) => {
      const num = parseInt(value, 10)
      if (isNaN(num)) throw new Error(`Invalid number: "${context}"`)
      return num
    },
    sortItems: (items: number[]) => items.sort((a, b) => a - b),
  }

  describe('basic parsing', () => {
    test('parses single value', () => {
      expect(parseSpec({ ...numberOptions, spec: '5' })).toEqual([5])
    })

    test('parses multiple values', () => {
      expect(parseSpec({ ...numberOptions, spec: '1,2,3' })).toEqual([1, 2, 3])
    })

    test('deduplicates values', () => {
      expect(parseSpec({ ...numberOptions, spec: '1,2,2,3,3' })).toEqual([1, 2, 3])
    })

    test('sorts values', () => {
      expect(parseSpec({ ...numberOptions, spec: '3,1,2' })).toEqual([1, 2, 3])
    })

    test('handles spaces around commas', () => {
      expect(parseSpec({ ...numberOptions, spec: '1, 2, 3' })).toEqual([1, 2, 3])
    })

    test('handles spaces in values', () => {
      expect(parseSpec({ ...numberOptions, spec: ' 1 , 2 , 3 ' })).toEqual([1, 2, 3])
    })
  })

  describe('range parsing', () => {
    const rangeOptions = {
      ...numberOptions,
      formatExamples: ['"1,2,3"', '"1-5"'],
      parseRange: (start: string, end: string, context: string) => {
        const startNum = parseInt(start, 10)
        const endNum = parseInt(end, 10)
        if (isNaN(startNum) || isNaN(endNum)) {
          throw new Error(`Invalid range: "${context}"`)
        }
        if (startNum > endNum) {
          throw new Error(`Invalid range: "${context}". Start must be less than or equal to end`)
        }
        return Array.from({ length: endNum - startNum + 1 }, (_, i) => startNum + i)
      },
    }

    test('parses simple range', () => {
      expect(parseSpec({ ...rangeOptions, spec: '1-3' })).toEqual([1, 2, 3])
    })

    test('parses single-element range', () => {
      expect(parseSpec({ ...rangeOptions, spec: '5-5' })).toEqual([5])
    })

    test('parses mixed values and ranges', () => {
      expect(parseSpec({ ...rangeOptions, spec: '1,3-5,7' })).toEqual([1, 3, 4, 5, 7])
    })

    test('deduplicates overlapping ranges', () => {
      expect(parseSpec({ ...rangeOptions, spec: '1-3,2-4' })).toEqual([1, 2, 3, 4])
    })

    test('handles spaces in ranges', () => {
      expect(parseSpec({ ...rangeOptions, spec: '1 - 3' })).toEqual([1, 2, 3])
    })

    test('throws error for invalid range format', () => {
      expect(() => parseSpec({ ...rangeOptions, spec: '1-2-3' })).toThrow(/invalid range format/i)
    })

    test('throws error for reversed range', () => {
      expect(() => parseSpec({ ...rangeOptions, spec: '5-3' })).toThrow(/start.*end/i)
    })
  })

  describe('empty value handling', () => {
    test('throws error for empty string', () => {
      expect(() => parseSpec({ ...numberOptions, spec: '' })).toThrow(/empty string/i)
    })

    test('throws error for whitespace-only string', () => {
      expect(() => parseSpec({ ...numberOptions, spec: '  ' })).toThrow(/empty string/i)
    })

    test('throws error for empty part by default', () => {
      expect(() => parseSpec({ ...numberOptions, spec: '1,,3' })).toThrow(/empty value/i)
    })

    test('skips empty parts when skipEmptyParts=true', () => {
      expect(parseSpec({ ...numberOptions, spec: '1,,3', skipEmptyParts: true })).toEqual([1, 3])
    })
  })

  describe('error handling', () => {
    test('propagates parseSingle errors', () => {
      expect(() => parseSpec({ ...numberOptions, spec: 'abc' })).toThrow(/invalid number/i)
    })

    test('propagates parseRange errors', () => {
      const rangeOptions = {
        ...numberOptions,
        formatExamples: ['"1-5"'],
        parseRange: () => {
          throw new Error('Range error')
        },
      }
      expect(() => parseSpec({ ...rangeOptions, spec: '1-3' })).toThrow(/range error/i)
    })

    test('includes format examples in error message', () => {
      expect(() => parseSpec({ ...numberOptions, spec: '' })).toThrow(/"1,2,3"/)
    })
  })

  describe('custom sorting', () => {
    test('uses custom sort function', () => {
      const reverseOptions = {
        ...numberOptions,
        sortItems: (items: number[]) => items.sort((a, b) => b - a), // Descending
      }
      expect(parseSpec({ ...reverseOptions, spec: '1,2,3' })).toEqual([3, 2, 1])
    })
  })
})
