# @ya-modbus/transport

Modbus transport implementations for RTU (serial) and TCP connections.

## Features

- RTU (RS-485/serial) transport
- TCP/IP transport
- Automatic retry on transient failures
- Survives a lost port (unplugged USB adapter) and opens it again
- Shares one connection between the devices on a bus, and closes it when the last one is removed
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

## Several devices on one connection

`TransportManager` shares one connection between the devices on a serial port with the same
serial settings, or on the same TCP host and port. The requests of these devices run one at a
time.

```typescript
import { TransportManager } from '@ya-modbus/transport'

const manager = new TransportManager()
const bus = {
  port: '/dev/ttyUSB0',
  baudRate: 9600,
  dataBits: 8,
  parity: 'none',
  stopBits: 1,
} as const

// Both devices use one open serial port
const meter = await manager.getTransport({ ...bus, slaveId: 1 })
const sensor = await manager.getTransport({ ...bus, slaveId: 2 })

// The sensor still uses the port, so it stays open
await manager.releaseTransport(meter)

// The last device on the port: the port is closed
await manager.releaseTransport(sensor)

// At shutdown
await manager.closeAll()
```

The life of a pooled connection:

- `getTransport(config)` opens the connection for the first device on it, and returns a new
  transport for each device. Devices that are added at the same time wait for the same open.
- When you remove a device, call `releaseTransport(transport)`. The connection stays open while
  other devices use it. When the last device releases its transport, the connection is closed
  and removed from the pool. The promise resolves when the connection is closed, also when the
  port was lost or was opening again at that moment. A later `getTransport()` waits until the
  port is closed, and opens it again, also with other serial settings. An open serial port is
  locked, so without the release other settings cannot open it.
- Releasing a transport again does nothing. Do not use a transport after you release it: its
  requests fail when its connection is closed.
- `closeAll()` closes all connections and stops opening lost ports again. It waits for
  connections that are opening or closing. Use it at shutdown.

### Pause between devices on a serial port

Some meters do not answer a request that comes too soon after another meter's reply. Set
`interDeviceDelay` (milliseconds) in the RTU config of such a device. Before a request to this
device, when the previous request on the port went to another slave, the transport waits until
`interDeviceDelay` ms have passed since that request ended (also when it failed). A request to the
same slave as the previous one, or the first request on the port, does not wait. Default: 0, no
pause.

```typescript
const meter = await manager.getTransport({ ...bus, slaveId: 3, interDeviceDelay: 150 })
```

`SlaveTransport` takes the delay and a `LastRequest` that all transports on the connection share
as its last two arguments.

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

### Errors of failed requests

Only `TransportManager.getTransport()`, `createRTUTransport()` and `createTCPTransport()` add the
details (not `SlaveTransport` or `createModbusTransport()` used directly) of the request to the message of a failed request, after all retries. The message ends with
the port or host, serial settings, slave ID, function code, start address and count, for example
`Timed out (/dev/ttyUSB0 9600 8E1, slave 1, FC03 read holding registers, address 16 (0x0010), count 2)`
or `Timed out (192.168.1.10:502, slave 1, FC04 read input registers, address 0 (0x0000), count 10)`.
The serial settings are baud rate, data bits, parity and stop bits. `name`, `code`, `errno`,
`modbusCode` and `cause` are those of the original error. The retry logger gets the errors without
details. A timeout can also mean wrong serial settings or a register that the device does not
have, because many devices do not answer then.

### Lost connections

When a USB serial adapter is unplugged or a TCP connection closes, `modbus-serial` emits a
`close` event, and an `error` event when a write fails. The transports listen for these events,
so the process does not crash. The connection is then lost:

- A request in flight rejects at once. It does not wait for the response timeout.
- Later requests reject at once, without using the port.
- The error has the name `ConnectionLostError` and a message like
  `Connection to /dev/ttyUSB0 lost: port closed`, or
  `Connection to /dev/ttyUSB0 lost: EIO: i/o error, write` when a write failed (followed by the
  details of the request, as above). The underlying
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
`ConnectionLostError` with a message like
`Could not open /dev/ttyUSB0: Error: No such file or directory, cannot open /dev/ttyUSB0`, until
the port opens for the first time. The port is opened again after the same delays as above.
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

## Finding serial ports

`listSerialPorts()` lists the serial ports with their USB identity and their location (the
physical USB port):

```typescript
import { listSerialPorts, matchSerialPorts } from '@ya-modbus/transport'

const ports = await listSerialPorts()
// [
//   {
//     path: '/dev/ttyUSB0',
//     vendorId: '1a86',
//     productId: '7523',
//     locations: [
//       'pci-0000:00:1a.0-usb-0:1.3:1.0-port0',
//       'pci-0000:00:1a.0-usbv2-0:1.3:1.0-port0',
//     ],
//   },
//   { path: '/dev/ttyS0', locations: [] },
// ]
```

- `vendorId` and `productId` are 4 lowercase hex digits. They are missing for ports that are not
  USB adapters.
- `serialNumber` and `manufacturer` are there only when the adapter reports them, with the value
  as the adapter reports it. Many CH340 adapters have no serial number.
- `locations` are the names of the links in `/dev/serial/by-path` to the port. Newer systemd
  versions make two links for the same USB port (`...-usb-...` and `...-usbv2-...`). The list is
  empty when the port has no link, for example on other systems than Linux.

On Linux the ports are read from `/sys/class/tty`. This starts no other program, so it also works
in a hardened service. On other systems the list comes from the `serialport` package (through
`modbus-serial`).

In a container, `/sys` shows all serial ports of the host, also the ones that are not passed into
the container. `/dev/serial/by-path` exists only when it is mounted into the container. Without
it, `locations` are empty.

`matchSerialPorts(ports, match)` returns the ports that match all given values. It does no I/O.
`vendorId` and `productId` are required. Leave out `serialNumber` or `location` to match any.
`location` is a name from `locations`, or the full `/dev/serial/by-path/...` path. Several
identical adapters without a serial number all match, unless `location` selects one of them:

```typescript
const matches = matchSerialPorts(ports, {
  vendorId: '1a86',
  productId: '7523',
  location: 'pci-0000:00:1a.0-usb-0:1.3:1.0-port0',
})
if (matches.length === 1) {
  // matches[0].path is the port to open
}
```

## License

GPL-3.0-or-later
