# @ya-modbus/mqtt-bridge

MQTT bridge for ya-modbus - orchestrates device management, polling, and MQTT publishing.

## Overview

The MQTT bridge provides the foundational layer for connecting Modbus devices to MQTT:

### Current Features (Phase 1)

- **MQTT Connection Management** - Connect to MQTT brokers with authentication
- **Topic Publish/Subscribe** - Publish and subscribe to MQTT topics with QoS support
- **Device Registry** - Add, remove, and track devices
- **Graceful Lifecycle** - Start, stop, and status reporting

### Future Features

- Driver integration and polling coordination (Phase 2)
- State persistence and MQTT configuration topics (Phase 3)

See [Architecture documentation](./docs/ARCHITECTURE.md) for complete details and roadmap.

## Installation

```bash
npm install @ya-modbus/mqtt-bridge
```

### Running as a systemd service

For production deployments on Linux systems, you can run the MQTT bridge as a systemd service. See [systemd/INSTALL.md](./systemd/INSTALL.md) for complete installation and configuration instructions.

## CLI Reference

The `ya-modbus-bridge` command-line tool provides the following commands:

### Commands

- `run` - Run the MQTT bridge with a configuration file

### Options

**Configuration:**

- `-c, --config <path>` - Path to configuration file (optional if using CLI options)
- `--mqtt-url <url>` - MQTT broker URL (mqtt://, mqtts://, ws://, wss://)
- `--mqtt-client-id <id>` - MQTT client identifier
- `--mqtt-username <username>` - MQTT authentication username
- `--mqtt-password <password>` - MQTT authentication password
- `--mqtt-reconnect-period <ms>` - Reconnection interval in milliseconds
- `--topic-prefix <prefix>` - Topic prefix for all MQTT topics (default: modbus)
- `--state-dir <path>` - Directory path for state persistence

**General:**

- `-h, --help` - Display help for command
- `-V, --version` - Output version number

### Examples

```bash
# Run with config file
ya-modbus-bridge run --config /path/to/config.json

# Run with CLI options only
ya-modbus-bridge run --mqtt-url mqtt://localhost:1883

# Run with config file and override options
ya-modbus-bridge run --config config.json --mqtt-url mqtt://broker.example.com:1883

# Run with authentication
ya-modbus-bridge run --mqtt-url mqtt://broker.example.com:1883 \
  --mqtt-username user --mqtt-password pass

# Show help
ya-modbus-bridge --help
ya-modbus-bridge run --help

# Show version
ya-modbus-bridge --version
```

## CLI Usage

Run the MQTT bridge using the command-line interface:

```bash
# Run with configuration file
ya-modbus-bridge run --config config.json

# Show help
ya-modbus-bridge --help

# Show version
ya-modbus-bridge --version
```

### Configuration File

Create a `config.json` file:

```json
{
  "mqtt": {
    "url": "mqtt://localhost:1883",
    "clientId": "modbus-bridge",
    "username": "user",
    "password": "pass"
  },
  "topicPrefix": "modbus",
  "devices": [
    {
      "deviceId": "sensor1",
      "driver": "@ya-modbus/driver-ex9em",
      "connection": {
        "type": "rtu",
        "port": "/dev/ttyUSB0",
        "baudRate": 9600,
        "slaveId": 1
      },
      "polling": {
        "interval": 2000,
        "mode": "continuous"
      }
    },
    {
      "deviceId": "meter1",
      "driver": "@ya-modbus/driver-xymd1",
      "connection": {
        "type": "tcp",
        "host": "192.168.1.100",
        "port": 502,
        "slaveId": 2
      }
    }
  ]
}
```

**Configuration options:**

- `mqtt.url` (required) - MQTT broker URL (mqtt://, mqtts://, ws://, wss://)
- `mqtt.clientId` (optional) - MQTT client identifier
- `mqtt.username` (optional) - Authentication username
- `mqtt.password` (optional) - Authentication password
- `mqtt.reconnectPeriod` (optional) - Reconnection interval in milliseconds (default: 5000)
- `topicPrefix` (optional) - Topic prefix for all MQTT topics (default: 'modbus')
- `stateDir` (optional) - Directory path for state persistence (future)
- `devices` (optional) - Array of device configurations to load on startup

**Device configuration:**

- `deviceId` (required) - Unique device identifier
- `driver` (required) - Driver package name (@ya-modbus/driver-_ or ya-modbus-driver-_)
- `connection` (required) - Connection configuration (RTU or TCP)
- `enabled` (optional) - Enable/disable device (default: true)
- `polling` (optional) - Polling configuration

**RTU connection:**

- `type: "rtu"` (required)
- `port` (required) - Serial port path. Prefer a stable path, see
  [Unplugging a Serial Adapter](#unplugging-a-serial-adapter)
- `baudRate` (required) - Baud rate (e.g., 9600, 19200)
- `slaveId` (required) - Modbus slave ID (0-247)
- `parity` (optional) - Parity: "none", "even", "odd"
- `dataBits` (optional) - Data bits: 7 or 8
- `stopBits` (optional) - Stop bits: 1 or 2

**TCP connection:**

- `type: "tcp"` (required)
- `host` (required) - TCP host address
- `port` (required) - TCP port (1-65535)
- `slaveId` (required) - Modbus slave ID (0-247)

**Polling configuration:**

- `interval` (required) - Polling interval in milliseconds (100-86400000)
- `mode` (optional) - Polling mode: "interval" (default) or "continuous"
  - `"interval"` - Poll at fixed intervals (normal behavior)
  - `"continuous"` - Poll immediately after receiving response (minimal 1ms delay)
    In this mode `interval` is not the poll period. It is the retry delay after a failed read, until `maxRetries` is reached (and the base for the default backoff).
- `maxRetries` (optional) - Number of failed reads in a row after which the device goes to the `error` state and is polled every `retryBackoff` ms instead of every `interval` ms (0-100, default: 3). It is not a limit: the bridge never stops polling. See [Failed Reads and Backoff](#failed-reads-and-backoff).
- `retryBackoff` (optional) - Time between polls in milliseconds while the device is in the `error` state (1-86400000, default: 2 × `interval`)

### Failed Reads and Backoff

The bridge counts the failed reads of a device in a row:

- While the count is below `maxRetries`, the next read happens after `interval`.
- When the count reaches `maxRetries`, the device goes to the `error` state. The next reads happen every `retryBackoff` ms.
- The bridge keeps polling at `retryBackoff` until a read works. Then the count goes back to 0, the device goes back to the `connected` state, and polling uses `interval` again.

`maxRetries` is the number of the failed read that starts the backoff. It is not the number of retries before the backoff:

| `maxRetries`  | What happens                                                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `3` (default) | After the 1st and the 2nd failed read, the next read happens after `interval`. After the 3rd failed read, the backoff starts.    |
| `1`           | There is no retry after `interval`. The backoff starts after the first failed read.                                              |
| `0`           | The same as `1`. The backoff starts after the first failed read. A device that is working never uses the backoff, also with `0`. |

The transport also retries every Modbus request by itself before a read counts as failed. This is separate from `maxRetries`.

## Device States

Each device has a `state`. `bridge.getDevice()` and `bridge.listDevices()` return it.

| State          | Meaning                                                                              |
| -------------- | ------------------------------------------------------------------------------------ |
| `disconnected` | The device is disabled (`enabled: false`). The bridge does not poll it.              |
| `connecting`   | The bridge is loading the driver.                                                    |
| `connected`    | The driver is loaded. Fewer than `maxRetries` reads in a row failed.                 |
| `error`        | The last `maxRetries` reads failed. The bridge still polls, every `retryBackoff` ms. |

How the state changes:

- `disconnected` → `connecting` - the device is added and is enabled
- `connecting` → `connected` - the driver is loaded. If the driver does not load, `addDevice()` fails and the device is not added.
- `connected` → `error` - `maxRetries` reads failed in a row
- `error` → `connected` - the next read works

When the state changes between `connected` and `error`, the bridge publishes a message to `{topicPrefix}/{deviceId}/status`:

```json
{ "deviceId": "sensor1", "timestamp": 1760000000000, "state": "error", "errors": ["Timed out"] }
```

The `errors` field is only there when the state is `error`. It has the message of the last failed read. Status messages use QoS 0 and are not retained, the same as the messages on `{topicPrefix}/{deviceId}/data`. If the bridge is not connected to the broker when the state changes, the message is lost. Use `bridge.getDevice()` to read the current state at any time.

The `connected` field of the device status is deprecated. Use `state` instead. `connected` is `true` only when `state` is `connected`.

## Unplugging a Serial Adapter

The bridge keeps running when a USB serial adapter is unplugged:

- Polls of the devices on that port fail with an error like
  `Connection to /dev/ttyUSB0 lost: port closed` (or `... lost: EIO: i/o error, write` when a
  write failed). The device status shows the error (`errors`, `consecutiveFailures`). The device
  is polled again on its normal schedule: after `interval`, and after `retryBackoff` once
  `maxRetries` polls failed in a row.
- A later poll opens the port again: the first poll 1 second after the loss, then with a delay
  that doubles after each failed attempt, up to 60 seconds. All devices on the port share the
  new connection.
- When the adapter is back, the next attempt opens the port and the devices are read again. No
  restart is needed.

The port must exist when the bridge starts. If it does not, the bridge exits with an error.
systemd starts it again after 5 seconds, but at most 5 times in 5 minutes. After that, the
service stays failed until you run `sudo systemctl restart ya-modbus-bridge`.

Linux can give the adapter a new name when it is plugged in again (`/dev/ttyUSB0` becomes
`/dev/ttyUSB1`). The bridge opens the same path again, so use a stable path in `port`:

- `/dev/serial/by-id/...` for adapters with a unique serial number. The name stays the same in
  every USB port. Example: `/dev/serial/by-id/usb-FTDI_FT232R_USB_UART_A10K1234-if00-port0`
- `/dev/serial/by-path/...` for adapters without a serial number (many CH340 adapters). Several
  identical adapters without a serial number can get the same by-id name, or none. The by-path
  name is the physical USB port, so keep the adapter in the same USB port. Example:
  `/dev/serial/by-path/pci-0000:00:14.0-usb-0:1.3:1.0-port0`

`ls -l /dev/serial/by-id/ /dev/serial/by-path/` lists the names and the devices they point to.
These names are links to the same `/dev/ttyUSB*` and `/dev/ttyACM*` devices, so the systemd unit
file allows them.

## Programmatic Usage

```typescript
import { createBridge } from '@ya-modbus/mqtt-bridge'

const bridge = createBridge({
  mqtt: {
    url: 'mqtt://localhost:1883',
    clientId: 'modbus-bridge',
  },
  topicPrefix: 'modbus',
})

await bridge.start()

// Publish to topic
await bridge.publish('device1/data', JSON.stringify({ temp: 25.5 }))

// Subscribe to topic
await bridge.subscribe('device1/cmd', (message) => {
  console.log('Received:', message.payload.toString())
})

// Add device
await bridge.addDevice({
  deviceId: 'device1',
  driver: 'ya-modbus-driver-example',
  connection: {
    type: 'tcp',
    host: '192.168.1.100',
    port: 502,
    slaveId: 1,
  },
})

// List devices
const devices = bridge.listDevices()

// Stop bridge
await bridge.stop()
```

## Architecture

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for complete bridge architecture including:

- Component structure
- MQTT topic structure
- State management
- Lifecycle and event handling
- Data flow and validation

## Development

```bash
# Build
npm run build

# Test
npm test

# Lint
npm run lint

# Clean
npm run clean
```

## License

GPL-3.0-or-later
