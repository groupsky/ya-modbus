/**
 * Parses a string to an integer with validation.
 * Rejects decimal numbers explicitly.
 *
 * @param str - String to parse
 * @param context - Context string for error messages
 * @param label - Label for the value type (e.g., "ID", "baud rate")
 * @returns Parsed integer
 *
 * @example
 * parseInteger("123", "1-5", "ID") // 123
 * parseInteger("12.5", "1-5", "ID") // throws Error
 */
export function parseInteger(str: string, context: string, label: string): number {
  if (str.includes('.')) {
    throw new Error(
      `Invalid ${label} format: "${context}". Decimal numbers not allowed, expected whole numbers only`
    )
  }

  const num = parseInt(str, 10)
  if (isNaN(num)) {
    throw new Error(`Invalid ${label} format: "${context}". Expected a number`)
  }

  return num
}
