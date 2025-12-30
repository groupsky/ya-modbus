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
export function formatRangeError(name: string, min: number, max: number): string
/**
 * Format a range validation error message with the actual value
 *
 * @param name - Field name for the error message
 * @param value - Actual value that was rejected
 * @param min - Minimum valid value
 * @param max - Maximum valid value
 * @returns Formatted error message
 *
 * @example
 * ```typescript
 * formatRangeError('device address', 256, 1, 247)
 * // => 'Invalid device address: received 256, must be between 1 and 247'
 * ```
 */
export function formatRangeError(name: string, value: unknown, min: number, max: number): string
export function formatRangeError(
  name: string,
  ...args: [number, number] | [unknown, number, number]
): string {
  if (args.length === 2) {
    const [min, max] = args
    return `Invalid ${name}: must be between ${min} and ${max}`
  }
  const [value, min, max] = args
  return `Invalid ${name}: received ${String(value)}, must be between ${min} and ${max}`
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
export function formatEnumError(name: string, values: readonly unknown[]): string
/**
 * Format an enum validation error message with the actual value
 *
 * @param name - Field name for the error message
 * @param value - Actual value that was rejected
 * @param values - Valid enum values
 * @returns Formatted error message
 *
 * @example
 * ```typescript
 * formatEnumError('baud rate', 115200, [9600, 14400, 19200])
 * // => 'Invalid baud rate: received 115200, must be one of 9600, 14400, 19200'
 * ```
 */
export function formatEnumError(name: string, value: unknown, values: readonly unknown[]): string
export function formatEnumError(
  name: string,
  ...args: [readonly unknown[]] | [unknown, readonly unknown[]]
): string {
  if (args.length === 1) {
    const [values] = args
    return `Invalid ${name}: must be one of ${values.join(', ')}`
  }
  const [value, values] = args
  return `Invalid ${name}: received ${String(value)}, must be one of ${values.join(', ')}`
}
