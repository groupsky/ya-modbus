/**
 * Object utility functions
 */

/**
 * Remove undefined properties from an object
 *
 * Creates a new object with all properties that are not undefined.
 * Preserves null, false, 0, empty string, and other falsy values.
 *
 * @param obj - Source object
 * @returns New object without undefined properties
 *
 * @example
 * ```typescript
 * omitUndefined({ a: 1, b: undefined, c: 'hello' })
 * // Returns: { a: 1, c: 'hello' }
 * ```
 */
export function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {}

  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key]
    }
  }

  return result
}
