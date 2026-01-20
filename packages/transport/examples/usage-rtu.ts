#!/usr/bin/env tsx
import { createTransport } from '@ya-modbus/transport'

const port = process.argv[2] ?? '/dev/ttyUSB0'

// RTU (serial) transport
const transport = await createTransport({
  port,
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  slaveId: 1,
})

// Read 10 registers starting from address 0
const buffer = await transport.readHoldingRegisters(0, 10)
console.log(buffer.toString('hex'))

// Clean up
await transport.close()
