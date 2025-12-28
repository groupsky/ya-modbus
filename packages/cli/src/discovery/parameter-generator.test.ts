import { generateParameterCombinations, generateParameterGroups } from './parameter-generator.js'

describe('generateParameterCombinations', () => {
  describe('quick strategy', () => {
    test('generates combinations from common Modbus parameters', () => {
      const combinations = Array.from(
        generateParameterCombinations({
          strategy: 'quick',
        })
      )

      // Quick strategy: 2 baud rates × 3 parity × 1 data bits × 1 stop bits × 247 addresses = 1,482
      expect(combinations).toHaveLength(1482)

      // Check first combination (slave ID 1)
      expect(combinations[0]).toEqual({
        slaveId: 1,
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      })

      // Verify all combinations are unique
      const uniqueCombos = new Set(combinations.map((c) => JSON.stringify(c)))
      expect(uniqueCombos.size).toBe(1482)
    })

    test('orders slave IDs by commonality (1, 2, then sequential)', () => {
      const combinations = Array.from(
        generateParameterCombinations({
          strategy: 'quick',
        })
      )

      // Check first few slave IDs for first serial config (9600, none, 8, 1)
      const firstSerialConfig = combinations.filter(
        (c) => c.baudRate === 9600 && c.parity === 'none' && c.dataBits === 8 && c.stopBits === 1
      )

      expect(firstSerialConfig[0].slaveId).toBe(1) // Most common
      expect(firstSerialConfig[1].slaveId).toBe(2) // Second most common
      expect(firstSerialConfig[2].slaveId).toBe(3) // Sequential
      expect(firstSerialConfig[3].slaveId).toBe(4)
    })
  })

  describe('thorough strategy', () => {
    test('generates all standard Modbus parameter combinations', () => {
      const combinations = Array.from(
        generateParameterCombinations({
          strategy: 'thorough',
        })
      )

      // Thorough: 8 baud rates × 3 parity × 2 data bits × 2 stop bits × 247 addresses = 23,712
      expect(combinations).toHaveLength(23712)

      // Verify all combinations are unique
      const uniqueCombos = new Set(combinations.map((c) => JSON.stringify(c)))
      expect(uniqueCombos.size).toBe(23712)
    })

    test('includes all standard baud rates', () => {
      const combinations = Array.from(
        generateParameterCombinations({
          strategy: 'thorough',
        })
      )

      const baudRates = new Set(combinations.map((c) => c.baudRate))
      expect(baudRates).toEqual(new Set([2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200]))
    })

    test('includes all standard parity options', () => {
      const combinations = Array.from(
        generateParameterCombinations({
          strategy: 'thorough',
        })
      )

      const parities = new Set(combinations.map((c) => c.parity))
      expect(parities).toEqual(new Set(['none', 'even', 'odd']))
    })
  })

  describe('slave ID range', () => {
    test('generates all slave IDs from 1 to 247', () => {
      const combinations = Array.from(
        generateParameterCombinations({
          strategy: 'quick',
        })
      )

      // Get slave IDs from first serial config
      const firstSerialConfig = combinations.filter(
        (c) => c.baudRate === 9600 && c.parity === 'none' && c.dataBits === 8 && c.stopBits === 1
      )

      const slaveIds = firstSerialConfig.map((c) => c.slaveId).sort((a, b) => a - b)
      expect(slaveIds).toHaveLength(247)
      expect(slaveIds[0]).toBe(1)
      expect(slaveIds[246]).toBe(247)
    })
  })
})

describe('generateParameterGroups', () => {
  describe('basic grouping', () => {
    test('groups combinations by serial parameters', () => {
      const groups = Array.from(
        generateParameterGroups({
          strategy: 'quick',
        })
      )

      // Quick: 2 baud rates × 3 parity × 1 data bits × 1 stop bits = 6 groups
      expect(groups).toHaveLength(6)

      // Each group should have all 247 slave IDs
      groups.forEach((group) => {
        expect(group.combinations).toHaveLength(247)
      })

      // Check first group
      expect(groups[0].serialParams).toEqual({
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      })
    })

    test('preserves slave ID priority order within groups', () => {
      const groups = Array.from(
        generateParameterGroups({
          strategy: 'quick',
        })
      )

      // Check first group's slave ID order
      const slaveIds = groups[0].combinations.map((c) => c.slaveId)
      expect(slaveIds[0]).toBe(1)
      expect(slaveIds[1]).toBe(2)
      expect(slaveIds[2]).toBe(3)
    })
  })

  describe('count equivalence', () => {
    test('total combinations equals ungrouped generator', () => {
      const grouped = Array.from(
        generateParameterGroups({
          strategy: 'quick',
        })
      )
      const ungrouped = Array.from(
        generateParameterCombinations({
          strategy: 'quick',
        })
      )

      const totalGroupedCombos = grouped.reduce((sum, g) => sum + g.combinations.length, 0)
      expect(totalGroupedCombos).toBe(ungrouped.length)
    })

    test('contains same combinations as original generator', () => {
      const grouped = Array.from(
        generateParameterGroups({
          strategy: 'quick',
        })
      )
      const ungrouped = Array.from(
        generateParameterCombinations({
          strategy: 'quick',
        })
      )

      // Flatten all groups
      const allGroupedCombos = grouped.flatMap((g) => g.combinations)

      // Compare as JSON sets
      const groupedSet = new Set(allGroupedCombos.map((c) => JSON.stringify(c)))
      const ungroupedSet = new Set(ungrouped.map((c) => JSON.stringify(c)))

      expect(groupedSet).toEqual(ungroupedSet)
    })
  })

  describe('edge cases', () => {
    test('handles thorough strategy', () => {
      const groups = Array.from(
        generateParameterGroups({
          strategy: 'thorough',
        })
      )

      // Thorough: 8 baud rates × 3 parity × 2 data bits × 2 stop bits = 96 groups
      expect(groups).toHaveLength(96)

      // Each group should have all 247 slave IDs
      groups.forEach((group) => {
        expect(group.combinations).toHaveLength(247)
      })
    })
  })

  describe('memory efficiency', () => {
    test('does not materialize all combinations at once', () => {
      // Get generator (doesn't execute yet)
      const generator = generateParameterGroups({
        strategy: 'thorough',
      })

      // Get first group
      const first = generator.next()
      expect(first.done).toBe(false)
      expect(first.value?.combinations).toHaveLength(247)

      // Generator can continue
      const second = generator.next()
      expect(second.done).toBe(false)
    })
  })
})
