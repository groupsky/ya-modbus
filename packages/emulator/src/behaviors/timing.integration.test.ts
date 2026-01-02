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
          commandDetectionDelay: 50,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      const start = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request)
      const elapsed = Date.now() - start

      // Should take at least 50ms due to command detection delay
      expect(elapsed).toBeGreaterThanOrEqual(45) // Allow 5ms tolerance
    })

    it('should apply polling interval as detection delay', async () => {
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

      const start = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request)
      const elapsed = Date.now() - start

      // Should be in range [0, pollingInterval] = [0, 100]ms
      expect(elapsed).toBeGreaterThanOrEqual(0)
      expect(elapsed).toBeLessThan(110)
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

      const start = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(45)
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
      const start1 = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request1)
      const elapsed1 = Date.now() - start1

      // Read 3 registers - 60ms delay
      const request3 = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x03])
      const start3 = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request3)
      const elapsed3 = Date.now() - start3

      expect(elapsed1).toBeGreaterThanOrEqual(15)
      expect(elapsed3).toBeGreaterThanOrEqual(55)
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
          commandDetectionDelay: 50,
          processingDelay: 50,
        },
      })

      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      const start = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request)
      const elapsed = Date.now() - start

      // Should take at least 100ms (50 + 50)
      expect(elapsed).toBeGreaterThanOrEqual(95)
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

      const start = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request)
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(95)
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

      expect(elapsed1).toBeGreaterThanOrEqual(15)
      expect(elapsed2).toBeGreaterThanOrEqual(95)
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
          processingDelay: 100,
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

      expect(elapsed1).toBeLessThan(10)
      expect(elapsed2).toBeGreaterThanOrEqual(95)
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
          pollingInterval: 100,
          processingDelay: [20, 50],
          perRegisterDelay: 1,
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

      // Expected timing: 0-100ms (polling) + 20-50ms (processing) + 3ms (3*1)
      // Total: 23-153ms
      expect(elapsed).toBeGreaterThanOrEqual(20)
      expect(elapsed).toBeLessThan(160)
    })

    it('should simulate slow RTU device', async () => {
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

      const start = Date.now()
      // @ts-expect-error - accessing protected method for testing
      const response = await transport.sendRequest(1, request)
      const elapsed = Date.now() - start

      // Verify response
      expect(response[1]).toBe(0x04)
      expect(response.readUInt16BE(3)).toBe(500)

      // Expected: 30-80ms (detection) + 20-50ms (processing) + 1ms (1 reg) + ~7ms (transmission)
      // Total: ~58-138ms
      expect(elapsed).toBeGreaterThanOrEqual(55)
      expect(elapsed).toBeLessThan(145)
    })
  })

  describe('Delay effectiveness verification', () => {
    it('should verify processing delay makes requests slower', async () => {
      // Device without delay
      const emulatorFast = new ModbusEmulator({ transport: 'memory' })
      emulatorFast.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
      })
      await emulatorFast.start()

      // Device with delay
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

      // Measure fast device
      const transportFast = emulatorFast.getTransport() as MemoryTransport
      const startFast = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transportFast.sendRequest(1, request)
      const elapsedFast = Date.now() - startFast

      // Measure slow device
      const transportSlow = emulator.getTransport() as MemoryTransport
      const startSlow = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transportSlow.sendRequest(1, request)
      const elapsedSlow = Date.now() - startSlow

      // Without delay should be very fast (< 10ms)
      expect(elapsedFast).toBeLessThan(10)

      // With delay should take at least 50ms
      expect(elapsedSlow).toBeGreaterThanOrEqual(45)

      // Delay should make a measurable difference
      expect(elapsedSlow).toBeGreaterThan(elapsedFast + 40)

      await emulatorFast.stop()
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

      // Read 1 register
      const request1 = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      const start1 = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request1)
      const elapsed1 = Date.now() - start1

      // Read 5 registers
      const request5 = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x05])
      const start5 = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transport.sendRequest(1, request5)
      const elapsed5 = Date.now() - start5

      // 1 register: ~10ms
      expect(elapsed1).toBeGreaterThanOrEqual(8)
      expect(elapsed1).toBeLessThan(20)

      // 5 registers: ~50ms
      expect(elapsed5).toBeGreaterThanOrEqual(45)
      expect(elapsed5).toBeLessThan(65)

      // 5 registers should take significantly longer than 1 register
      expect(elapsed5).toBeGreaterThan(elapsed1 + 30)
    })

    it('should verify command detection delay works', async () => {
      // Device without detection delay
      const emulatorFast = new ModbusEmulator({ transport: 'memory' })
      emulatorFast.addDevice({
        slaveId: 1,
        registers: { holding: { 0: 100 } },
      })
      await emulatorFast.start()

      // Device with detection delay
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

      // Measure without detection delay
      const transportFast = emulatorFast.getTransport() as MemoryTransport
      const startFast = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transportFast.sendRequest(1, request)
      const elapsedFast = Date.now() - startFast

      // Measure with detection delay
      const transportSlow = emulator.getTransport() as MemoryTransport
      const startSlow = Date.now()
      // @ts-expect-error - accessing protected method for testing
      await transportSlow.sendRequest(1, request)
      const elapsedSlow = Date.now() - startSlow

      // Without delay should be very fast
      expect(elapsedFast).toBeLessThan(10)

      // With delay should take at least 50ms
      expect(elapsedSlow).toBeGreaterThanOrEqual(45)

      // Delay should make a measurable difference
      expect(elapsedSlow).toBeGreaterThan(elapsedFast + 40)

      await emulatorFast.stop()
    })
  })
})
