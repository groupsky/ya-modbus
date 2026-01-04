/**
 * Integration tests for timing behavior with emulator
 * Uses Jest fake timers to make tests deterministic
 */

import { describe, it, expect, afterEach, beforeEach } from '@jest/globals'

import { ModbusEmulator } from '../emulator.js'
import type { MemoryTransport } from '../transports/memory.js'

describe('Timing Behavior Integration', () => {
  let emulator: ModbusEmulator

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(async () => {
    jest.useRealTimers()
    if (emulator) {
      await emulator.stop()
    }
  })

  describe('Command detection delay', () => {
    it('should apply fixed command detection delay', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
        timing: {
          commandDetectionDelay: 50,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      let resolved = false
      // @ts-expect-error - accessing protected method for testing
      const promise = transport.sendRequest(1, request).then(() => {
        resolved = true
      })

      // Should not resolve before delay
      await jest.advanceTimersByTimeAsync(49)
      expect(resolved).toBe(false)

      // Should resolve after delay
      await jest.advanceTimersByTimeAsync(1)
      await promise
      expect(resolved).toBe(true)
    })

    it('should apply polling interval as detection delay', async () => {
      // Mock random to return 0.5, so delay = 0 + 0.5 * (100 - 0) = 50ms
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5)

      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
        timing: {
          pollingInterval: 100,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      let resolved = false
      // @ts-expect-error - accessing protected method for testing
      const promise = transport.sendRequest(1, request).then(() => {
        resolved = true
      })

      // With random=0.5, delay should be 50ms
      await jest.advanceTimersByTimeAsync(49)
      expect(resolved).toBe(false)

      await jest.advanceTimersByTimeAsync(1)
      await promise
      expect(resolved).toBe(true)

      mockRandom.mockRestore()
    })
  })

  describe('Processing delay', () => {
    it('should apply fixed processing delay', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
        timing: {
          processingDelay: 50,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      let resolved = false
      // @ts-expect-error - accessing protected method for testing
      const promise = transport.sendRequest(1, request).then(() => {
        resolved = true
      })

      // Should not resolve before delay
      await jest.advanceTimersByTimeAsync(49)
      expect(resolved).toBe(false)

      // Should resolve after delay
      await jest.advanceTimersByTimeAsync(1)
      await promise
      expect(resolved).toBe(true)
    })

    it('should apply per-register delay', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100, 1: 200, 2: 300 } },
        timing: {
          perRegisterDelay: 20,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport

      // Read 1 register - 20ms delay
      const request1 = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      let resolved1 = false
      // @ts-expect-error - accessing protected method for testing
      const promise1 = transport.sendRequest(1, request1).then(() => {
        resolved1 = true
      })

      await jest.advanceTimersByTimeAsync(19)
      expect(resolved1).toBe(false)

      await jest.advanceTimersByTimeAsync(1)
      await promise1
      expect(resolved1).toBe(true)

      // Read 3 registers - 60ms delay
      const request3 = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x03])
      let resolved3 = false
      // @ts-expect-error - accessing protected method for testing
      const promise3 = transport.sendRequest(1, request3).then(() => {
        resolved3 = true
      })

      await jest.advanceTimersByTimeAsync(59)
      expect(resolved3).toBe(false)

      await jest.advanceTimersByTimeAsync(1)
      await promise3
      expect(resolved3).toBe(true)
    })
  })

  describe('Combined timing components', () => {
    it('should combine detection and processing delays', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
        timing: {
          commandDetectionDelay: 50,
          processingDelay: 50,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      let resolved = false
      // @ts-expect-error - accessing protected method for testing
      const promise = transport.sendRequest(1, request).then(() => {
        resolved = true
      })

      // Should not resolve before combined delay (100ms)
      await jest.advanceTimersByTimeAsync(99)
      expect(resolved).toBe(false)

      // Should resolve after combined delay
      await jest.advanceTimersByTimeAsync(1)
      await promise
      expect(resolved).toBe(true)
    })

    it('should combine all timing components', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
        timing: {
          commandDetectionDelay: 30,
          processingDelay: 20,
          perRegisterDelay: 10,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport

      // Read 5 registers: 30ms detection + 20ms processing + 50ms (5*10) = 100ms
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x05])

      let resolved = false
      // @ts-expect-error - accessing protected method for testing
      const promise = transport.sendRequest(1, request).then(() => {
        resolved = true
      })

      // Should not resolve before combined delay (100ms)
      await jest.advanceTimersByTimeAsync(99)
      expect(resolved).toBe(false)

      // Should resolve after combined delay
      await jest.advanceTimersByTimeAsync(1)
      await promise
      expect(resolved).toBe(true)
    })
  })

  describe('Transmission delay (RTU)', () => {
    it('should calculate transmission delay when enabled', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
        timing: {
          baudRate: 9600,
          autoCalculateTransmissionDelay: true,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      let resolved = false
      // @ts-expect-error - accessing protected method for testing
      const promise = transport.sendRequest(1, request).then(() => {
        resolved = true
      })

      // 6-byte frame at 9600 baud: ~6.875ms
      // Should not resolve immediately
      await jest.advanceTimersByTimeAsync(5)
      expect(resolved).toBe(false)

      // Should resolve after transmission delay
      await jest.advanceTimersByTimeAsync(5)
      await promise
      expect(resolved).toBe(true)
    })

    it('should not add transmission delay when disabled', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
        timing: {
          baudRate: 9600, // Set but not enabled
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      // Should resolve immediately (no delay)
      // @ts-expect-error - accessing protected method for testing
      const promise = transport.sendRequest(1, request)

      // Advance minimal time for microtasks
      await jest.advanceTimersByTimeAsync(0)
      await promise
    })
  })

  describe('Multiple devices with different timing', () => {
    it('should apply different timing to different devices', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })

      // Fast device
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
        timing: {
          processingDelay: 20,
        },
      })

      // Slow device
      emulator.addDevice({
        slaveId: 2,
        registers: { holding: { 0: 200 } },
        timing: {
          processingDelay: 100,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport

      // Test fast device (20ms delay)
      const request1 = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      let resolved1 = false
      // @ts-expect-error - accessing protected method for testing
      const promise1 = transport.sendRequest(1, request1).then(() => {
        resolved1 = true
      })

      await jest.advanceTimersByTimeAsync(19)
      expect(resolved1).toBe(false)

      await jest.advanceTimersByTimeAsync(1)
      await promise1
      expect(resolved1).toBe(true)

      // Test slow device (100ms delay)
      const request2 = Buffer.from([0x02, 0x03, 0x00, 0x00, 0x00, 0x01])
      let resolved2 = false
      // @ts-expect-error - accessing protected method for testing
      const promise2 = transport.sendRequest(2, request2).then(() => {
        resolved2 = true
      })

      await jest.advanceTimersByTimeAsync(99)
      expect(resolved2).toBe(false)

      await jest.advanceTimersByTimeAsync(1)
      await promise2
      expect(resolved2).toBe(true)
    })

    it('should not apply timing to device without timing config', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })

      // Device without timing
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
      })

      // Device with timing
      emulator.addDevice({
        slaveId: 2,
        registers: { holding: { 0: 200 } },
        timing: {
          processingDelay: 100,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport

      // Device without timing - should resolve immediately
      const request1 = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      // @ts-expect-error - accessing protected method for testing
      const promise1 = transport.sendRequest(1, request1)
      await jest.advanceTimersByTimeAsync(0)
      await promise1

      // Device with timing - should wait 100ms
      const request2 = Buffer.from([0x02, 0x03, 0x00, 0x00, 0x00, 0x01])
      let resolved2 = false
      // @ts-expect-error - accessing protected method for testing
      const promise2 = transport.sendRequest(2, request2).then(() => {
        resolved2 = true
      })

      await jest.advanceTimersByTimeAsync(99)
      expect(resolved2).toBe(false)

      await jest.advanceTimersByTimeAsync(1)
      await promise2
      expect(resolved2).toBe(true)
    })
  })

  describe('Realistic device simulation', () => {
    it('should simulate typical power meter behavior', async () => {
      // Seed Math.random for deterministic test
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5)

      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: {
          holding: {
            0: 230, // Voltage
            1: 52, // Current
            2: 1196, // Power
          },
        },
        timing: {
          pollingInterval: 100,
          processingDelay: [20, 50],
          perRegisterDelay: 1,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport

      // Read all 3 power registers
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x03])

      // @ts-expect-error - accessing protected method for testing
      const promise = transport.sendRequest(1, request)

      // With random=0.5:
      // - pollingInterval: 0 + 0.5 * (100 - 0) = 50ms
      // - processingDelay: 20 + 0.5 * (50 - 20) = 35ms
      // - perRegisterDelay: 3 * 1 = 3ms
      // Total: 50 + 35 + 3 = 88ms
      await jest.advanceTimersByTimeAsync(88)
      const response = await promise

      // Verify response is correct
      expect(response[1]).toBe(0x03)
      expect(response.readUInt16BE(3)).toBe(230)
      expect(response.readUInt16BE(5)).toBe(52)
      expect(response.readUInt16BE(7)).toBe(1196)

      mockRandom.mockRestore()
    })

    it('should simulate slow RTU device', async () => {
      // Seed Math.random for deterministic test
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5)

      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { input: { 0: 500 } },
        timing: {
          commandDetectionDelay: [30, 80],
          processingDelay: [20, 50],
          perRegisterDelay: 1,
          baudRate: 9600,
          autoCalculateTransmissionDelay: true,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x04, 0x00, 0x00, 0x00, 0x01])

      // @ts-expect-error - accessing protected method for testing
      const promise = transport.sendRequest(1, request)

      // With random=0.5:
      // - commandDetectionDelay: 30 + 0.5 * (80 - 30) = 55ms
      // - processingDelay: 20 + 0.5 * (50 - 20) = 35ms
      // - perRegisterDelay: 1 * 1 = 1ms
      // - transmission: 6 * 11 / 9.6 ≈ 6.875ms
      // Total: ~98ms
      await jest.advanceTimersByTimeAsync(100)
      const response = await promise

      // Verify response
      expect(response[1]).toBe(0x04)
      expect(response.readUInt16BE(3)).toBe(500)

      mockRandom.mockRestore()
    })
  })

  describe('Delay effectiveness verification', () => {
    it('should verify processing delay makes requests wait', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
        timing: {
          processingDelay: 50,
        },
      })
      await emulator.start()

      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      const transport = emulator.getTransport() as MemoryTransport
      let resolved = false
      // @ts-expect-error - accessing protected method for testing
      const promise = transport.sendRequest(1, request).then(() => {
        resolved = true
      })

      // Verify request doesn't resolve immediately
      await jest.advanceTimersByTimeAsync(0)
      expect(resolved).toBe(false)

      // Verify request resolves after delay
      await jest.advanceTimersByTimeAsync(50)
      await promise
      expect(resolved).toBe(true)
    })

    it('should verify per-register delay scales with register count', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100, 1: 200, 2: 300, 3: 400, 4: 500 } },
        timing: {
          perRegisterDelay: 10,
        },
      })
      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport

      // Read 1 register - 10ms delay
      const request1 = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      let resolved1 = false
      // @ts-expect-error - accessing protected method for testing
      const promise1 = transport.sendRequest(1, request1).then(() => {
        resolved1 = true
      })

      await jest.advanceTimersByTimeAsync(9)
      expect(resolved1).toBe(false)
      await jest.advanceTimersByTimeAsync(1)
      await promise1
      expect(resolved1).toBe(true)

      // Read 5 registers - 50ms delay
      const request5 = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x05])
      let resolved5 = false
      // @ts-expect-error - accessing protected method for testing
      const promise5 = transport.sendRequest(1, request5).then(() => {
        resolved5 = true
      })

      await jest.advanceTimersByTimeAsync(49)
      expect(resolved5).toBe(false)
      await jest.advanceTimersByTimeAsync(1)
      await promise5
      expect(resolved5).toBe(true)
    })

    it('should verify command detection delay works', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
        timing: {
          commandDetectionDelay: 50,
        },
      })
      await emulator.start()

      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      const transport = emulator.getTransport() as MemoryTransport
      let resolved = false
      // @ts-expect-error - accessing protected method for testing
      const promise = transport.sendRequest(1, request).then(() => {
        resolved = true
      })

      // Verify request doesn't resolve before delay
      await jest.advanceTimersByTimeAsync(49)
      expect(resolved).toBe(false)

      // Verify request resolves after delay
      await jest.advanceTimersByTimeAsync(1)
      await promise
      expect(resolved).toBe(true)
    })
  })
})
