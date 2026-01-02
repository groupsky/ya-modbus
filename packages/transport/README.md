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

```typescript
import { createModbusTransport } from '@ya-modbus/transport'

// Auto-detect RTU vs TCP based on connection string
const transport = await createModbusTransport('/dev/ttyUSB0', 9600, 1)
// or
const transport = await createModbusTransport('192.168.1.100:502', 0, 1)

// Use transport with driver
await transport.readHoldingRegisters(0, 10)
```

## License

GPL-3.0-or-later
