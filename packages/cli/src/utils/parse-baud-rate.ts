import type { BaudRate } from '@ya-modbus/driver-types'

import { STANDARD_BAUD_RATES } from '../discovery/constants.js'

import { parseInteger } from './parse-integer.js'
import { parseSpec } from './parse-spec.js'

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
  return parseSpec({
    spec,
    label: 'baud rate',
    formatExamples: ['"9600,19200"', '"9600-19200"'],
    skipEmptyParts: true,
    parseSingle: (value, context) => {
      const rate = parseInteger(value, context, 'baud rate')
      validateBaudRate(rate, context)
      return rate
    },
    parseRange: (start, end, context) => {
      const startRate = parseInteger(start, context, 'baud rate')
      const endRate = parseInteger(end, context, 'baud rate')

      if (startRate > endRate) {
        throw new Error(`Invalid range: "${context}". Start must be less than or equal to end`)
      }

      validateBaudRate(startRate, context)
      validateBaudRate(endRate, context)

      // Extract baud rates between start and end from STANDARD_BAUD_RATES
      return STANDARD_BAUD_RATES.filter((rate) => rate >= startRate && rate <= endRate)
    },
    sortItems: (items) => items.sort((a, b) => a - b),
  })
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
