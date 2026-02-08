/**
 * Parses a comma-separated list of IDs and ranges into a sorted array of unique IDs.
 *
 * @param spec - ID specification string (e.g., "1,2,3-5")
 * @returns Sorted array of unique Modbus slave IDs (1-247)
 *
 * @example
 * parseIdRange("1,2,3-5") // [1, 2, 3, 4, 5]
 * parseIdRange("5,1,3") // [1, 3, 5]
 * parseIdRange("1-3,2-4") // [1, 2, 3, 4]
 */
export function parseIdRange(spec: string): number[] {
  const trimmed = spec.trim()
  if (!trimmed) {
    throw new Error('Invalid ID specification: empty string. Expected format: "1,2,3" or "1-5"')
  }

  const ids = new Set<number>()
  const parts = trimmed.split(',')

  for (const part of parts) {
    const normalized = part.trim()
    if (!normalized) continue

    // Check if it's a range (contains hyphen)
    if (normalized.includes('-')) {
      const rangeParts = normalized.split('-').map((s) => s.trim())

      if (rangeParts.length !== 2 || !rangeParts[0] || !rangeParts[1]) {
        throw new Error(`Invalid range format: "${part}". Expected format: "start-end"`)
      }

      const start = parseInteger(rangeParts[0], part)
      const end = parseInteger(rangeParts[1], part)

      if (start > end) {
        throw new Error(`Invalid range: "${part}". Start must be less than or equal to end`)
      }

      validateModbusAddress(start, part)
      validateModbusAddress(end, part)

      for (let i = start; i <= end; i++) {
        ids.add(i)
      }
    } else {
      // Single ID
      const id = parseInteger(normalized, part)

      validateModbusAddress(id, part)
      ids.add(id)
    }
  }

  return Array.from(ids).sort((a, b) => a - b)
}

/**
 * Validates that a number is a valid Modbus slave address (1-247).
 */
function validateModbusAddress(id: number, context: string): void {
  if (id < 1 || id > 247) {
    throw new Error(
      `Invalid Modbus slave address: ${id} in "${context}". ` + `Valid addresses are 1-247`
    )
  }
}

/**
 * Parses a string to an integer with validation.
 * Rejects decimal numbers explicitly.
 */
function parseInteger(str: string, context: string): number {
  if (str.includes('.')) {
    throw new Error(
      `Invalid ID format: "${context}". Decimal numbers not allowed, expected whole numbers only`
    )
  }

  const num = parseInt(str, 10)
  if (isNaN(num)) {
    throw new Error(`Invalid ID format: "${context}". Expected a number`)
  }

  return num
}
