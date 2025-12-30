/**
 * Tests for validation utilities
 */

import { createEnumValidator, createRangeValidator, isValidInteger } from './validators'

describe('createEnumValidator', () => {
  it('should validate valid enum values', () => {
    const validator = createEnumValidator([9600, 14400, 19200] as const)
    expect(validator(9600)).toBe(true)
    expect(validator(14400)).toBe(true)
    expect(validator(19200)).toBe(true)
  })

  it('should reject invalid enum values', () => {
    const validator = createEnumValidator([9600, 14400, 19200] as const)
    expect(validator(4800)).toBe(false)
    expect(validator(38400)).toBe(false)
  })

  it('should reject non-number types for number enum', () => {
    const validator = createEnumValidator([9600, 14400, 19200] as const)
    expect(validator('9600')).toBe(false)
    expect(validator(null)).toBe(false)
    expect(validator(undefined)).toBe(false)
  })

  it('should work with string enums', () => {
    const validator = createEnumValidator(['none', 'even', 'odd'] as const)
    expect(validator('none')).toBe(true)
    expect(validator('even')).toBe(true)
    expect(validator('odd')).toBe(true)
    expect(validator('mark')).toBe(false)
  })

  it('should narrow types correctly', () => {
    type ValidBaudRate = 9600 | 14400 | 19200
    const validator = createEnumValidator([9600, 14400, 19200] as const)

    const value: unknown = 9600
    expect(validator(value)).toBe(true)

    // Type narrowing verification happens at compile-time
    // This test verifies the type guard works correctly
    const narrowedFn = (val: unknown): ValidBaudRate | null => {
      if (validator(val)) {
        // TypeScript should recognize val as ValidBaudRate here
        const typed: ValidBaudRate = val
        return typed
      }
      return null
    }

    expect(narrowedFn(9600)).toBe(9600)
  })
})

describe('createRangeValidator', () => {
  it('should validate values within range', () => {
    const validator = createRangeValidator(1, 247)
    expect(validator(1)).toBe(true)
    expect(validator(100)).toBe(true)
    expect(validator(247)).toBe(true)
  })

  it('should reject values outside range', () => {
    const validator = createRangeValidator(1, 247)
    expect(validator(0)).toBe(false)
    expect(validator(248)).toBe(false)
    expect(validator(-1)).toBe(false)
    expect(validator(1000)).toBe(false)
  })

  it('should reject non-finite numbers', () => {
    const validator = createRangeValidator(1, 247)
    expect(validator(NaN)).toBe(false)
    expect(validator(Infinity)).toBe(false)
    expect(validator(-Infinity)).toBe(false)
  })

  it('should reject non-number types', () => {
    const validator = createRangeValidator(1, 247)
    expect(validator('100')).toBe(false)
    expect(validator(null)).toBe(false)
    expect(validator(undefined)).toBe(false)
  })

  it('should work with decimal ranges', () => {
    const validator = createRangeValidator(-10.0, 10.0)
    expect(validator(-10.0)).toBe(true)
    expect(validator(0)).toBe(true)
    expect(validator(5.5)).toBe(true)
    expect(validator(10.0)).toBe(true)
    expect(validator(-10.1)).toBe(false)
    expect(validator(10.1)).toBe(false)
  })

  it('should handle negative ranges', () => {
    const validator = createRangeValidator(-100, -50)
    expect(validator(-100)).toBe(true)
    expect(validator(-75)).toBe(true)
    expect(validator(-50)).toBe(true)
    expect(validator(-49)).toBe(false)
    expect(validator(-101)).toBe(false)
  })
})

describe('isValidInteger', () => {
  it('should validate integer values', () => {
    expect(isValidInteger(1)).toBe(true)
    expect(isValidInteger(100)).toBe(true)
    expect(isValidInteger(-50)).toBe(true)
    expect(isValidInteger(0)).toBe(true)
  })

  it('should reject decimal values', () => {
    expect(isValidInteger(1.5)).toBe(false)
    expect(isValidInteger(100.1)).toBe(false)
    expect(isValidInteger(-50.9)).toBe(false)
  })

  it('should reject non-finite numbers', () => {
    expect(isValidInteger(NaN)).toBe(false)
    expect(isValidInteger(Infinity)).toBe(false)
    expect(isValidInteger(-Infinity)).toBe(false)
  })

  it('should reject non-number types', () => {
    expect(isValidInteger('100')).toBe(false)
    expect(isValidInteger(null)).toBe(false)
    expect(isValidInteger(undefined)).toBe(false)
    expect(isValidInteger({})).toBe(false)
  })

  it('should accept large integers', () => {
    expect(isValidInteger(1000000)).toBe(true)
    expect(isValidInteger(-1000000)).toBe(true)
  })

  it('should reject very small decimals', () => {
    expect(isValidInteger(1.0000001)).toBe(false)
  })
})
