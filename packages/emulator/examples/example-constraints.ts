#!/usr/bin/env tsx
/**
 * Register Constraints example
 * Note: This feature is planned for v0.2.0
 */
import { ModbusEmulator } from '@ya-modbus/emulator'

const emulator = new ModbusEmulator({
  transport: 'tcp',
  port: 5502,
})

// Coming in v0.2.0
emulator.addDevice({
  slaveId: 1,
  constraints: {
    maxReadRegisters: 80,
    maxWriteRegisters: 50,
    forbiddenReadRanges: [{ type: 'holding', start: 100, end: 199, reason: 'Protected' }],
  },
})
