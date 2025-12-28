import { countParameterCombinations } from './parameter-generator-utils.js'

describe('countParameterCombinations', () => {
  describe('quick strategy', () => {
    test('calculates correct count for common parameters', () => {
      const count = countParameterCombinations({
        strategy: 'quick',
      })

      // Quick: 2 baud rates × 3 parity × 1 data bits × 1 stop bits × 247 addresses
      // = 2 × 3 × 1 × 1 × 247 = 1,482
      expect(count).toBe(1482)
    })
  })

  describe('thorough strategy', () => {
    test('calculates correct count for all standard parameters', () => {
      const count = countParameterCombinations({
        strategy: 'thorough',
      })

      // Thorough: 8 baud rates × 3 parity × 2 data bits × 2 stop bits × 247 addresses
      // = 8 × 3 × 2 × 2 × 247 = 23,712
      expect(count).toBe(23712)
    })
  })
})
