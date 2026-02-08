/**
 * Merges multiple specification strings (from repeated CLI flags) into a
 * single deduplicated, sorted array.
 *
 * Handles:
 * - Single string or array of strings
 * - Deduplication across all specifications
 * - Custom sorting
 *
 * @param specs - Single spec string, array of spec strings, or undefined
 * @param parser - Function that parses a single spec string
 * @param sorter - Optional function to sort the final array
 * @returns Merged and sorted array, or undefined if specs is undefined
 *
 * @example
 * // Merge multiple --id specifications
 * const ids = mergeSpecs(
 *   ['1,2', '3-5'],
 *   parseIdRange,
 *   (items) => items.sort((a, b) => a - b)
 * )
 * // Result: [1, 2, 3, 4, 5]
 *
 * @example
 * // Merge multiple --parity specifications
 * const parities = mergeSpecs(
 *   ['none', 'even,odd'],
 *   parseParity,
 *   sortParitiesInStandardOrder
 * )
 * // Result: ['none', 'even', 'odd']
 */
export function mergeSpecs<T>(
  specs: string | string[] | undefined,
  parser: (spec: string) => T[],
  sorter?: (items: T[]) => T[]
): T[] | undefined {
  if (specs === undefined) {
    return undefined
  }

  // Normalize to array
  const specArray = Array.isArray(specs) ? specs : [specs]

  // Parse and merge into Set for deduplication
  const allValues = new Set<T>()
  for (const spec of specArray) {
    const values = parser(spec)
    values.forEach((value) => allValues.add(value))
  }

  // Convert to array
  const result = Array.from(allValues)

  // Apply custom sorter if provided, otherwise return unsorted
  return sorter ? sorter(result) : result
}
