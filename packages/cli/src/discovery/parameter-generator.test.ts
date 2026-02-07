import type { DefaultSerialConfig, SupportedSerialConfig } from '@ya-modbus/driver-types'

import { generateParameterCombinations, type GeneratorOptions } from './parameter-generator.js'

describe('generateParameterCombinations', () => {
  describe('quick strategy with driver config', () => {
    test('generates combinations from SUPPORTED_CONFIG', () => {
      const supportedConfig: SupportedSerialConfig = {
        validBaudRates: [9600, 19200],
        validParity: ['even', 'none'],
        validDataBits: [8],
        validStopBits: [1],
        validAddressRange: [1, 10],
      }

      const options: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig,
      }

      const combinations = Array.from(generateParameterCombinations(options))

      // Total: 2 baud rates × 2 parity × 1 data bits × 1 stop bits × 10 addresses = 40
      expect(combinations).toHaveLength(40)

      // Check first combination
      expect(combinations[0]).toEqual({
        slaveId: 1,
        baudRate: 9600,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
      })

      // Verify all combinations are unique
      const uniqueCombos = new Set(combinations.map((c) => JSON.stringify(c)))
      expect(uniqueCombos.size).toBe(40)
    })

    test('prioritizes DEFAULT_CONFIG values first', () => {
      const defaultConfig: DefaultSerialConfig = {
        baudRate: 19200,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 5,
      }

      const supportedConfig: SupportedSerialConfig = {
        validBaudRates: [9600, 19200],
        validParity: ['even', 'none'],
        validDataBits: [8],
        validStopBits: [1],
        validAddressRange: [1, 10],
      }

      const options: GeneratorOptions = {
        strategy: 'quick',
        defaultConfig,
        supportedConfig,
      }

      const combinations = Array.from(generateParameterCombinations(options))

      // First combination should be the DEFAULT_CONFIG
      expect(combinations[0]).toEqual({
        slaveId: 5, // defaultAddress
        baudRate: 19200,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      })
    })

    test('orders slave IDs by commonality (1, 2, then sequential)', () => {
      const supportedConfig: SupportedSerialConfig = {
        validBaudRates: [9600],
        validParity: ['none'],
        validDataBits: [8],
        validStopBits: [1],
        validAddressRange: [1, 5],
      }

      const options: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig,
      }

      const combinations = Array.from(generateParameterCombinations(options))
      const slaveIds = combinations.map((c) => c.slaveId)

      // For range [1, 5], order should be: 1, 2, 3, 4, 5
      expect(slaveIds).toEqual([1, 2, 3, 4, 5])
    })

    test('handles partial SUPPORTED_CONFIG with defaults for missing values', () => {
      const supportedConfig: SupportedSerialConfig = {
        validBaudRates: [9600],
        // No parity, dataBits, stopBits specified - should use standard Modbus defaults
        validAddressRange: [1, 2],
      }

      const options: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig,
      }

      const combinations = Array.from(generateParameterCombinations(options))

      // Should generate with standard Modbus defaults for missing values
      // 1 baud × 3 parity (N,E,O) × 2 data bits (7,8) × 2 stop bits (1,2) × 2 addresses = 24
      expect(combinations.length).toBeGreaterThan(0)

      // Verify first combination uses reasonable defaults
      expect(combinations[0]).toMatchObject({
        slaveId: 1,
        baudRate: 9600,
      })
    })
  })

  describe('thorough strategy', () => {
    test('generates all standard Modbus parameter combinations', () => {
      const options: GeneratorOptions = {
        strategy: 'thorough',
      }

      const combinations = Array.from(generateParameterCombinations(options))

      // Should test common baud rates, all parities, data bits, stop bits
      // 8 bauds × 3 parity × 2 data × 2 stop × 247 addresses = 23,712
      // Let's verify we get a substantial number
      expect(combinations.length).toBeGreaterThan(20000)

      // Verify variety in parameters
      const baudRates = new Set(combinations.map((c) => c.baudRate))
      const parities = new Set(combinations.map((c) => c.parity))
      const dataBits = new Set(combinations.map((c) => c.dataBits))
      const stopBits = new Set(combinations.map((c) => c.stopBits))

      expect(baudRates.size).toBeGreaterThanOrEqual(8) // Multiple baud rates
      expect(parities).toEqual(new Set(['none', 'even', 'odd']))
      expect(dataBits).toEqual(new Set([7, 8]))
      expect(stopBits).toEqual(new Set([1, 2]))
    })

    test('respects SUPPORTED_CONFIG even in thorough mode', () => {
      const supportedConfig: SupportedSerialConfig = {
        validBaudRates: [9600],
        validParity: ['even'],
        validDataBits: [8],
        validStopBits: [1],
        validAddressRange: [1, 3],
      }

      const options: GeneratorOptions = {
        strategy: 'thorough',
        supportedConfig,
      }

      const combinations = Array.from(generateParameterCombinations(options))

      // Thorough mode respects constraints: 1 × 1 × 1 × 1 × 3 = 3
      expect(combinations).toHaveLength(3)

      // All should match supported config
      combinations.forEach((combo) => {
        expect(combo.baudRate).toBe(9600)
        expect(combo.parity).toBe('even')
        expect(combo.dataBits).toBe(8)
        expect(combo.stopBits).toBe(1)
        expect(combo.slaveId).toBeGreaterThanOrEqual(1)
        expect(combo.slaveId).toBeLessThanOrEqual(3)
      })
    })
  })

  describe('edge cases', () => {
    test('handles missing SUPPORTED_CONFIG gracefully', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
        // No supportedConfig provided
      }

      const combinations = Array.from(generateParameterCombinations(options))

      // Should fall back to common parameters
      expect(combinations.length).toBeGreaterThan(0)
    })

    test('handles invalid address range by clamping to 1-247', () => {
      const supportedConfig: SupportedSerialConfig = {
        validBaudRates: [9600],
        validParity: ['none'],
        validDataBits: [8],
        validStopBits: [1],
        validAddressRange: [0, 300], // Invalid range
      }

      const options: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig,
      }

      const combinations = Array.from(generateParameterCombinations(options))
      const slaveIds = combinations.map((c) => c.slaveId)

      // Should clamp to valid Modbus range [1, 247]
      expect(Math.min(...slaveIds)).toBeGreaterThanOrEqual(1)
      expect(Math.max(...slaveIds)).toBeLessThanOrEqual(247)
    })

    test('handles DEFAULT_CONFIG not in SUPPORTED_CONFIG by still prioritizing it', () => {
      const defaultConfig: DefaultSerialConfig = {
        baudRate: 115200, // Not in supported list
        parity: 'odd', // Not in supported list
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 1,
      }

      const supportedConfig: SupportedSerialConfig = {
        validBaudRates: [9600, 19200],
        validParity: ['none', 'even'],
        validDataBits: [8],
        validStopBits: [1],
        validAddressRange: [1, 5],
      }

      const options: GeneratorOptions = {
        strategy: 'quick',
        defaultConfig,
        supportedConfig,
      }

      const combinations = Array.from(generateParameterCombinations(options))

      // Should still generate combinations from SUPPORTED_CONFIG
      // Total: 2 bauds × 2 parity × 1 data × 1 stop × 5 addresses = 20
      expect(combinations).toHaveLength(20)

      // DEFAULT_CONFIG values not in SUPPORTED_CONFIG should not appear
      expect(combinations.every((c) => c.baudRate !== 115200)).toBe(true)
      expect(combinations.every((c) => c.parity !== 'odd')).toBe(true)
    })
  })

  describe('slave ID prioritization', () => {
    test('prioritizes defaultAddress from DEFAULT_CONFIG', () => {
      const defaultConfig: DefaultSerialConfig = {
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 42,
      }

      const supportedConfig: SupportedSerialConfig = {
        validBaudRates: [9600],
        validParity: ['none'],
        validDataBits: [8],
        validStopBits: [1],
        validAddressRange: [1, 247],
      }

      const options: GeneratorOptions = {
        strategy: 'quick',
        defaultConfig,
        supportedConfig,
      }

      const combinations = Array.from(generateParameterCombinations(options))
      const slaveIds = combinations.map((c) => c.slaveId)

      // defaultAddress (42) should be first
      expect(slaveIds[0]).toBe(42)
    })

    test('orders addresses: defaultAddress, 1, 2, then rest sequentially', () => {
      const defaultConfig: DefaultSerialConfig = {
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 10,
      }

      const supportedConfig: SupportedSerialConfig = {
        validBaudRates: [9600],
        validParity: ['none'],
        validDataBits: [8],
        validStopBits: [1],
        validAddressRange: [1, 15],
      }

      const options: GeneratorOptions = {
        strategy: 'quick',
        defaultConfig,
        supportedConfig,
      }

      const combinations = Array.from(generateParameterCombinations(options))
      const slaveIds = combinations.map((c) => c.slaveId)

      // Order: 10 (default), 1, 2, then 3, 4, 5... 9, 11, 12, 13, 14, 15
      expect(slaveIds[0]).toBe(10)
      expect(slaveIds[1]).toBe(1)
      expect(slaveIds[2]).toBe(2)
      expect(slaveIds[3]).toBe(3)
    })
  })
})

