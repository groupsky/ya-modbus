import type {
  BaudRate,
  DataBits,
  DefaultSerialConfig,
  Parity,
  StopBits,
  SupportedSerialConfig,
} from '@ya-modbus/driver-types'

/**
 * Parameter combination for discovery testing
 * Represents a complete set of Modbus RTU serial parameters
 */
export interface ParameterCombination {
  slaveId: number
  baudRate: BaudRate
  parity: Parity
  dataBits: DataBits
  stopBits: StopBits
}

/**
 * Discovery strategy type
 *
 * - quick: Tests only driver-supported parameters (5-10 minutes)
 * - thorough: Tests all standard Modbus parameters (30-60 minutes)
 */
export type DiscoveryStrategy = 'quick' | 'thorough'

/**
 * Options for parameter combination generation
 */
export interface GeneratorOptions {
  /** Discovery strategy to use */
  strategy: DiscoveryStrategy

  /** Driver-provided default configuration (prioritized first) */
  defaultConfig?: DefaultSerialConfig

  /** Driver-provided supported configuration constraints */
  supportedConfig?: SupportedSerialConfig
}

/**
 * Standard Modbus baud rates for thorough scanning
 * Ordered by commonality (most common first)
 */
const STANDARD_BAUD_RATES: readonly BaudRate[] = [
  9600, // Most common
  19200, // Modbus spec default
  14400,
  38400,
  57600,
  115200,
  4800, // Less common
  2400, // Legacy
] as const

/**
 * Common baud rates for quick scanning
 */
const COMMON_BAUD_RATES: readonly BaudRate[] = [9600, 19200] as const

/**
 * Standard Modbus parity settings
 * Ordered by commonality
 */
const STANDARD_PARITY: readonly Parity[] = ['none', 'even', 'odd'] as const

/**
 * Standard data bits options
 */
const STANDARD_DATA_BITS: readonly DataBits[] = [8, 7] as const

/**
 * Common data bits for quick scanning
 */
const COMMON_DATA_BITS: readonly DataBits[] = [8] as const

/**
 * Standard stop bits options
 */
const STANDARD_STOP_BITS: readonly StopBits[] = [1, 2] as const

/**
 * Common stop bits for quick scanning
 */
const COMMON_STOP_BITS: readonly StopBits[] = [1] as const

/**
 * Valid Modbus slave address range (0 is broadcast, 248-255 reserved)
 */
const MIN_SLAVE_ID = 1
const MAX_SLAVE_ID = 247

/**
 * Clamp slave ID to valid Modbus range [1, 247]
 */
function clampSlaveId(id: number): number {
  return Math.max(MIN_SLAVE_ID, Math.min(MAX_SLAVE_ID, id))
}

/**
 * Generate ordered list of slave IDs to test
 *
 * Priority order:
 * 1. Default address (if provided)
 * 2. Address 1 (most common)
 * 3. Address 2
 * 4. Remaining addresses sequentially (3, 4, 5, ...)
 */
function* generateSlaveIds(
  range: readonly [number, number],
  defaultAddress?: number
): Generator<number> {
  const [minId, maxId] = range
  const start = clampSlaveId(minId)
  const end = clampSlaveId(maxId)

  const yielded = new Set<number>()

  // Helper to yield if not already yielded and in range
  function* yieldIfValid(id: number): Generator<number> {
    const clamped = clampSlaveId(id)
    if (clamped >= start && clamped <= end && !yielded.has(clamped)) {
      yielded.add(clamped)
      yield clamped
    }
  }

  // 1. Default address first
  if (defaultAddress !== undefined) {
    yield* yieldIfValid(defaultAddress)
  }

  // 2. Common addresses (1, 2)
  yield* yieldIfValid(1)
  yield* yieldIfValid(2)

  // 3. Remaining addresses sequentially
  for (let id = start; id <= end; id++) {
    if (!yielded.has(id)) {
      yielded.add(id)
      yield id
    }
  }
}

/**
 * Get parameter arrays based on strategy and configuration
 */
function getParameterArrays(
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
    // Quick mode with driver config: use supported values or fall back to common
    return {
      baudRates: supportedConfig.validBaudRates ?? COMMON_BAUD_RATES,
      parities: supportedConfig.validParity ?? STANDARD_PARITY,
      dataBits: supportedConfig.validDataBits ?? STANDARD_DATA_BITS,
      stopBits: supportedConfig.validStopBits ?? STANDARD_STOP_BITS,
      addressRange: supportedConfig.validAddressRange ?? [MIN_SLAVE_ID, MAX_SLAVE_ID],
    }
  }

  if (strategy === 'thorough') {
    // Thorough mode: use supported config if provided, otherwise standard Modbus
    return {
      baudRates: supportedConfig?.validBaudRates ?? STANDARD_BAUD_RATES,
      parities: supportedConfig?.validParity ?? STANDARD_PARITY,
      dataBits: supportedConfig?.validDataBits ?? STANDARD_DATA_BITS,
      stopBits: supportedConfig?.validStopBits ?? STANDARD_STOP_BITS,
      addressRange: supportedConfig?.validAddressRange ?? [MIN_SLAVE_ID, MAX_SLAVE_ID],
    }
  }

  // Quick mode without driver config: use common parameters
  return {
    baudRates: COMMON_BAUD_RATES,
    parities: STANDARD_PARITY,
    dataBits: COMMON_DATA_BITS,
    stopBits: COMMON_STOP_BITS,
    addressRange: [MIN_SLAVE_ID, MAX_SLAVE_ID],
  }
}

