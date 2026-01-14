#!/usr/bin/env tsx
import { createTransport } from '@ya-modbus/transport'

// RTU (serial) transport
const rtuTransport = await createTransport({
  port: '/dev/ttyUSB0',
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
  slaveId: 1,
})

// TCP transport
const tcpTransport = await createTransport({
  host: '192.168.1.100',
  port: 502, // optional, defaults to 502
  slaveId: 1,
})

// Use transport with driver
await rtuTransport.readHoldingRegisters(0, 10)

// Clean up
await rtuTransport.close()
await tcpTransport.close()