describe('generateParameterGroups', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { generateParameterGroups } = require('./parameter-generator.js')

  describe('basic grouping', () => {
    test('groups combinations by serial parameters', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600, 19200],
          validParity: ['none', 'even'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 3],
        },
      }

      const groups = Array.from(generateParameterGroups(options))

      // Should have 4 groups: 2 baud rates × 2 parity × 1 data × 1 stop = 4
      expect(groups).toHaveLength(4)

      // Each group should have 3 combinations (slave IDs 1-3)
      for (const group of groups) {
        expect(group.combinations).toHaveLength(3)
      }

      // Verify first group has correct structure
      const firstGroup = groups[0]
      expect(firstGroup).toHaveProperty('serialParams')
      expect(firstGroup.serialParams).toHaveProperty('baudRate')
      expect(firstGroup.serialParams).toHaveProperty('parity')
      expect(firstGroup.serialParams).toHaveProperty('dataBits')
      expect(firstGroup.serialParams).toHaveProperty('stopBits')

      // All combinations in a group should have same serial params
      const { baudRate, parity, dataBits, stopBits } = firstGroup.serialParams
      for (const combo of firstGroup.combinations) {
        expect(combo.baudRate).toBe(baudRate)
        expect(combo.parity).toBe(parity)
        expect(combo.dataBits).toBe(dataBits)
        expect(combo.stopBits).toBe(stopBits)
      }

      // All combinations in a group should have different slave IDs
      const slaveIds = firstGroup.combinations.map((c) => c.slaveId)
      expect(new Set(slaveIds).size).toBe(slaveIds.length)
    })

    test('preserves priority order from original generator', () => {
      const defaultConfig: DefaultSerialConfig = {
        baudRate: 19200,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 52,
      }

      const options: GeneratorOptions = {
        strategy: 'quick',
        defaultConfig,
        supportedConfig: {
          validBaudRates: [9600, 19200],
          validParity: ['none', 'even'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 3],
        },
      }

      const groups = Array.from(generateParameterGroups(options))

      // First group should have default serial params (prioritized)
      const firstGroup = groups[0]
      expect(firstGroup.serialParams).toMatchObject({
        baudRate: 19200, // Default
        parity: 'even', // Default
        dataBits: 8,
        stopBits: 1,
      })

      // With range [1,3], defaultAddress 52 is out of range
      // Order should be: 1, 2, 3 (common addresses)
      const firstCombo = firstGroup.combinations[0]
      expect(firstCombo.slaveId).toBe(1)
    })
  })

  describe('count equivalence', () => {
    test('total combinations equals ungrouped generator', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600, 19200],
          validParity: ['none', 'even'],
          validDataBits: [8, 7],
          validStopBits: [1, 2],
          validAddressRange: [1, 10],
        },
      }

      const groups = Array.from(generateParameterGroups(options))
      const totalCombinations = groups.reduce((sum: number, g) => sum + g.combinations.length, 0)

      // 2 baud × 2 parity × 2 data × 2 stop × 10 addresses = 160
      expect(totalCombinations).toBe(160)
    })

    test('contains same combinations as original generator', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600, 19200],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 5],
        },
      }

      // Get all combinations from grouped generator
      const groups = Array.from(generateParameterGroups(options))
      const groupedCombos = groups.flatMap((g) => g.combinations)

      // Get all combinations from original generator
      const originalCombos = Array.from(generateParameterCombinations(options))

      // Should have same count
      expect(groupedCombos.length).toBe(originalCombos.length)

      // Should contain the same combinations (order may differ due to grouping)
      const groupedSet = new Set(groupedCombos.map((c) => JSON.stringify(c)))
      const originalSet = new Set(originalCombos.map((c) => JSON.stringify(c)))

      expect(groupedSet.size).toBe(originalSet.size)
      expect(groupedSet).toEqual(originalSet)

      // Verify slave ID order is preserved within each group
      for (const group of groups) {
        const slaveIds = group.combinations.map((c) => c.slaveId)
        // Slave IDs should be in priority order (default, 1, 2, then sequential)
        // For range [1,5] without default: [1, 2, 3, 4, 5]
        expect(slaveIds).toEqual([1, 2, 3, 4, 5])
      }
    })
  })

  describe('edge cases', () => {
    test('handles single group', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 5],
        },
      }

      const groups = Array.from(generateParameterGroups(options))

      // 1 baud × 1 parity × 1 data × 1 stop = 1 group
      expect(groups).toHaveLength(1)
      expect(groups[0].combinations).toHaveLength(5) // 5 slave IDs
    })

    test('handles single combination', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [52, 52],
        },
      }

      const groups = Array.from(generateParameterGroups(options))

      expect(groups).toHaveLength(1)
      expect(groups[0].combinations).toHaveLength(1)
      expect(groups[0].combinations[0]).toMatchObject({
        slaveId: 52,
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      })
    })

    test('handles thorough strategy', () => {
      const options: GeneratorOptions = {
        strategy: 'thorough',
        supportedConfig: {
          validBaudRates: [9600, 19200, 38400],
          validParity: ['none', 'even', 'odd'],
          validDataBits: [8, 7],
          validStopBits: [1, 2],
          validAddressRange: [1, 10],
        },
      }

      const groups = Array.from(generateParameterGroups(options))

      // 3 baud × 3 parity × 2 data × 2 stop = 36 groups
      expect(groups).toHaveLength(36)

      // Each group should have 10 combinations (slave IDs 1-10)
      for (const group of groups) {
        expect(group.combinations).toHaveLength(10)
      }
    })
  })

  describe('memory efficiency', () => {
    test('does not materialize all combinations at once', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600, 19200],
          validParity: ['none', 'even'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 247], // Large address range
        },
      }

      const generator = generateParameterGroups(options)

      // Get first group
      const firstResult = generator.next()
      expect(firstResult.done).toBe(false)
      expect(firstResult.value?.combinations).toHaveLength(247)

      // At this point, we should NOT have all ~1000 combinations in memory
      // Only the first group's 247 combinations should be materialized
      // This is hard to test directly, but we verify the generator pattern works

      // Get second group
      const secondResult = generator.next()
      expect(secondResult.done).toBe(false)
      expect(secondResult.value?.combinations).toHaveLength(247)

      // Verify we can iterate lazily
      let groupCount = 2 // Already consumed 2 groups above
      for (const _group of generator) {
        groupCount++
      }

      expect(groupCount).toBe(4) // 2 baud × 2 parity = 4 groups total
    })
  })

  describe('slave ID filtering', () => {
    test('filters to specific slave IDs when provided', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
        slaveIds: [1, 5, 10],
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 247],
        },
      }

      const groups = Array.from(generateParameterGroups(options))

      // Should have 1 group (1 serial config)
      expect(groups).toHaveLength(1)

      // Group should only have the 3 filtered IDs
      expect(groups[0].combinations).toHaveLength(3)

      const slaveIds = groups[0].combinations.map((c) => c.slaveId)
      expect(slaveIds).toEqual([1, 5, 10])
    })

    test('prioritizes defaultAddress even when filtering', () => {
      const defaultConfig: DefaultSerialConfig = {
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 10,
      }

      const options: GeneratorOptions = {
        strategy: 'quick',
        defaultConfig,
        slaveIds: [1, 5, 10, 15],
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 247],
        },
      }

      const groups = Array.from(generateParameterGroups(options))
      const slaveIds = groups[0].combinations.map((c) => c.slaveId)

      // defaultAddress (10) should be first, then 1, then 5, 15
      expect(slaveIds[0]).toBe(10)
      expect(slaveIds[1]).toBe(1)
      expect(slaveIds).toEqual([10, 1, 5, 15])
    })

    test('ignores defaultAddress if not in filtered IDs', () => {
      const defaultConfig: DefaultSerialConfig = {
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 42, // Not in filtered list
      }

      const options: GeneratorOptions = {
        strategy: 'quick',
        defaultConfig,
        slaveIds: [1, 5, 10],
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 247],
        },
      }

      const groups = Array.from(generateParameterGroups(options))
      const slaveIds = groups[0].combinations.map((c) => c.slaveId)

      // Should still use filtered IDs, prioritizing 1 first
      expect(slaveIds).toEqual([1, 5, 10])
    })

    test('filters work with multiple serial configs', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
        slaveIds: [1, 2],
        supportedConfig: {
          validBaudRates: [9600, 19200],
          validParity: ['none', 'even'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 247],
        },
      }

      const groups = Array.from(generateParameterGroups(options))

      // Should have 4 groups: 2 baud × 2 parity
      expect(groups).toHaveLength(4)

      // Each group should have only 2 IDs
      for (const group of groups) {
        expect(group.combinations).toHaveLength(2)
        const slaveIds = group.combinations.map((c) => c.slaveId)
        expect(slaveIds).toEqual([1, 2])
      }
    })

    test('empty slaveIds array generates no combinations', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
        slaveIds: [],
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 247],
        },
      }

      const groups = Array.from(generateParameterGroups(options))

      // Should have 1 group but with no combinations
      expect(groups).toHaveLength(1)
      expect(groups[0].combinations).toHaveLength(0)
    })

    test('filters work with generateParameterCombinations', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
        slaveIds: [1, 3, 5],
        supportedConfig: {
          validBaudRates: [9600, 19200],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 247],
        },
      }

      const combinations = Array.from(generateParameterCombinations(options))

      // Should have: 3 IDs × 2 baud rates × 1 parity × 1 data × 1 stop = 6
      expect(combinations).toHaveLength(6)

      // Extract unique slave IDs
      const uniqueIds = [...new Set(combinations.map((c) => c.slaveId))]
      expect(uniqueIds.sort()).toEqual([1, 3, 5])
    })
  })
})
