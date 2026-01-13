#!/usr/bin/env tsx
/**
 * Error Simulation example
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
  errors: {
    timeoutProbability: 0.05, // 5% timeout rate
    crcErrorProbability: 0.01, // 1% CRC error rate
  },
})
