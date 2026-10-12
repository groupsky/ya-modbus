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
```

## Error handling

Some `modbus-serial` failures (response timeouts, closed port) are plain objects instead of `Error`
instances. Transport read and write methods reject with an `Error` that keeps the diagnostic
properties of the original (the `ModbusError` type). The original value is available as `cause`:

| Property     | Example                    | Meaning                                       |
| ------------ | -------------------------- | --------------------------------------------- |
| `name`       | `TransactionTimedOutError` | Error type reported by `modbus-serial`        |
| `errno`      | `ETIMEDOUT`, `-111`        | Error name or number (timeout, refused, etc.) |
| `code`       | `ECONNREFUSED`             | Node.js error code (TCP socket errors)        |
| `modbusCode` | `2`                        | Exception code returned by the device         |

```typescript
import type { ModbusError } from '@ya-modbus/transport'

try {
  await transport.readHoldingRegisters(0, 10)
} catch (error) {
  if ((error as ModbusError).errno === 'ETIMEDOUT') {
    // device did not answer
  }
}
```

`normalizeModbusError(error)` applies the same conversion to any caught value.

## License

GPL-3.0-or-later
