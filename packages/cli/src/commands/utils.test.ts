import * as readline from 'readline/promises'

import type { DataPoint } from '@ya-modbus/driver-types'

import { confirm, floatsEqual, isReadable, isWritable, parseValue, validateValue } from './utils.js'

describe('Utils', () => {
  describe('isReadable', () => {
    test('should return true for read-only access', () => {
      const dataPoint: DataPoint = { id: 'test', type: 'integer', access: 'r' }
      expect(isReadable(dataPoint)).toBe(true)
    })

    test('should return true for read-write access', () => {
      const dataPoint: DataPoint = { id: 'test', type: 'integer', access: 'rw' }
      expect(isReadable(dataPoint)).toBe(true)
    })

    test('should return false for write-only access', () => {
      const dataPoint: DataPoint = { id: 'test', type: 'integer', access: 'w' }
      expect(isReadable(dataPoint)).toBe(false)
    })

    test('should default to readable when access is undefined', () => {
      const dataPoint: DataPoint = { id: 'test', type: 'integer' }
      expect(isReadable(dataPoint)).toBe(true)
    })
  })

  describe('isWritable', () => {
    test('should return true for write-only access', () => {
      const dataPoint: DataPoint = { id: 'test', type: 'integer', access: 'w' }
      expect(isWritable(dataPoint)).toBe(true)
    })

    test('should return true for read-write access', () => {
      const dataPoint: DataPoint = { id: 'test', type: 'integer', access: 'rw' }
      expect(isWritable(dataPoint)).toBe(true)
    })

    test('should return false for read-only access', () => {
      const dataPoint: DataPoint = { id: 'test', type: 'integer', access: 'r' }
      expect(isWritable(dataPoint)).toBe(false)
    })

    test('should default to not writable when access is undefined', () => {
      const dataPoint: DataPoint = { id: 'test', type: 'integer' }
      expect(isWritable(dataPoint)).toBe(false)
    })
  })

  describe('floatsEqual', () => {
    test('should return true for exactly equal values', () => {
      expect(floatsEqual(1.0, 1.0)).toBe(true)
      expect(floatsEqual(0.0, 0.0)).toBe(true)
      expect(floatsEqual(-5.5, -5.5)).toBe(true)
    })

    test('should return true for values within relative epsilon', () => {
      expect(floatsEqual(1.0, 1.0000001)).toBe(true)
      expect(floatsEqual(1000.0, 1000.0001)).toBe(true)
    })

    test('should return true for values near zero within absolute epsilon', () => {
      expect(floatsEqual(0.0, 1e-10)).toBe(true)
      expect(floatsEqual(1e-10, 0.0)).toBe(true)
    })

    test('should return false for values beyond tolerance', () => {
      expect(floatsEqual(1.0, 1.001)).toBe(false)
      expect(floatsEqual(100.0, 101.0)).toBe(false)
    })

    test('should handle large values correctly', () => {
      expect(floatsEqual(1e10, 1e10 + 1)).toBe(true) // Within relative epsilon
      expect(floatsEqual(1e10, 1e10 + 100000)).toBe(false) // Beyond tolerance (>1e-6 * 1e10)
    })

    test('should handle negative values', () => {
      expect(floatsEqual(-1.0, -1.0000001)).toBe(true)
      expect(floatsEqual(-100.0, -100.001)).toBe(false)
    })

    test('should respect custom epsilon values', () => {
      expect(floatsEqual(1.0, 1.01, 0.02)).toBe(true) // Higher tolerance
      expect(floatsEqual(1.0, 1.01, 0.001)).toBe(false) // Lower tolerance
    })
  })

  describe('parseValue', () => {
    test('should parse float values', () => {
      const dataPoint: DataPoint = { id: 'test', type: 'float' }
      expect(parseValue('25.5', dataPoint)).toBe(25.5)
      expect(parseValue('-10.2', dataPoint)).toBe(-10.2)
      expect(parseValue('0.0', dataPoint)).toBe(0.0)
    })

    test('should parse integer values', () => {
      const dataPoint: DataPoint = { id: 'test', type: 'integer' }
      expect(parseValue('42', dataPoint)).toBe(42)
      expect(parseValue('-10', dataPoint)).toBe(-10)
      expect(parseValue('0', dataPoint)).toBe(0)
    })

    test('should parse boolean values', () => {
      const dataPoint: DataPoint = { id: 'test', type: 'boolean' }
      expect(parseValue('true', dataPoint)).toBe(true)
      expect(parseValue('True', dataPoint)).toBe(true)
      expect(parseValue('TRUE', dataPoint)).toBe(true)
      expect(parseValue('1', dataPoint)).toBe(true)
      expect(parseValue('false', dataPoint)).toBe(false)
      expect(parseValue('0', dataPoint)).toBe(false)
      expect(parseValue('anything', dataPoint)).toBe(false)
    })

    test('should parse string values', () => {
      const dataPoint: DataPoint = { id: 'test', type: 'string' }
      expect(parseValue('hello', dataPoint)).toBe('hello')
      expect(parseValue('', dataPoint)).toBe('')
      expect(parseValue('123', dataPoint)).toBe('123')
    })

    test('should parse enum values as numbers when possible', () => {
      const dataPoint: DataPoint = { id: 'test', type: 'enum' }
      expect(parseValue('1', dataPoint)).toBe(1)
      expect(parseValue('42', dataPoint)).toBe(42)
      expect(parseValue('0', dataPoint)).toBe(0)
    })

    test('should parse enum values as strings when not numeric', () => {
      const dataPoint: DataPoint = { id: 'test', type: 'enum' }
      expect(parseValue('active', dataPoint)).toBe('active')
      expect(parseValue('OFF', dataPoint)).toBe('OFF')
    })

    test('should handle unknown types by returning string', () => {
      const dataPoint = { id: 'test', type: 'custom' } as DataPoint
      expect(parseValue('test', dataPoint)).toBe('test')
    })
  })

  describe('validateValue', () => {
    describe('numeric validation', () => {
      test('should accept values within range for float', () => {
        const dataPoint: DataPoint = { id: 'test', type: 'float', min: 0, max: 100 }
        expect(() => validateValue(50, dataPoint)).not.toThrow()
        expect(() => validateValue(0, dataPoint)).not.toThrow()
        expect(() => validateValue(100, dataPoint)).not.toThrow()
      })

      test('should reject values below min for float', () => {
        const dataPoint: DataPoint = { id: 'test', type: 'float', min: 0, max: 100 }
        expect(() => validateValue(-1, dataPoint)).toThrow('outside valid range [0, 100]')
      })

      test('should reject values above max for float', () => {
        const dataPoint: DataPoint = { id: 'test', type: 'float', min: 0, max: 100 }
        expect(() => validateValue(101, dataPoint)).toThrow('outside valid range [0, 100]')
      })

      test('should accept values within range for integer', () => {
        const dataPoint: DataPoint = { id: 'test', type: 'integer', min: -10, max: 10 }
        expect(() => validateValue(0, dataPoint)).not.toThrow()
        expect(() => validateValue(-10, dataPoint)).not.toThrow()
        expect(() => validateValue(10, dataPoint)).not.toThrow()
      })

      test('should reject values below min for integer', () => {
        const dataPoint: DataPoint = { id: 'test', type: 'integer', min: -10, max: 10 }
        expect(() => validateValue(-11, dataPoint)).toThrow('outside valid range [-10, 10]')
      })

      test('should reject values above max for integer', () => {
        const dataPoint: DataPoint = { id: 'test', type: 'integer', min: -10, max: 10 }
        expect(() => validateValue(11, dataPoint)).toThrow('outside valid range [-10, 10]')
      })

      test('should handle min-only validation', () => {
        const dataPoint: DataPoint = { id: 'test', type: 'float', min: 0 }
        expect(() => validateValue(100, dataPoint)).not.toThrow()
        expect(() => validateValue(0, dataPoint)).not.toThrow()
        expect(() => validateValue(-1, dataPoint)).toThrow('outside valid range [0, ∞]')
      })

      test('should handle max-only validation', () => {
        const dataPoint: DataPoint = { id: 'test', type: 'float', max: 100 }
        expect(() => validateValue(50, dataPoint)).not.toThrow()
        expect(() => validateValue(100, dataPoint)).not.toThrow()
        expect(() => validateValue(101, dataPoint)).toThrow('outside valid range [-∞, 100]')
      })

      test('should skip validation when no min/max defined', () => {
        const dataPoint: DataPoint = { id: 'test', type: 'float' }
        expect(() => validateValue(999999, dataPoint)).not.toThrow()
        expect(() => validateValue(-999999, dataPoint)).not.toThrow()
      })
    })

    describe('enum validation', () => {
      test('should accept valid enum values', () => {
        const dataPoint: DataPoint = {
          id: 'test',
          type: 'enum',
          enumValues: { '0': 'Off', '1': 'On', '2': 'Auto' },
        }
        expect(() => validateValue('0', dataPoint)).not.toThrow()
        expect(() => validateValue('1', dataPoint)).not.toThrow()
        expect(() => validateValue('2', dataPoint)).not.toThrow()
      })

      test('should reject invalid enum values', () => {
        const dataPoint: DataPoint = {
          id: 'test',
          type: 'enum',
          enumValues: { '0': 'Off', '1': 'On' },
        }
        expect(() => validateValue('3', dataPoint)).toThrow(
          'Invalid enum value: 3. Valid values: 0, 1'
        )
        expect(() => validateValue('invalid', dataPoint)).toThrow(
          'Invalid enum value: invalid. Valid values: 0, 1'
        )
      })

      test('should skip validation when no enumValues defined', () => {
        const dataPoint: DataPoint = { id: 'test', type: 'enum' }
        expect(() => validateValue('anything', dataPoint)).not.toThrow()
      })
    })

    describe('non-validated types', () => {
      test('should not validate string values', () => {
        const dataPoint: DataPoint = { id: 'test', type: 'string' }
        expect(() => validateValue('any string', dataPoint)).not.toThrow()
      })

      test('should not validate boolean values', () => {
        const dataPoint: DataPoint = { id: 'test', type: 'boolean' }
        expect(() => validateValue(true, dataPoint)).not.toThrow()
        expect(() => validateValue(false, dataPoint)).not.toThrow()
      })
    })
  })

  describe('confirm', () => {
    let mockQuestion: jest.Mock
    let mockClose: jest.Mock

    beforeEach(() => {
      mockQuestion = jest.fn()
      mockClose = jest.fn()

      // Mock readline.createInterface
      jest.spyOn(readline, 'createInterface').mockReturnValue({
        question: mockQuestion,
        close: mockClose,
      } as never)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    test('should return true when user enters "y"', async () => {
      mockQuestion.mockResolvedValue('y')
      const result = await confirm('Proceed?')
      expect(result).toBe(true)
      expect(mockQuestion).toHaveBeenCalledWith('Proceed? (y/N): ')
      expect(mockClose).toHaveBeenCalled()
    })

    test('should return true when user enters "Y"', async () => {
      mockQuestion.mockResolvedValue('Y')
      const result = await confirm('Proceed?')
      expect(result).toBe(true)
    })

    test('should return false when user enters "n"', async () => {
      mockQuestion.mockResolvedValue('n')
      const result = await confirm('Proceed?')
      expect(result).toBe(false)
    })

    test('should return false when user enters "N"', async () => {
      mockQuestion.mockResolvedValue('N')
      const result = await confirm('Proceed?')
      expect(result).toBe(false)
    })

    test('should return false for empty input', async () => {
      mockQuestion.mockResolvedValue('')
      const result = await confirm('Proceed?')
      expect(result).toBe(false)
    })

    test('should return false for any other input', async () => {
      mockQuestion.mockResolvedValue('maybe')
      const result = await confirm('Proceed?')
      expect(result).toBe(false)
    })

    test('should close readline interface even if error occurs', async () => {
      mockQuestion.mockRejectedValue(new Error('Test error'))
      await expect(confirm('Proceed?')).rejects.toThrow('Test error')
      expect(mockClose).toHaveBeenCalled()
    })
  })
})
