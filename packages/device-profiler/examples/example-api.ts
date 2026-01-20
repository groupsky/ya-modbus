#!/usr/bin/env tsx
import { RegisterType, scanRegisters } from '@ya-modbus/device-profiler'
import { createTransport } from '@ya-modbus/transport'

const port = process.argv[2] ?? '/dev/ttyUSB0'
const slaveId = parseInt(process.argv[3] ?? String(1), 10)

// Create transport with standard Modbus RTU settings
const transport = await createTransport({
  port,
  slaveId,
  baudRate: 9600,
})

// Scan holding registers
await scanRegisters({
  transport,
  type: RegisterType.Holding,
  startAddress: 0,
  endAddress: 100,
  batchSize: 10,
  onResult: (result) => {
    console.log(result)
  },
})

// Close transport to allow process to exit
await transport.close()
