/**
 * Tests for timing behavior simulation
 */

import { describe, it, expect, beforeEach } from '@jest/globals'

import { calculateDelay, TimingSimulator } from './timing.js'

describe('Timing Behaviors', () => {
  describe('calculateDelay', () => {
    it('should return 0 for undefined delay', () => {
      const delay = calculateDelay(undefined)
      expect(delay).toBe(0)
    })

    it('should return fixed delay value', () => {
      const delay = calculateDelay(10)
      expect(delay).toBe(10)
    })

    it('should return random value within range', () => {
      const min = 5
      const max = 15
      const delay = calculateDelay([min, max])

      expect(delay).toBeGreaterThanOrEqual(min)
      expect(delay).toBeLessThanOrEqual(max)
    })

    it('should handle range with same min/max', () => {
      const delay = calculateDelay([10, 10])
      expect(delay).toBe(10)
    })

    it('should return average for range when seeded', () => {
      // Multiple calls should give different values in range
      const delays = Array.from({ length: 100 }, () => calculateDelay([5, 15]))
      const avg = delays.reduce((sum, d) => sum + d, 0) / delays.length

      // Average should be close to midpoint (10)
      expect(avg).toBeGreaterThan(8)
      expect(avg).toBeLessThan(12)
    })
  })

  describe('TimingSimulator - Command Detection Delay', () => {
    it('should calculate no delay when no timing config', () => {
      const simulator = new TimingSimulator({})
      const delay = simulator.calculateTotalDelay(Buffer.from([0x01, 0x03]), 1)

      expect(delay).toBe(0)
    })

    it('should apply fixed command detection delay', () => {
      const simulator = new TimingSimulator({
        commandDetectionDelay: 5,
      })

      const delay = simulator.calculateTotalDelay(Buffer.from([0x01, 0x03]), 1)
      expect(delay).toBeGreaterThanOrEqual(5)
    })

    it('should apply random command detection delay', () => {
      const simulator = new TimingSimulator({
        commandDetectionDelay: [3, 8],
      })

      const delays = Array.from({ length: 50 }, () =>
        simulator.calculateTotalDelay(Buffer.from([0x01, 0x03]), 1)
      )

      // All delays should be within range
      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(3)
        expect(delay).toBeLessThanOrEqual(8)
      })

      // Should have variation (not all the same)
      const uniqueDelays = new Set(delays)
      expect(uniqueDelays.size).toBeGreaterThan(1)
    })

    it('should use random value in [0, pollingInterval] as detection delay', () => {
      const simulator = new TimingSimulator({
        pollingInterval: 10,
      })

      const delays = Array.from({ length: 50 }, () =>
        simulator.calculateTotalDelay(Buffer.from([0x01, 0x03]), 1)
      )

      // All delays should be within range [0, pollingInterval]
      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(0)
        expect(delay).toBeLessThanOrEqual(10)
      })

      // Should have variation (not all the same)
      const uniqueDelays = new Set(delays)
      expect(uniqueDelays.size).toBeGreaterThan(1)
    })

    it('should prefer commandDetectionDelay over pollingInterval', () => {
      const simulator = new TimingSimulator({
        commandDetectionDelay: 7,
        pollingInterval: 10,
      })

      const delay = simulator.calculateTotalDelay(Buffer.from([0x01, 0x03]), 1)
      expect(delay).toBeGreaterThanOrEqual(7)
    })
  })

  describe('TimingSimulator - Processing Delay', () => {
    it('should apply fixed processing delay', () => {
      const simulator = new TimingSimulator({
        processingDelay: 3,
      })

      const delay = simulator.calculateTotalDelay(Buffer.from([0x01, 0x03]), 1)
      expect(delay).toBeGreaterThanOrEqual(3)
    })

    it('should apply random processing delay', () => {
      const simulator = new TimingSimulator({
        processingDelay: [2, 5],
      })

      const delays = Array.from({ length: 50 }, () =>
        simulator.calculateTotalDelay(Buffer.from([0x01, 0x03]), 1)
      )

      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(2)
        expect(delay).toBeLessThanOrEqual(5)
      })
    })

    it('should apply per-register delay', () => {
      const simulator = new TimingSimulator({
        perRegisterDelay: 0.5,
      })

      // Reading 10 registers should add 5ms (10 * 0.5)
      const delay = simulator.calculateTotalDelay(Buffer.from([0x01, 0x03]), 10)
      expect(delay).toBe(5)
    })

    it('should combine processing delay and per-register delay', () => {
      const simulator = new TimingSimulator({
        processingDelay: 2,
        perRegisterDelay: 0.1,
      })

      // 2ms base + (10 * 0.1ms) = 3ms total
      const delay = simulator.calculateTotalDelay(Buffer.from([0x01, 0x03]), 10)
      expect(delay).toBe(3)
    })
  })

  describe('TimingSimulator - Total Delay Calculation', () => {
    it('should combine detection and processing delays', () => {
      const simulator = new TimingSimulator({
        commandDetectionDelay: 5,
        processingDelay: 3,
      })

      const delay = simulator.calculateTotalDelay(Buffer.from([0x01, 0x03]), 1)
      expect(delay).toBeGreaterThanOrEqual(8) // 5 + 3
    })

    it('should combine all delay components', () => {
      const simulator = new TimingSimulator({
        commandDetectionDelay: 5,
        processingDelay: 2,
        perRegisterDelay: 0.1,
      })

      // 5ms detection + 2ms processing + (10 * 0.1ms) = 8ms total
      const delay = simulator.calculateTotalDelay(Buffer.from([0x01, 0x03]), 10)
      expect(delay).toBeGreaterThanOrEqual(8)
    })

    it('should handle zero register count', () => {
      const simulator = new TimingSimulator({
        processingDelay: 2,
        perRegisterDelay: 0.1,
      })

      const delay = simulator.calculateTotalDelay(Buffer.from([0x01, 0x03]), 0)
      expect(delay).toBe(2) // Only base processing delay
    })
  })

  describe('TimingSimulator - Transmission Delay (RTU)', () => {
    it('should not calculate transmission delay by default', () => {
      const simulator = new TimingSimulator({
        baudRate: 9600,
      })

      const delay = simulator.calculateTotalDelay(Buffer.from([0x01, 0x03]), 1)
      expect(delay).toBe(0)
    })

    it('should calculate transmission delay when enabled', () => {
      const simulator = new TimingSimulator({
        baudRate: 9600,
        autoCalculateTransmissionDelay: true,
      })

      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01]) // 6 bytes
      const delay = simulator.calculateTotalDelay(request, 1)

      // Transmission time = (frameBytes * 11 bits) / (baudRate / 1000)
      // For 6-byte request: (6 * 11) / (9600 / 1000) = 66 / 9.6 ≈ 6.875ms
      expect(delay).toBeGreaterThan(6)
      expect(delay).toBeLessThan(8)
    })

    it('should calculate transmission delay based on baud rate', () => {
      const highBaudSimulator = new TimingSimulator({
        baudRate: 115200,
        autoCalculateTransmissionDelay: true,
      })

      const lowBaudSimulator = new TimingSimulator({
        baudRate: 9600,
        autoCalculateTransmissionDelay: true,
      })

      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      const highBaudDelay = highBaudSimulator.calculateTotalDelay(request, 1)
      const lowBaudDelay = lowBaudSimulator.calculateTotalDelay(request, 1)

      // Higher baud rate should have lower transmission delay
      expect(highBaudDelay).toBeLessThan(lowBaudDelay)
    })

    it('should calculate transmission delay based on frame size', () => {
      const simulator = new TimingSimulator({
        baudRate: 9600,
        autoCalculateTransmissionDelay: true,
      })

      const smallRequest = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      const largeRequest = Buffer.from([
        0x01,
        0x03,
        0x00,
        0x00,
        0x00,
        0x0a, // Read 10 registers
      ])

      const smallDelay = simulator.calculateTotalDelay(smallRequest, 1)
      const largeDelay = simulator.calculateTotalDelay(largeRequest, 10)

      // Larger frame should take longer to transmit
      // Note: This is just request transmission, response would be larger for more registers
      expect(largeDelay).toBeGreaterThanOrEqual(smallDelay)
    })

    it('should combine transmission delay with other delays', () => {
      const simulator = new TimingSimulator({
        commandDetectionDelay: 5,
        processingDelay: 2,
        perRegisterDelay: 0.1,
        baudRate: 9600,
        autoCalculateTransmissionDelay: true,
      })

      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x0a])
      const delay = simulator.calculateTotalDelay(request, 10)

      // Should include:
      // - 5ms detection
      // - 2ms processing
      // - 1ms per-register (10 * 0.1)
      // - ~7ms transmission
      // Total: ~15ms
      expect(delay).toBeGreaterThan(14)
      expect(delay).toBeLessThan(18)
    })
  })

  describe('TimingSimulator - delay() method', () => {
    beforeEach(() => {
      // Use fake timers for these tests
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should resolve immediately for zero delay', async () => {
      const simulator = new TimingSimulator({})
      const promise = simulator.delay(Buffer.from([0x01, 0x03]), 1)

      jest.runAllTimers()
      await expect(promise).resolves.toBeUndefined()
    })

    it('should delay for calculated time', async () => {
      const simulator = new TimingSimulator({
        processingDelay: 10,
      })

      const promise = simulator.delay(Buffer.from([0x01, 0x03]), 1)

      // Should not resolve immediately
      let resolved = false
      void promise.then(() => {
        resolved = true
      })

      expect(resolved).toBe(false)

      // Advance timers by delay amount
      jest.advanceTimersByTime(10)
      await promise

      expect(resolved).toBe(true)
    })

    it('should delay for combined timing components', async () => {
      const simulator = new TimingSimulator({
        commandDetectionDelay: 5,
        processingDelay: 3,
        perRegisterDelay: 0.2,
      })

      const promise = simulator.delay(Buffer.from([0x01, 0x03]), 10)

      // Total delay: 5 + 3 + (10 * 0.2) = 10ms
      let resolved = false
      void promise.then(() => {
        resolved = true
      })

      jest.advanceTimersByTime(9)
      expect(resolved).toBe(false)

      jest.advanceTimersByTime(1)
      await promise
      expect(resolved).toBe(true)
    })
  })

  describe('TimingSimulator - realistic scenarios', () => {
    it('should simulate typical power meter timing', () => {
      const simulator = new TimingSimulator({
        pollingInterval: 10, // 10ms polling
        processingDelay: [2, 5], // 2-5ms processing
        perRegisterDelay: 0.1, // 0.1ms per register
      })

      // Reading 10 registers
      const delay = simulator.calculateTotalDelay(Buffer.from([0x01, 0x03]), 10)

      // Expected: 0-10ms (polling) + 2-5ms (processing) + 1ms (10*0.1)
      // Total: 3-16ms
      expect(delay).toBeGreaterThanOrEqual(3)
      expect(delay).toBeLessThanOrEqual(16)
    })

    it('should simulate slow RTU device at 9600 baud', () => {
      const simulator = new TimingSimulator({
        commandDetectionDelay: [3, 8],
        processingDelay: [2, 5],
        perRegisterDelay: 0.1,
        baudRate: 9600,
        autoCalculateTransmissionDelay: true,
      })

      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x0a])
      const delay = simulator.calculateTotalDelay(request, 10)

      // Expected:
      // - 3-8ms detection
      // - 2-5ms processing
      // - 1ms per-register (10 * 0.1)
      // - ~7ms transmission
      // Total: ~13-21ms
      expect(delay).toBeGreaterThanOrEqual(13)
      expect(delay).toBeLessThanOrEqual(21)
    })

    it('should simulate fast modern device', () => {
      const simulator = new TimingSimulator({
        pollingInterval: 1, // 1ms polling (fast)
        processingDelay: 0.5, // 0.5ms processing
        perRegisterDelay: 0.01, // 0.01ms per register
      })

      const delay = simulator.calculateTotalDelay(Buffer.from([0x01, 0x03]), 50)

      // Expected: 0-1ms (polling) + 0.5ms (processing) + 0.5ms (50*0.01)
      // Total: 1-2ms
      expect(delay).toBeGreaterThanOrEqual(1)
      expect(delay).toBeLessThanOrEqual(2)
    })
  })
})
