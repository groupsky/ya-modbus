import { mergeSpecs } from './merge-specs.js'

describe('mergeSpecs', () => {
  // Simple parser for testing
  const parseNumbers = (spec: string): number[] => {
    return spec.split(',').map((s) => parseInt(s.trim(), 10))
  }

  const sortAscending = (items: number[]): number[] => items.sort((a, b) => a - b)

  describe('basic merging', () => {
    test('returns undefined for undefined input', () => {
      expect(mergeSpecs(undefined, parseNumbers)).toBeUndefined()
    })

    test('handles single string spec', () => {
      expect(mergeSpecs('1,2,3', parseNumbers, sortAscending)).toEqual([1, 2, 3])
    })

    test('handles array of single spec', () => {
      expect(mergeSpecs(['1,2,3'], parseNumbers, sortAscending)).toEqual([1, 2, 3])
    })

    test('merges multiple specs', () => {
      expect(mergeSpecs(['1,2', '3,4'], parseNumbers, sortAscending)).toEqual([1, 2, 3, 4])
    })

    test('deduplicates across specs', () => {
      expect(mergeSpecs(['1,2,3', '2,3,4'], parseNumbers, sortAscending)).toEqual([1, 2, 3, 4])
    })

    test('works without sorter', () => {
      const result = mergeSpecs(['1,2', '3,4'], parseNumbers)
      expect(result).toBeDefined()
      expect(result?.sort((a, b) => a - b)).toEqual([1, 2, 3, 4])
    })
  })

  describe('sorting', () => {
    test('applies custom sorter', () => {
      const sortDescending = (items: number[]): number[] => items.sort((a, b) => b - a)
      expect(mergeSpecs(['3,1', '2,4'], parseNumbers, sortDescending)).toEqual([4, 3, 2, 1])
    })

    test('respects custom ordering', () => {
      const parseLetters = (spec: string): string[] => spec.split(',')
      const sortVowelsFirst = (items: string[]): string[] => {
        const vowels = 'aeiou'
        return items.sort((a, b) => {
          const aIsVowel = vowels.includes(a.toLowerCase())
          const bIsVowel = vowels.includes(b.toLowerCase())
          if (aIsVowel && !bIsVowel) return -1
          if (!aIsVowel && bIsVowel) return 1
          return a.localeCompare(b)
        })
      }
      expect(mergeSpecs(['b,a', 'c,e'], parseLetters, sortVowelsFirst)).toEqual([
        'a',
        'e',
        'b',
        'c',
      ])
    })
  })

  describe('complex scenarios', () => {
    test('handles many specs', () => {
      const specs = ['1,2', '3,4', '5,6', '7,8', '9,10']
      expect(mergeSpecs(specs, parseNumbers, sortAscending)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      ])
    })

    test('handles heavy duplication', () => {
      const specs = ['1,1,1', '2,2,2', '1,2,3']
      expect(mergeSpecs(specs, parseNumbers, sortAscending)).toEqual([1, 2, 3])
    })

    test('handles parser returning ranges', () => {
      const parseRange = (spec: string): number[] => {
        const [start, end] = spec.split('-').map((s) => parseInt(s, 10))
        return Array.from({ length: end - start + 1 }, (_, i) => start + i)
      }
      expect(mergeSpecs(['1-3', '5-7'], parseRange, sortAscending)).toEqual([1, 2, 3, 5, 6, 7])
    })

    test('handles overlapping ranges', () => {
      const parseRange = (spec: string): number[] => {
        const [start, end] = spec.split('-').map((s) => parseInt(s, 10))
        return Array.from({ length: end - start + 1 }, (_, i) => start + i)
      }
      expect(mergeSpecs(['1-5', '3-7'], parseRange, sortAscending)).toEqual([1, 2, 3, 4, 5, 6, 7])
    })
  })

  describe('type safety', () => {
    test('works with string types', () => {
      const parseWords = (spec: string): string[] => spec.split(',')
      expect(mergeSpecs(['a,b', 'c,d'], parseWords, (items) => items.sort())).toEqual([
        'a',
        'b',
        'c',
        'd',
      ])
    })

    test('works with object types', () => {
      interface Item {
        id: number
        name: string
      }
      const parseItems = (spec: string): Item[] => {
        return spec.split(',').map((s) => {
          const [id, name] = s.split(':')
          return { id: parseInt(id, 10), name }
        })
      }
      const sortById = (items: Item[]): Item[] => items.sort((a, b) => a.id - b.id)
      const result = mergeSpecs(['1:a,2:b', '3:c'], parseItems, sortById)
      expect(result).toEqual([
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 3, name: 'c' },
      ])
    })
  })
})
