#!/usr/bin/env tsx
/**
 * API examples for documentation purposes.
 * This file demonstrates how to use the @ya-modbus/emulator package.
 */
import { ModbusEmulator } from '@ya-modbus/emulator'

// Quickstart example
const emulator = new ModbusEmulator({
  transport: 'tcp',
  port: 5502,
})

// Add a device
emulator.addDevice({
  slaveId: 1,
  registers: {
    holding: {
      0: 230, // Voltage * 10 = 23.0V
      1: 52, // Current * 10 = 5.2A
    },
  },
})

// Start emulator
await emulator.start()

// Use with your driver tests
// ...

// Stop emulator
await emulator.stop()

// Timing behaviors - simulate realistic device response times
emulator.addDevice({
  slaveId: 2,
  timing: {
    pollingInterval: 10, // Device checks for commands every 10ms
    commandDetectionDelay: [3, 8], // 3-8ms to notice command
    processingDelay: [2, 5], // 2-5ms to process
    perRegisterDelay: 0.1, // 0.1ms per register
  },
})

// Register Constraints example (planned for v0.2.0)
emulator.addDevice({
  slaveId: 3,
  constraints: {
    maxReadRegisters: 80,
    maxWriteRegisters: 50,
    forbiddenReadRanges: [{ type: 'holding', start: 100, end: 199, reason: 'Protected' }],
  },
})

// Error Simulation example (planned for v0.2.0)
emulator.addDevice({
  slaveId: 4,
  errors: {
    timeoutProbability: 0.05, // 5% timeout rate
    crcErrorProbability: 0.01, // 1% CRC error rate
  },
})
