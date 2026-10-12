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

  it.each([
    { name: 'Read Coils (0x01)', request: [0x01, 0x01, 0x00, 0x00, 0x00, 0x08], count: 8 },
    {
      name: 'Read Discrete Inputs (0x02)',
      request: [0x01, 0x02, 0x00, 0x00, 0x00, 0x0c],
      count: 12,
    },
    { name: 'Write Single Coil (0x05)', request: [0x01, 0x05, 0x00, 0x00, 0xff, 0x00], count: 1 },
    {
      name: 'Write Multiple Coils (0x0F)',
      request: [0x01, 0x0f, 0x00, 0x00, 0x00, 0x0a, 0x02],
      count: 10,
    },
  ])('should count the coils or discrete inputs of $name', ({ request, count }) => {
    const parseRegisterCount = (emulator as any).parseRegisterCount.bind(emulator)

    expect(parseRegisterCount(Buffer.from(request))).toBe(count)
  })
})
