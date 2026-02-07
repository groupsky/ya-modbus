/**
 * Tests for ModbusEmulator verbose logging integration
 */

import { ModbusEmulator } from './emulator.js'
import type { MemoryTransport } from './transports/memory.js'

describe('ModbusEmulator verbose logging', () => {
  let emulator: ModbusEmulator
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(async () => {
    if (emulator) {
      await emulator.stop()
    }
    consoleLogSpy.mockRestore()
  })

  describe('with verbose logger disabled', () => {
    test('does not log operations when logger is disabled', async () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      const device = emulator.addDevice({ slaveId: 1 })
      device.setHoldingRegister(0, 0x1234)
      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      await transport.sendRequest(1, request)

      const verboseCalls = consoleLogSpy.mock.calls.filter((call) =>
        String(call[0]).includes('[VERBOSE]')
      )
      expect(verboseCalls).toHaveLength(0)
    })
  })

  describe('with verbose logger enabled', () => {
    test('logs read holding registers operation', async () => {
      emulator = new ModbusEmulator({ transport: 'memory', verbose: true })
      const device = emulator.addDevice({ slaveId: 1 })
      device.setHoldingRegister(0, 0x1234)
      device.setHoldingRegister(1, 0x5678)
      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x02])
      await transport.sendRequest(1, request)

      const verboseCalls = consoleLogSpy.mock.calls.filter((call) =>
        String(call[0]).includes('[VERBOSE]')
      )
      expect(verboseCalls.length).toBeGreaterThan(0)
      const output = String(verboseCalls[0]?.[0])
      expect(output).toContain('READ')
      expect(output).toContain('slave=1')
      expect(output).toContain('func=0x03')
      expect(output).toContain('addr=0x0000')
      expect(output).toContain('count=2')
      expect(output).toContain('values=[0x1234, 0x5678]')
    })

    test('logs read input registers operation', async () => {
      emulator = new ModbusEmulator({ transport: 'memory', verbose: true })
      const device = emulator.addDevice({ slaveId: 1 })
      device.setInputRegister(0, 0xabcd)
      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x04, 0x00, 0x00, 0x00, 0x01])
      await transport.sendRequest(1, request)

      const verboseCalls = consoleLogSpy.mock.calls.filter((call) =>
        String(call[0]).includes('[VERBOSE]')
      )
      expect(verboseCalls.length).toBeGreaterThan(0)
      const output = String(verboseCalls[0]?.[0])
      expect(output).toContain('READ')
      expect(output).toContain('func=0x04')
      expect(output).toContain('values=[0xABCD]')
    })

    test('logs write single register operation', async () => {
      emulator = new ModbusEmulator({ transport: 'memory', verbose: true })
      emulator.addDevice({ slaveId: 1 })
      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x06, 0x00, 0x05, 0x12, 0x34])
      await transport.sendRequest(1, request)

      const verboseCalls = consoleLogSpy.mock.calls.filter((call) =>
        String(call[0]).includes('[VERBOSE]')
      )
      expect(verboseCalls.length).toBeGreaterThan(0)
      const output = String(verboseCalls[0]?.[0])
      expect(output).toContain('WRITE')
      expect(output).toContain('func=0x06')
      expect(output).toContain('addr=0x0005')
      expect(output).toContain('values=[0x1234]')
    })

    test('logs write multiple registers operation', async () => {
      emulator = new ModbusEmulator({ transport: 'memory', verbose: true })
      emulator.addDevice({ slaveId: 1 })
      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([
        0x01, 0x10, 0x00, 0x10, 0x00, 0x02, 0x04, 0x11, 0x11, 0x22, 0x22,
      ])
      await transport.sendRequest(1, request)

      const verboseCalls = consoleLogSpy.mock.calls.filter((call) =>
        String(call[0]).includes('[VERBOSE]')
      )
      expect(verboseCalls.length).toBeGreaterThan(0)
      const output = String(verboseCalls[0]?.[0])
      expect(output).toContain('WRITE')
      expect(output).toContain('func=0x10')
      expect(output).toContain('addr=0x0010')
      expect(output).toContain('values=[0x1111, 0x2222]')
    })

    test('logs operations for multiple devices', async () => {
      emulator = new ModbusEmulator({ transport: 'memory', verbose: true })
      const device1 = emulator.addDevice({ slaveId: 1 })
      const device2 = emulator.addDevice({ slaveId: 2 })
      device1.setHoldingRegister(0, 0x1111)
      device2.setHoldingRegister(0, 0x2222)
      await emulator.start()

      const transport = emulator.getTransport() as MemoryTransport
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])

      await transport.sendRequest(1, request)
      await transport.sendRequest(2, Buffer.from([0x02, 0x03, 0x00, 0x00, 0x00, 0x01]))

      const verboseCalls = consoleLogSpy.mock.calls.filter((call) =>
        String(call[0]).includes('[VERBOSE]')
      )
      expect(verboseCalls.length).toBe(2)
      const output1 = String(verboseCalls[0]?.[0])
      const output2 = String(verboseCalls[1]?.[0])
      expect(output1).toContain('slave=1')
      expect(output1).toContain('values=[0x1111]')
      expect(output2).toContain('slave=2')
      expect(output2).toContain('values=[0x2222]')
    })
  })

  describe('getVerboseLogger', () => {
    test('returns verbose logger instance', () => {
      emulator = new ModbusEmulator({ transport: 'memory', verbose: true })
      const logger = emulator.getVerboseLogger()
      expect(logger).toBeDefined()
    })

    test('returns undefined when verbose is disabled', () => {
      emulator = new ModbusEmulator({ transport: 'memory' })
      const logger = emulator.getVerboseLogger()
      expect(logger).toBeUndefined()
    })
  })
})
