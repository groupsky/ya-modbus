/**
 * Tests for package exports
 */

import { describe, it, expect } from '@jest/globals'

import { ModbusEmulator, EmulatedDevice } from './index.js'

describe('Package exports', () => {
  it('should export ModbusEmulator', () => {
    expect(ModbusEmulator).toBeDefined()
    expect(typeof ModbusEmulator).toBe('function')
  })

  it('should export EmulatedDevice', () => {
    expect(EmulatedDevice).toBeDefined()
    expect(typeof EmulatedDevice).toBe('function')
  })

  it('should be able to create ModbusEmulator instance', () => {
    const emulator = new ModbusEmulator({ transport: 'memory' })
    expect(emulator).toBeInstanceOf(ModbusEmulator)
  })

  it('should be able to create EmulatedDevice instance', () => {
    const device = new EmulatedDevice({ slaveId: 1 })
    expect(device).toBeInstanceOf(EmulatedDevice)
  })
})
