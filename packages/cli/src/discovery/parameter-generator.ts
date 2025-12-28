import type { BaudRate, DataBits, Parity, StopBits } from '@ya-modbus/driver-types'

import { MAX_SLAVE_ID, MIN_SLAVE_ID } from './constants.js'
import { getParameterArrays } from './parameter-generator-utils.js'

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
 * - quick: Tests common Modbus parameters (faster scan)
 * - thorough: Tests all standard Modbus parameters (comprehensive scan)
 */
export type DiscoveryStrategy = 'quick' | 'thorough'

/**
 * Options for parameter combination generation
 */
export interface GeneratorOptions {
  /** Discovery strategy to use */
  strategy: DiscoveryStrategy
}

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
  const { strategy } = options

  // Get parameter arrays
  const { baudRates, parities, dataBits, stopBits, addressRange } = getParameterArrays(strategy)

  // Generate slave IDs once (reused for each serial config)
  const slaveIds = Array.from(generateSlaveIds(addressRange))

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
  const { strategy } = options

  // Get parameter arrays
  const { baudRates, parities, dataBits, stopBits, addressRange } = getParameterArrays(strategy)

  // Generate slave IDs
  const slaveIds = Array.from(generateSlaveIds(addressRange))

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
