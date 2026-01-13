#!/usr/bin/env tsx
import { ModbusEmulator } from '@ya-modbus/emulator'

const emulator = new ModbusEmulator({
  transport: 'tcp',
  port: 5502,
})

// Timing behaviors - simulate realistic device response times
emulator.addDevice({
  slaveId: 1,
  timing: {
    pollingInterval: 10, // Device checks for commands every 10ms
    commandDetectionDelay: [3, 8], // 3-8ms to notice command
    processingDelay: [2, 5], // 2-5ms to process
    perRegisterDelay: 0.1, // 0.1ms per register
  },
})
