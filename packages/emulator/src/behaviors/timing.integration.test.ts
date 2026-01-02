/**
 * Integration tests for timing behavior with emulator
 */

import { describe, it, expect, afterEach } from '@jest/globals'

import { ModbusEmulator } from '../emulator.js'
import type { MemoryTransport } from '../transports/memory.js'

describe('Timing Behavior Integration', () => {
  let emulator: ModbusEmulator

  afterEach(async () => {
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
          commandDetectionDelay: 10,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      const start = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request)
      const elapsed = Date.now() - start

      // Should take at least 10ms due to command detection delay
      expect(elapsed).toBeGreaterThanOrEqual(9) // Allow 1ms tolerance
    })

    it('should apply polling interval as detection delay', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
        timing: {
          pollingInterval: 20,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      const start = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request)
      const elapsed = Date.now() - start

      // Should take at least pollingInterval/2 = 10ms
      expect(elapsed).toBeGreaterThanOrEqual(9)
    })
  })

  describe('Processing delay', () => {
    it('should apply fixed processing delay', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
        timing: {
          processingDelay: 5,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      const start = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(4)
    })

    it('should apply per-register delay', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100, 1: 200, 2: 300 } },
        timing: {
          perRegisterDelay: 2,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport

      // Read 1 register - 2ms delay
      const request1 = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      const start1 = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request1)
      const elapsed1 = Date.now() - start1

      // Read 3 registers - 6ms delay
      const request3 = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x03])
      const start3 = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request3)
      const elapsed3 = Date.now() - start3

      expect(elapsed1).toBeGreaterThanOrEqual(1)
      expect(elapsed3).toBeGreaterThanOrEqual(5)
      // Note: Not comparing elapsed3 vs elapsed1 due to timing measurement unreliability
    })
  })

  describe('Combined timing components', () => {
    it('should combine detection and processing delays', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
        timing: {
          commandDetectionDelay: 5,
          processingDelay: 5,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      const start = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request)
      const elapsed = Date.now() - start

      // Should take at least 10ms (5 + 5)
      expect(elapsed).toBeGreaterThanOrEqual(9)
    })

    it('should combine all timing components', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
        timing: {
          commandDetectionDelay: 3,
          processingDelay: 2,
          perRegisterDelay: 1,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport

      // Read 5 registers: 3ms detection + 2ms processing + 5ms (5*1) = 10ms
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x05])

      const start = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(9)
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

      const start = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request)
      const elapsed = Date.now() - start

      // 6-byte frame at 9600 baud: ~6.875ms
      expect(elapsed).toBeGreaterThanOrEqual(6)
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

      const start = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request)
      const elapsed = Date.now() - start

      // Should be very fast (< 5ms)
      expect(elapsed).toBeLessThan(5)
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
          processingDelay: 2,
        },
      })

      // Slow device
      emulator.addDevice({
        slaveId: 2,
        registers: { holding: { 0: 200 } },
        timing: {
          processingDelay: 10,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      // Fast device
      const start1 = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request)
      const elapsed1 = Date.now() - start1

      // Slow device (update slave ID in request)
      const slowRequest = Buffer.from([0x02, 0x03, 0x00, 0x00, 0x00, 0x01])
      const start2 = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(2, slowRequest)
      const elapsed2 = Date.now() - start2

      expect(elapsed1).toBeGreaterThanOrEqual(1)
      expect(elapsed2).toBeGreaterThanOrEqual(9)
      expect(elapsed2).toBeGreaterThan(elapsed1)
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
          processingDelay: 10,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport

      // Device without timing - should be fast
      const request1 = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      const start1 = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request1)
      const elapsed1 = Date.now() - start1

      // Device with timing - should be slow
      const request2 = Buffer.from([0x02, 0x03, 0x00, 0x00, 0x00, 0x01])
      const start2 = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(2, request2)
      const elapsed2 = Date.now() - start2

      expect(elapsed1).toBeLessThan(5)
      expect(elapsed2).toBeGreaterThanOrEqual(9)
    })
  })

  describe('Realistic device simulation', () => {
    it('should simulate typical power meter behavior', async () => {
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
          pollingInterval: 10,
          processingDelay: [2, 5],
          perRegisterDelay: 0.1,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport

      // Read all 3 power registers
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x03])

      const start = Date.now()
      // @ts-expect-error - accessing protected method for testing
      const response = await transport.sendRequest(1, request)
      const elapsed = Date.now() - start

      // Verify response is correct
      expect(response[1]).toBe(0x03)
      expect(response.readUInt16BE(3)).toBe(230)
      expect(response.readUInt16BE(5)).toBe(52)
      expect(response.readUInt16BE(7)).toBe(1196)

      // Expected timing: 5ms (polling/2) + 2-5ms (processing) + 0.3ms (3*0.1)
      // Total: 7.3-10.3ms
      expect(elapsed).toBeGreaterThanOrEqual(7)
      expect(elapsed).toBeLessThan(12)
    })

    it('should simulate slow RTU device', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      emulator.addDevice({
        slaveId: 1,
        registers: { input: { 0: 500 } },
        timing: {
          commandDetectionDelay: [3, 8],
          processingDelay: [2, 5],
          perRegisterDelay: 0.1,
          baudRate: 9600,
          autoCalculateTransmissionDelay: true,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x04, 0x00, 0x00, 0x00, 0x01])

      const start = Date.now()
      // @ts-expect-error - accessing protected method for testing
      const response = await transport.sendRequest(1, request)
      const elapsed = Date.now() - start

      // Verify response
      expect(response[1]).toBe(0x04)
      expect(response.readUInt16BE(3)).toBe(500)

      // Expected: 3-8ms (detection) + 2-5ms (processing) + 0.1ms (1 reg) + ~6.875ms (transmission)
      // Total: ~12-20ms
      expect(elapsed).toBeGreaterThanOrEqual(11)
      expect(elapsed).toBeLessThan(22)
    })
  })
})
