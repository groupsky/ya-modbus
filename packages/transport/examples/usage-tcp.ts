#!/usr/bin/env tsx
import { createTransport } from '@ya-modbus/transport'

const host = process.argv[2] ?? '192.168.1.100'
const tcpPort = process.argv[3] ? parseInt(process.argv[3], 10) : undefined

// TCP transport
const transport = await createTransport({
  host,
  ...(tcpPort !== undefined && { port: tcpPort }),
  slaveId: 1,
})

// Read 10 registers starting from address 0
const buffer = await transport.readHoldingRegisters(0, 10)
console.log(buffer.toString('hex'))

// Clean up
await transport.close()
