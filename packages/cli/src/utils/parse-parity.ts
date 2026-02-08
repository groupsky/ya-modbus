import type { Parity } from '@ya-modbus/driver-types'

import { STANDARD_PARITY } from '../discovery/constants.js'

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
  const trimmed = spec.trim()
  if (!trimmed) {
    throw new Error('Invalid parity specification: empty string. Expected format: "none,even,odd"')
  }

  const parities = new Set<Parity>()
  const parts = trimmed.split(',')

  for (const part of parts) {
    const normalized = part.trim().toLowerCase()
    if (!normalized) {
      throw new Error(
        `Invalid parity specification: empty value in "${spec}". Expected format: "none,even,odd"`
      )
    }

    // Validate parity value
    if (!isValidParity(normalized)) {
      throw new Error(
        `Invalid parity value: "${part}" in "${spec}". Valid values are: none, even, odd`
      )
    }

    parities.add(normalized)
  }

  // Return in standard order (none, even, odd)
  return STANDARD_PARITY.filter((p) => parities.has(p))
}

/**
 * Type guard to check if a string is a valid parity value.
 */
function isValidParity(value: string): value is Parity {
  return STANDARD_PARITY.includes(value as Parity)
}
