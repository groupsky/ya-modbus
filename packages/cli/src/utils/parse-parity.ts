import type { Parity } from '@ya-modbus/driver-types'

import { STANDARD_PARITY } from '../discovery/constants.js'

import { parseSpec } from './parse-spec.js'

/**
 * Parses a comma-separated list of parity values into a sorted array of unique parities.
 *
 * @param spec - Parity specification string (e.g., "none,even,odd")
 * @returns Sorted array of unique parity values in standard order (none, even, odd)
 *
 * @example
 * parseParity("none,even") // ["none", "even"]
 * parseParity("odd,none") // ["none", "odd"]
 * parseParity("even,even") // ["even"]
 */
export function parseParity(spec: string): Parity[] {
  return parseSpec({
    spec,
    label: 'parity',
    formatExamples: ['"none,even,odd"'],
    skipEmptyParts: false, // Throw error on empty parts for explicit validation
    parseSingle: (value, context) => {
      const normalized = value.toLowerCase()

      if (!isValidParity(normalized)) {
        throw new Error(
          `Invalid parity value: "${value}" in "${context}". Valid values are: ${STANDARD_PARITY.join(', ')}`
        )
      }

      return normalized
    },
    sortItems: (items) => sortParitiesInStandardOrder(items),
  })
}

/**
 * Sorts parities in standard order (none, even, odd)
 */
export function sortParitiesInStandardOrder(parities: Parity[]): Parity[] {
  return STANDARD_PARITY.filter((p) => parities.includes(p))
}

/**
 * Type guard to check if a string is a valid parity value.
 */
function isValidParity(value: string): value is Parity {
  return STANDARD_PARITY.includes(value as Parity)
}
