import type {
  BaudRate,
  DataBits,
  Parity,
  StopBits,
  SupportedSerialConfig,
} from '@ya-modbus/driver-types'

import type { DiscoveryStrategy, GeneratorOptions } from './parameter-generator.js'

/**
 * Standard Modbus baud rates for thorough scanning
 */
const STANDARD_BAUD_RATES: readonly BaudRate[] = [
  9600, 19200, 14400, 38400, 57600, 115200, 4800, 2400,
] as const

/**
 * Common baud rates for quick scanning
 */
const COMMON_BAUD_RATES: readonly BaudRate[] = [9600, 19200] as const

/**
 * Standard Modbus parity settings
 */
const STANDARD_PARITY: readonly Parity[] = ['none', 'even', 'odd'] as const

/**
 * Common parity settings for quick scanning
 */
const COMMON_PARITY: readonly Parity[] = ['none', 'even'] as const

/**
 * Standard data bits options
 */
const STANDARD_DATA_BITS: readonly DataBits[] = [8, 7] as const

/**
 * Standard stop bits options
 */
const STANDARD_STOP_BITS: readonly StopBits[] = [1, 2] as const

/**
 * Valid Modbus slave address range
 */
const MIN_SLAVE_ID = 1
const MAX_SLAVE_ID = 247

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
      parities: supportedConfig.validParity ?? COMMON_PARITY,
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
    parities: COMMON_PARITY,
    dataBits: STANDARD_DATA_BITS,
    stopBits: STANDARD_STOP_BITS,
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
