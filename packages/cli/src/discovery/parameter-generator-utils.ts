import type {
  BaudRate,
  DataBits,
  Parity,
  StopBits,
  SupportedSerialConfig,
} from '@ya-modbus/driver-types'

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
 * Get parameter arrays based on strategy and configuration
 * (Same logic as in parameter-generator.ts but for counting)
 */
function getParameterArraysForCount(
  strategy: DiscoveryStrategy,
  supportedConfig?: SupportedSerialConfig
): {
  baudRates: readonly BaudRate[]
  parities: readonly Parity[]
  dataBits: readonly DataBits[]
  stopBits: readonly StopBits[]
  addressRange: readonly [number, number]
} {
  if (strategy === 'quick' && supportedConfig) {
    return {
      baudRates: supportedConfig.validBaudRates ?? COMMON_BAUD_RATES,
      parities: supportedConfig.validParity ?? STANDARD_PARITY,
      dataBits: supportedConfig.validDataBits ?? STANDARD_DATA_BITS,
      stopBits: supportedConfig.validStopBits ?? STANDARD_STOP_BITS,
      addressRange: supportedConfig.validAddressRange ?? [MIN_SLAVE_ID, MAX_SLAVE_ID],
    }
  }

  if (strategy === 'thorough') {
    return {
      baudRates: supportedConfig?.validBaudRates ?? STANDARD_BAUD_RATES,
      parities: supportedConfig?.validParity ?? STANDARD_PARITY,
      dataBits: supportedConfig?.validDataBits ?? STANDARD_DATA_BITS,
      stopBits: supportedConfig?.validStopBits ?? STANDARD_STOP_BITS,
      addressRange: supportedConfig?.validAddressRange ?? [MIN_SLAVE_ID, MAX_SLAVE_ID],
    }
  }

  // Quick mode without driver config
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
  const { strategy, supportedConfig } = options

  const { baudRates, parities, dataBits, stopBits, addressRange } = getParameterArraysForCount(
    strategy,
    supportedConfig
  )

  // Calculate address count
  const [minId, maxId] = addressRange
  const addressCount = maxId - minId + 1

  // Total combinations = addresses × baud rates × parities × data bits × stop bits
  return addressCount * baudRates.length * parities.length * dataBits.length * stopBits.length
}
