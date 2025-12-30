/**
 * Validation utilities for driver configuration values
 *
 * These utilities provide type-safe validation with proper TypeScript
 * type narrowing for common configuration values like baud rates,
 * device addresses, and numeric ranges.
 */

/**
 * Create a type-safe enum validator function
 *
 * Returns a type guard function that validates if a value is one of
 * the allowed enum values. The returned function properly narrows
 * TypeScript types.
 *
 * @param values - Readonly array of valid enum values
 * @returns Type guard function that validates enum membership
 *
 * @example
 * ```typescript
 * import { createEnumValidator } from '@ya-modbus/driver-sdk'
 *
 * const VALID_BAUD_RATES = [9600, 14400, 19200] as const
 * type ValidBaudRate = (typeof VALID_BAUD_RATES)[number]
 *
 * const isValidBaudRate = createEnumValidator(VALID_BAUD_RATES)
 *
 * if (isValidBaudRate(value)) {
 *   // value is now typed as ValidBaudRate
 *   const encoded = encodeBaudRate(value)
 * }
 * ```
 */
export function createEnumValidator<T extends readonly unknown[]>(
  values: T
): (value: unknown) => value is T[number] {
  return (value: unknown): value is T[number] => {
    return values.includes(value as T[number])
  }
}

/**
 * Create a numeric range validator function
 *
 * Returns a function that validates if a value is a finite number
 * within the specified range (inclusive).
 *
 * @param min - Minimum valid value (inclusive)
 * @param max - Maximum valid value (inclusive)
 * @returns Validator function that checks range membership
 *
 * @example
 * ```typescript
 * import { createRangeValidator } from '@ya-modbus/driver-sdk'
 *
 * const isValidAddress = createRangeValidator(1, 247)
 *
 * if (isValidAddress(value)) {
 *   // value is a finite number between 1 and 247
 *   await writeAddress(value)
 * }
 * ```
 */
export function createRangeValidator(
  min: number,
  max: number
): (value: unknown) => value is number {
  return (value: unknown): value is number => {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
  }
}

/**
 * Validate that a value is a finite integer
 *
 * Checks if a value is a number, finite, and has no fractional part.
 *
 * @param value - Value to validate
 * @returns True if value is a finite integer
 *
 * @example
 * ```typescript
 * import { validateInteger } from '@ya-modbus/driver-sdk'
 *
 * if (!validateInteger(value)) {
 *   throw new Error('Device address must be an integer')
 * }
 * ```
 */
export function validateInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)
}
