import type { BaudRate, DataBits, Parity, StopBits } from '@ya-modbus/driver-types'

import {
  COMMON_BAUD_RATES,
  COMMON_DATA_BITS,
  COMMON_STOP_BITS,
  MAX_SLAVE_ID,
  MIN_SLAVE_ID,
  STANDARD_BAUD_RATES,
  STANDARD_DATA_BITS,
  STANDARD_PARITY,
  STANDARD_STOP_BITS,
} from './constants.js'
import type { DiscoveryStrategy, GeneratorOptions } from './parameter-generator.js'

/**
 * Get parameter arrays based on discovery strategy
 */
export function getParameterArrays(strategy: DiscoveryStrategy): {
  baudRates: readonly BaudRate[]
  parities: readonly Parity[]
  dataBits: readonly DataBits[]
  stopBits: readonly StopBits[]
  addressRange: readonly [number, number]
} {
  if (strategy === 'thorough') {
    // Thorough mode: use all standard Modbus parameters
    return {
      baudRates: STANDARD_BAUD_RATES,
      parities: STANDARD_PARITY,
      dataBits: STANDARD_DATA_BITS,
      stopBits: STANDARD_STOP_BITS,
      addressRange: [MIN_SLAVE_ID, MAX_SLAVE_ID],
    }
  }

  // Quick mode: use common parameters
  return {
    baudRates: COMMON_BAUD_RATES,
    parities: STANDARD_PARITY,
    dataBits: COMMON_DATA_BITS,
    stopBits: COMMON_STOP_BITS,
    addressRange: [MIN_SLAVE_ID, MAX_SLAVE_ID],
  }
}

/**
 * Count the total number of parameter combinations without materializing them
 *
 * This is much more efficient than Array.from(generateParameterCombinations()).length
 * as it calculates the count mathematically instead of generating all combinations.
 *
 * @param options - Generator options
 * @returns Total number of combinations that will be generated
 *
 * @example
 * ```typescript
 * const count = countParameterCombinations({ strategy: 'quick' })
 * console.log(`Will test ${count} combinations`) // Will test 3952 combinations
 * ```
 */
export function countParameterCombinations(options: GeneratorOptions): number {
  const { strategy } = options

  const { baudRates, parities, dataBits, stopBits, addressRange } = getParameterArrays(strategy)

  // Calculate address count
  const [minId, maxId] = addressRange
  const addressCount = maxId - minId + 1

  // Total combinations = addresses × baud rates × parities × data bits × stop bits
  return addressCount * baudRates.length * parities.length * dataBits.length * stopBits.length
}
