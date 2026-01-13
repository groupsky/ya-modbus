#!/usr/bin/env tsx
import { ModbusEmulator } from '@ya-modbus/emulator'

// Create emulator with TCP transport
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
