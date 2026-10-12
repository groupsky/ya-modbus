# @ya-modbus/transport

Modbus transport implementations for RTU (serial) and TCP connections.

## Features

- RTU (RS-485/serial) transport
- TCP/IP transport
- Automatic retry on transient failures
- Survives a lost port (unplugged USB adapter) and opens it again
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

### Lost connections

When a USB serial adapter is unplugged or a TCP connection closes, `modbus-serial` emits a
`close` event, and an `error` event when a write fails. The transports listen for these events,
so the process does not crash. The connection is then lost:

- A request in flight rejects at once. It does not wait for the response timeout.
- Later requests reject at once, without using the port.
- The error has the name `ConnectionLostError` and a message like
  `Connection to /dev/ttyUSB0 lost: port closed`, or
  `Connection to /dev/ttyUSB0 lost: EIO: i/o error, write` when a write failed. The underlying
  error is in `cause`. `code` and `errno` are set only when the underlying error is a Node.js
  system error, for example `ECONNREFUSED` when a TCP connection cannot be opened again.

After a TCP socket error, `modbus-serial` emits no event. The next request fails with the error of
`modbus-serial` (for example `Port Not Open`), and the connection is lost from then on.

Opening a TCP connection takes at most `timeout` ms (the response timeout, default 1000 ms).
When the host does not answer, the open fails with `TCP Connection Timed Out`. Without this
limit it would wait for the TCP timeout of the system (about 2 minutes), and the other devices
on the connection would wait too. On a slow network, or one that loses packets, use a larger
`timeout` (for example 3000).

`createTransport` and `TransportManager` open the port again on a later request. There are no
attempts in the background. The first request 1 second after the loss opens the port again. If
this fails, the next attempt waits 2 seconds, then 4 seconds, and so on, up to 60 seconds.
Requests between the attempts reject with the last error. The delay also doubles when the port
opens but is lost again before a request succeeds. A successful request sets the delay back to
1 second. `TransportManager` opens one new client for all devices on the bus.

`createTransport` and `TransportManager.getTransport()` reject when the port cannot be opened,
for example when a USB adapter is not plugged in. A long-running program can start anyway with
`new TransportManager({ startLost: true })`. Then `getTransport()` returns the transport, and
its connection starts lost with the error of the failed open. Requests reject with a
`ConnectionLostError`, and the port is opened again after the same delays as above.
`getConnectionError(config)` returns the error while the connection is lost, and `undefined`
while it works. The MQTT bridge uses this, so one missing adapter does not stop the other
devices.

A short-lived program, like a CLI command, can stop at the first `ConnectionLostError`.

```typescript
import { isConnectionLostError } from '@ya-modbus/transport'

try {
  await transport.readHoldingRegisters(0, 10)
} catch (error) {
  if (isConnectionLostError(error)) {
    // port is gone, the transport opens it again on a later request
  }
}
```

A USB adapter can get a new name when it is plugged in again (`/dev/ttyUSB0` becomes
`/dev/ttyUSB1`), but the port is opened again with the same path. Use a stable path:

- `/dev/serial/by-id/...` for adapters with a unique serial number.
- `/dev/serial/by-path/...` for adapters without a serial number (many CH340 adapters). This name
  is the physical USB port, so it changes when the adapter moves to another USB port.

To use your own `modbus-serial` client with the same handling, wrap it in a `ModbusConnection`:

```typescript
import { createModbusTransport, ModbusConnection, type OpenClient } from '@ya-modbus/transport'
import ModbusRTU from 'modbus-serial'

// Returns a new connected client
const open: OpenClient = async () => {
  const client = new ModbusRTU()
  await client.connectRTUBuffered('/dev/ttyUSB0', { baudRate: 9600 })
  client.setID(1)
  client.setTimeout(1000)
  return client
}

const connection = new ModbusConnection(await open(), '/dev/ttyUSB0', open)
const transport = createModbusTransport(connection)
```

Without the `open` function, a lost connection works again only when you open the same client
again.

When the first `open()` fails, you can pass its error instead of the client:
`new ModbusConnection(error, '/dev/ttyUSB0', open)`. The connection then starts lost with that
error, and opens the port later in the same way. `connection.error` is the error while the
connection is lost, and `undefined` while it works.

## License

GPL-3.0-or-later
