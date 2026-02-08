import type { BaudRate } from '@ya-modbus/driver-types'

import { STANDARD_BAUD_RATES } from '../discovery/constants.js'

/**
 * Parses a comma-separated list of baud rates and ranges into a sorted array of unique baud rates.
 *
 * @param spec - Baud rate specification string (e.g., "9600,19200" or "9600-38400")
 * @returns Sorted array of unique baud rates from STANDARD_BAUD_RATES
 *
 * @example
 * parseBaudRate("9600,19200") // [9600, 19200]
 * parseBaudRate("9600-19200") // [9600, 14400, 19200]
 * parseBaudRate("19200,9600") // [9600, 19200]
 */
export function parseBaudRate(spec: string): BaudRate[] {
  const trimmed = spec.trim()
  if (!trimmed) {
    throw new Error(
      'Invalid baud rate specification: empty string. Expected format: "9600,19200" or "9600-19200"'
    )
  }

  const baudRates = new Set<BaudRate>()
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

      validateBaudRate(start, part)
      validateBaudRate(end, part)

      // Extract baud rates between start and end from STANDARD_BAUD_RATES
      const rangeRates = STANDARD_BAUD_RATES.filter((rate) => rate >= start && rate <= end)

      rangeRates.forEach((rate) => baudRates.add(rate))
    } else {
      // Single baud rate
      const rate = parseInteger(normalized, part)

      validateBaudRate(rate, part)
      baudRates.add(rate)
    }
  }

  return Array.from(baudRates).sort((a, b) => a - b)
}

/**
 * Validates that a number is a supported baud rate.
 */
function validateBaudRate(rate: number, context: string): void {
  if (!STANDARD_BAUD_RATES.includes(rate)) {
    throw new Error(
      `Unsupported baud rate: ${rate} in "${context}". ` +
        `Supported rates are: ${STANDARD_BAUD_RATES.join(', ')}`
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
      `Invalid baud rate format: "${context}". Decimal numbers not allowed, expected whole numbers only`
    )
  }

  const num = parseInt(str, 10)
  if (isNaN(num)) {
    throw new Error(`Invalid baud rate format: "${context}". Expected a number`)
  }

  return num
}