/**
 * Prioritize default configuration values in parameter arrays
 *
 * Moves default values to the front of arrays while preserving uniqueness
 */
function prioritizeDefaults<T>(array: readonly T[], defaultValue: T | undefined): readonly T[] {
  if (defaultValue === undefined || !array.includes(defaultValue)) {
    return array
  }

  // Move default to front, remove duplicates
  return [defaultValue, ...array.filter((v) => v !== defaultValue)]
}

/**
 * Group of parameter combinations that share the same serial configuration
 */
export interface ParameterGroup {
  /** Serial parameters shared by all combinations in this group */
  serialParams: {
    baudRate: BaudRate
    parity: Parity
    dataBits: DataBits
    stopBits: StopBits
  }
  /** All parameter combinations for this serial configuration (different slave IDs) */
  combinations: ParameterCombination[]
}

/**
 * Generate parameter combinations grouped by serial configuration
 *
 * This is a memory-efficient alternative to materializing all combinations.
 * Instead of creating all ~1500+ combinations at once, this generator yields
 * groups of ~247 combinations at a time (one per serial config).
 *
 * Each group shares the same serial parameters (baud, parity, data bits, stop bits)
 * but has different slave IDs. This matches how the scanner works - it creates
 * one connection per serial config and tests all slave IDs with that connection.
 *
 * @param options - Generation options
 * @yields Parameter groups to test
 *
 * @example Iterate over groups without materializing all combinations
 * ```typescript
 * for (const group of generateParameterGroups(options)) {
 *   // Only this group's ~247 combinations are in memory
 *   const { serialParams, combinations } = group
 *   // ... use combinations ...
 * }
 * ```
 */
export function* generateParameterGroups(options: GeneratorOptions): Generator<ParameterGroup> {
  const { strategy, defaultConfig, supportedConfig } = options

  // Get parameter arrays
  let { baudRates, parities, dataBits, stopBits } = getParameterArrays(strategy, supportedConfig)
  const { addressRange } = getParameterArrays(strategy, supportedConfig)

  // Prioritize default values to test them first
  if (defaultConfig) {
    baudRates = prioritizeDefaults(baudRates, defaultConfig.baudRate)
    parities = prioritizeDefaults(parities, defaultConfig.parity)
    dataBits = prioritizeDefaults(dataBits, defaultConfig.dataBits)
    stopBits = prioritizeDefaults(stopBits, defaultConfig.stopBits)
  }

  // Generate slave IDs once (reused for each serial config)
  const slaveIds = Array.from(generateSlaveIds(addressRange, defaultConfig?.defaultAddress))

  // Generate groups: iterate serial params (baud × parity × data × stop)
  // For each serial config, create a group with all slave IDs
  for (const baudRate of baudRates) {
    for (const parity of parities) {
      for (const dataBits_ of dataBits) {
        for (const stopBits_ of stopBits) {
          // Build combinations for this serial config
          const combinations: ParameterCombination[] = slaveIds.map((slaveId) => ({
            slaveId,
            baudRate,
            parity,
            dataBits: dataBits_,
            stopBits: stopBits_,
          }))

          yield {
            serialParams: {
              baudRate,
              parity,
              dataBits: dataBits_,
              stopBits: stopBits_,
            },
            combinations,
          }
        }
      }
    }
  }
}

/**
 * Generate all parameter combinations for Modbus device discovery
 *
 * Produces combinations in priority order:
 * 1. Default configuration (if provided) tested first
 * 2. Common slave addresses (1, 2) before others
 * 3. Common baud rates before exotic ones
 *
 * @param options - Generation options
 * @yields Parameter combinations to test
 *
 * @example Quick discovery with driver config
 * ```typescript
 * const combinations = generateParameterCombinations({
 *   strategy: 'quick',
 *   defaultConfig: { baudRate: 9600, parity: 'even', ... },
 *   supportedConfig: { validBaudRates: [9600, 19200], ... }
 * })
 * ```
 *
 * @example Thorough discovery without driver
 * ```typescript
 * const combinations = generateParameterCombinations({
 *   strategy: 'thorough'
 * })
 * ```
 */
export function* generateParameterCombinations(
  options: GeneratorOptions
): Generator<ParameterCombination> {
  const { strategy, defaultConfig, supportedConfig } = options

  // Get parameter arrays
  let { baudRates, parities, dataBits, stopBits } = getParameterArrays(strategy, supportedConfig)
  const { addressRange } = getParameterArrays(strategy, supportedConfig)

  // Prioritize default values to test them first
  if (defaultConfig) {
    baudRates = prioritizeDefaults(baudRates, defaultConfig.baudRate)
    parities = prioritizeDefaults(parities, defaultConfig.parity)
    dataBits = prioritizeDefaults(dataBits, defaultConfig.dataBits)
    stopBits = prioritizeDefaults(stopBits, defaultConfig.stopBits)
  }

  // Generate combinations in priority order:
  // - Default config combination first
  // - Then iterate: slave IDs (prioritized) × baud rates (prioritized) × parity × data × stop

  const slaveIds = Array.from(generateSlaveIds(addressRange, defaultConfig?.defaultAddress))

  for (const slaveId of slaveIds) {
    for (const baudRate of baudRates) {
      for (const parity of parities) {
        for (const dataBits_ of dataBits) {
          for (const stopBits_ of stopBits) {
            yield {
              slaveId,
              baudRate,
              parity,
              dataBits: dataBits_,
              stopBits: stopBits_,
            }
          }
        }
      }
    }
  }
}
