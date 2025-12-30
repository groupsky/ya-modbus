/**
 * Error formatting utilities for consistent validation error messages
 */

/**
 * Format a range validation error message
 *
 * @param name - Field name for the error message
 * @param min - Minimum valid value
 * @param max - Maximum valid value
 * @returns Formatted error message
 *
 * @example
 * ```typescript
 * formatRangeError('device address', 1, 247)
 * // => 'Invalid device address: must be between 1 and 247'
 * ```
 */
export function formatRangeError(name: string, min: number, max: number): string {
  return `Invalid ${name}: must be between ${min} and ${max}`
}

/**
 * Format an enum validation error message
 *
 * @param name - Field name for the error message
 * @param values - Valid enum values
 * @returns Formatted error message
 *
 * @example
 * ```typescript
 * formatEnumError('baud rate', [9600, 14400, 19200])
 * // => 'Invalid baud rate: must be one of 9600, 14400, 19200'
 * ```
 */
export function formatEnumError(name: string, values: readonly unknown[]): string {
  return `Invalid ${name}: must be one of ${values.join(', ')}`
}
