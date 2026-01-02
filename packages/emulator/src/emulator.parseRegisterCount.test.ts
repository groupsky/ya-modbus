/**
 * Tests for parseRegisterCount method in ModbusEmulator
 */

import { describe, it, expect } from '@jest/globals'

import { ModbusEmulator } from './emulator.js'

describe('ModbusEmulator - parseRegisterCount', () => {
  let emulator: ModbusEmulator

  beforeEach(() => {
    emulator = new ModbusEmulator({ transport: 'memory' })
  })

  it('should return 0 for short request', () => {
    // Access private method via type assertion for testing
    const parseRegisterCount = (emulator as any).parseRegisterCount.bind(emulator)

    const shortRequest = Buffer.from([0x01, 0x03]) // Only 2 bytes
    expect(parseRegisterCount(shortRequest)).toBe(0)
  })

  it('should parse register count for Read Holding Registers (0x03)', () => {
    const parseRegisterCount = (emulator as any).parseRegisterCount.bind(emulator)

    // Read 5 holding registers
    const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x05])
    expect(parseRegisterCount(request)).toBe(5)
  })

  it('should parse register count for Read Input Registers (0x04)', () => {
    const parseRegisterCount = (emulator as any).parseRegisterCount.bind(emulator)

    // Read 10 input registers
    const request = Buffer.from([0x01, 0x04, 0x00, 0x00, 0x00, 0x0a])
    expect(parseRegisterCount(request)).toBe(10)
  })

  it('should return 1 for Write Single Register (0x06)', () => {
    const parseRegisterCount = (emulator as any).parseRegisterCount.bind(emulator)

    // Write single register
    const request = Buffer.from([0x01, 0x06, 0x00, 0x00, 0x01, 0x2c])
    expect(parseRegisterCount(request)).toBe(1)
  })

  it('should parse register count for Write Multiple Registers (0x10)', () => {
    const parseRegisterCount = (emulator as any).parseRegisterCount.bind(emulator)

    // Write 3 multiple registers
    const request = Buffer.from([0x01, 0x10, 0x00, 0x00, 0x00, 0x03, 0x06])
    expect(parseRegisterCount(request)).toBe(3)
  })

  it('should return 0 for unknown function code', () => {
    const parseRegisterCount = (emulator as any).parseRegisterCount.bind(emulator)

    // Unknown function code 0x99
    const request = Buffer.from([0x01, 0x99, 0x00, 0x00, 0x00, 0x01])
    expect(parseRegisterCount(request)).toBe(0)
  })

  it('should handle Read Coils (0x01) - unsupported but valid', () => {
    const parseRegisterCount = (emulator as any).parseRegisterCount.bind(emulator)

    // Read Coils - not yet implemented in emulator but valid Modbus
    const request = Buffer.from([0x01, 0x01, 0x00, 0x00, 0x00, 0x08])
    expect(parseRegisterCount(request)).toBe(0) // Returns 0 for unhandled codes
  })

  it('should handle Write Single Coil (0x05) - unsupported but valid', () => {
    const parseRegisterCount = (emulator as any).parseRegisterCount.bind(emulator)

    // Write Single Coil - not yet implemented
    const request = Buffer.from([0x01, 0x05, 0x00, 0x00, 0xff, 0x00])
    expect(parseRegisterCount(request)).toBe(0) // Returns 0 for unhandled codes
  })
})
