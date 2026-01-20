# @ya-modbus/transport

Modbus transport implementations for RTU (serial) and TCP connections.

## Features

- RTU (RS-485/serial) transport
- TCP/IP transport
- Automatic retry on transient failures
- Factory for auto-detecting transport type
- TypeScript support

## Installation

```bash
npm install @ya-modbus/transport
```

## Usage

### RTU (serial) transport

<!-- embedme examples/usage-rtu.ts -->

```ts
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
```

### TCP transport

<!-- embedme examples/usage-tcp.ts -->

```ts
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
```

## License

GPL-3.0-or-later
