/**
 * Generic utility for parsing comma-separated specification strings
 * with optional range support.
 *
 * Handles:
 * - Empty string validation
 * - Comma-separated list parsing
 * - Optional range expansion (e.g., "1-5")
 * - Deduplication via Set
 * - Custom sorting/ordering
 *
 * @example
 * const parseIds = (spec: string) => parseSpec({
 *   spec,
 *   label: 'ID',
 *   formatExamples: ['"1,2,3"', '"1-5"'],
 *   parseSingle: (value, context) => {
 *     const id = parseInteger(value, context, 'ID')
 *     if (id < 1 || id > 247) throw new Error(...)
 *     return id
 *   },
 *   parseRange: (start, end, context) => {
 *     const startId = parseInteger(start, context, 'ID')
 *     const endId = parseInteger(end, context, 'ID')
 *     return Array.from({length: endId - startId + 1}, (_, i) => startId + i)
 *   },
 *   sortItems: (items) => items.sort((a, b) => a - b)
 * })
 */
export interface ParseSpecOptions<T> {
  /** The specification string to parse (e.g., "1,2,3" or "none,even") */
  spec: string

  /** Label for the value type (e.g., "ID", "parity", "baud rate") */
  label: string

  /** Example formats to show in error messages (e.g., ['"1,2,3"', '"1-5"']) */
  formatExamples: string[]

  /**
   * Parse a single value from the spec
   * @param value - The trimmed value to parse
   * @param context - The original part for error context
   * @returns The parsed value
   */
  parseSingle: (value: string, context: string) => T

  /**
   * Optional: Parse a range (e.g., "1-5")
   * @param start - The start value string
   * @param end - The end value string
   * @param context - The original range string for error context
   * @returns Array of values in the range
   */
  parseRange?: (start: string, end: string, context: string) => T[]

  /**
   * Sort/order the final array of values
   * @param items - Deduplicated array of items
   * @returns Sorted array
   */
  sortItems: (items: T[]) => T[]

  /**
   * Optional: Skip empty parts in comma-separated list instead of throwing error
   * Default: false (throw error on empty parts)
   */
  skipEmptyParts?: boolean
}

/**
 * Generic parser for comma-separated specification strings
 *
 * @param options - Parsing options
 * @returns Sorted array of unique values
 *
 * @throws Error if spec is empty or contains invalid values
 */
export function parseSpec<T>(options: ParseSpecOptions<T>): T[] {
  const {
    spec,
    label,
    formatExamples,
    parseSingle,
    parseRange,
    sortItems,
    skipEmptyParts = false,
  } = options

  const trimmed = spec.trim()
  if (!trimmed) {
    throw new Error(
      `Invalid ${label} specification: empty string. Expected format: ${formatExamples.join(' or ')}`
    )
  }

  const items = new Set<T>()
  const parts = trimmed.split(',')

  for (const part of parts) {
    const normalized = part.trim()

    if (!normalized) {
      if (skipEmptyParts) {
        continue
      } else {
        throw new Error(
          `Invalid ${label} specification: empty value in "${spec}". Expected format: ${formatExamples.join(' or ')}`
        )
      }
    }

    // Check if it's a range (contains hyphen)
    if (normalized.includes('-') && parseRange) {
      const rangeParts = normalized.split('-').map((s) => s.trim())

      if (rangeParts.length !== 2 || !rangeParts[0] || !rangeParts[1]) {
        throw new Error(`Invalid range format: "${part}". Expected format: "start-end"`)
      }

      const rangeValues = parseRange(rangeParts[0], rangeParts[1], part)
      rangeValues.forEach((value) => items.add(value))
    } else {
      // Single value
      const value = parseSingle(normalized, part)
      items.add(value)
    }
  }

  return sortItems(Array.from(items))
}
