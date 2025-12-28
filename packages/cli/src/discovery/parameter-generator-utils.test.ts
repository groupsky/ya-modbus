import { countParameterCombinations } from './parameter-generator-utils.js'
import type { GeneratorOptions } from './parameter-generator.js'

describe('countParameterCombinations', () => {
  describe('quick strategy without driver', () => {
    test('calculates correct count for common parameters', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
      }

      // Quick without driver: 2 baud rates × 3 parity × 1 data bits × 1 stop bits × 247 addresses
      // = 2 × 3 × 1 × 1 × 247 = 1,482
      const count = countParameterCombinations(options)
      expect(count).toBe(1482)
    })
  })

  describe('quick strategy with driver config', () => {
    test('uses driver SUPPORTED_CONFIG to limit combinations', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600, 19200],
          validParity: ['none', 'even'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 10],
        },
      }

      // 2 baud rates × 2 parity × 1 data bits × 1 stop bits × 10 addresses
      // = 2 × 2 × 1 × 1 × 10 = 40
      const count = countParameterCombinations(options)
      expect(count).toBe(40)
    })

    test('uses driver address range', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validAddressRange: [50, 55],
        },
      }

      // Quick with driver config: 2 baud × 3 parity × 2 data × 2 stop × 6 addresses (50-55)
      // Falls back to STANDARD_DATA_BITS and STANDARD_STOP_BITS when supportedConfig exists
      // = 2 × 3 × 2 × 2 × 6 = 144
      const count = countParameterCombinations(options)
      expect(count).toBe(144)
    })
  })

  describe('thorough strategy', () => {
    test('calculates correct count for all standard parameters', () => {
      const options: GeneratorOptions = {
        strategy: 'thorough',
      }

      // Thorough: 8 baud rates × 3 parity × 2 data bits × 2 stop bits × 247 addresses
      // = 8 × 3 × 2 × 2 × 247 = 23,712
      const count = countParameterCombinations(options)
      expect(count).toBe(23712)
    })

    test('respects SUPPORTED_CONFIG even in thorough mode', () => {
      const options: GeneratorOptions = {
        strategy: 'thorough',
        supportedConfig: {
          validBaudRates: [9600, 14400, 19200],
          validParity: ['even', 'none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 247],
        },
      }

      // 3 baud rates × 2 parity × 1 data bits × 1 stop bits × 247 addresses
      // = 3 × 2 × 1 × 1 × 247 = 1,482
      const count = countParameterCombinations(options)
      expect(count).toBe(1482)
    })
  })

  describe('edge cases', () => {
    test('handles single address range', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validAddressRange: [52, 52], // Single address
        },
      }

      // 2 baud × 3 parity × 2 data × 2 stop × 1 address
      // Falls back to STANDARD_DATA_BITS and STANDARD_STOP_BITS when supportedConfig exists
      // = 2 × 3 × 2 × 2 × 1 = 24
      const count = countParameterCombinations(options)
      expect(count).toBe(24)
    })

    test('handles minimal parameter set', () => {
      const options: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 1],
        },
      }

      // 1 × 1 × 1 × 1 × 1 = 1
      const count = countParameterCombinations(options)
      expect(count).toBe(1)
    })
  })

  describe('default config prioritization', () => {
    test('count remains same with DEFAULT_CONFIG (only order changes)', () => {
      const withoutDefault: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600, 19200],
          validAddressRange: [1, 10],
        },
      }

      const withDefault: GeneratorOptions = {
        strategy: 'quick',
        defaultConfig: {
          baudRate: 19200,
          parity: 'even',
          dataBits: 8,
          stopBits: 1,
          defaultAddress: 5,
        },
        supportedConfig: {
          validBaudRates: [9600, 19200],
          validAddressRange: [1, 10],
        },
      }

      // DEFAULT_CONFIG only affects order, not count
      const count1 = countParameterCombinations(withoutDefault)
      const count2 = countParameterCombinations(withDefault)
      expect(count1).toBe(count2)
      // 2 baud × 3 parity × 2 data × 2 stop × 10 addresses
      // Falls back to STANDARD_DATA_BITS and STANDARD_STOP_BITS when supportedConfig exists
      expect(count1).toBe(240)
    })
  })
})
