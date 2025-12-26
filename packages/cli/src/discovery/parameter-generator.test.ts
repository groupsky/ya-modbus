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
