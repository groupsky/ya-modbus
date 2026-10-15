# @ya-modbus/mqtt-bridge

MQTT bridge for ya-modbus - orchestrates device management, polling, and MQTT publishing.

## Overview

The MQTT bridge connects Modbus devices to MQTT:

### Features

- **MQTT Connection Management** - Connect to MQTT brokers with authentication
- **Topic Publish/Subscribe** - Publish and subscribe to MQTT topics with QoS support
- **Device Registry** - Add, remove, and track devices
- **Graceful Lifecycle** - Start, stop, and status reporting
- **Driver Integration** - Load device drivers dynamically and connect devices over RTU and TCP
- **Polling** - Poll devices at an interval or continuously, with backoff after failed reads, and publish the data
- **Devices from Config** - Load the devices of a config file on startup

### Planned Features

- State persistence, MQTT configuration topics and bridge status publishing (Phase 3)

See [Architecture documentation](./docs/ARCHITECTURE.md) for complete details and roadmap.

## Installation

```bash
npm install @ya-modbus/mqtt-bridge
```

Or run the CLI without installing:

```bash
npx ya-modbus-bridge --help
```

### Running as a systemd service

For production deployments on Linux systems, you can run the MQTT bridge as a systemd service. See [systemd/INSTALL.md](./systemd/INSTALL.md) for complete installation and configuration instructions.

### Running in Docker

The image `ghcr.io/groupsky/ya-modbus-bridge` (linux/amd64 and linux/arm64) holds the bridge and the device drivers of this repository. Its tags are the package versions and `latest`. It runs as the user `node`, with the Node version that its [Dockerfile](./docker/Dockerfile) pins, which is inside `engines` of the package. The image starts `ya-modbus-bridge run --config /config/config.json`.

```bash
docker run -d --name ya-modbus-bridge --restart unless-stopped \
  -v "$PWD/config.json:/config/config.json:ro" \
  --device "$(readlink -f /dev/serial/by-path/pci-0000:00:14.0-usb-0:1.3:1.0-port0):/dev/ttyUSB0" \
  --group-add "$(stat -c %g /dev/serial/by-path/pci-0000:00:14.0-usb-0:1.3:1.0-port0)" \
  ghcr.io/groupsky/ya-modbus-bridge:latest
```

- **Config:** mount the file at `/config/config.json`. Arguments after the image name replace the default command, for example `run --config /config/other.json`. Put the broker in `mqtt.url` or in `--mqtt-url`. `localhost` in the container is the container itself, so use the host name or IP address of the broker, or `--network host`.
- **Serial device:** `--device <path on the host>:<path in the container>`. Use the path in the container as `port` in the config (`/dev/ttyUSB0` above). The by-path names contain colons, which `--device` cannot take, so `readlink -f` turns the name into the `/dev/ttyUSB*` path. This happens when the container is created: after a reboot or a replug, when identical adapters may get other numbers, recreate the container. On the host use a `/dev/serial/by-path/...` name for adapters without a serial number, because identical adapters can get the same `by-id` name. Use `by-id` for adapters with a unique serial number. See [Unplugging a Serial Adapter](#unplugging-a-serial-adapter). Plug the adapter in before the container starts. When it is unplugged, recreate the container, because the device node in the container does not follow the new one.
- **Group:** the device node keeps the numeric group ID of the host (`dialout` on Debian and Ubuntu, `uucp` on Arch Linux), and the user `node` is not in that group. `--group-add` with the host ID, which `stat -c %g` prints, lets the user open the port. Without it, opening the port fails with `Permission denied`.
- **Debug:** add `-e YA_MODBUS_DEBUG=1` to `docker run` to log the full error of failed polls and the requests that are sent again.

Docker Compose:

```yaml
services:
  ya-modbus-bridge:
    image: ghcr.io/groupsky/ya-modbus-bridge:latest
    restart: unless-stopped
    volumes:
      - ./config.json:/config/config.json:ro
    devices:
      - source: /dev/serial/by-path/pci-0000:00:14.0-usb-0:1.3:1.0-port0
        target: /dev/ttyUSB0
        permissions: rwm
    group_add:
      - '20' # numeric group ID of the device on the host: stat -c %g <device>
```

To add another driver package, build your own image:

```dockerfile
FROM ghcr.io/groupsky/ya-modbus-bridge:latest
RUN npm install --no-audit --no-fund --no-package-lock @example/ya-modbus-driver-foo
```

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
- `--state-dir <path>` - Directory path for state persistence (accepted, but the bridge does not use it)

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

The smallest useful config has an MQTT broker and one device:

```json
{
  "mqtt": {
    "url": "mqtt://localhost:1883"
  },
  "devices": [
    {
      "deviceId": "sensor1",
      "driver": "@ya-modbus/driver-ex9em",
      "connection": {
        "type": "rtu",
        "port": "/dev/ttyUSB0",
        "slaveId": 1
      }
    }
  ]
}
```

This config sets every option that the bridge uses. If an option has a default, the example uses the default. The exception is `polling.mode`:

```json
{
  "mqtt": {
    "url": "mqtt://localhost:1883",
    "clientId": "modbus-bridge",
    "username": "user",
    "password": "pass",
    "reconnectPeriod": 5000
  },
  "topicPrefix": "modbus",
  "devices": [
    {
      "deviceId": "sensor1",
      "driver": "@ya-modbus/driver-ex9em",
      "enabled": true,
      "connection": {
        "type": "rtu",
        "port": "/dev/ttyUSB0",
        "baudRate": 9600,
        "slaveId": 1,
        "parity": "even",
        "dataBits": 8,
        "stopBits": 1,
        "timeout": 1000
      },
      "polling": {
        "interval": 2000,
        "mode": "continuous",
        "maxRetries": 3,
        "retryBackoff": 4000
      }
    },
    {
      "deviceId": "meter1",
      "driver": "@ya-modbus/driver-xymd1",
      "connection": {
        "type": "tcp",
        "host": "192.168.1.100",
        "port": 502,
        "slaveId": 2,
        "timeout": 1000
      }
    }
  ]
}
```

The options from the command line replace the same options from the file. The bridge checks the merged config before it connects to the broker.

Times, counts and ports are whole numbers.

Each key must be one of the options below. A key that is not an option there is an error, for example a misspelled key such as `paritty`. This is true at the top level and in `mqtt`, in a device, in `connection` and in `polling`. Keys are case-sensitive.

**Configuration options:**

- `mqtt.url` (optional) - MQTT broker URL (mqtt://, mqtts://, ws://, wss://). Default: `mqtt://localhost:1883`, also when the `mqtt` section is missing. Without a config file, `--mqtt-url` is required.
- `mqtt.clientId` (optional) - MQTT client identifier. Default: the MQTT client creates a random one
- `mqtt.username` (optional) - Authentication username. Default: none
- `mqtt.password` (optional) - Authentication password. Default: none
- `mqtt.reconnectPeriod` (optional) - Time between reconnect attempts in milliseconds (1-86400000, default: 5000)
- `topicPrefix` (optional) - Topic prefix for all MQTT topics (default: `modbus`). It must not be empty. It must not contain `+`, `#`, `/`, `$` or the null character.
- `stateDir` (optional) - Directory path for state persistence. The bridge accepts it but does not use it: it does not write any state to disk.
- `devices` (optional) - Array of device configurations that the bridge loads at startup (default: no devices). The number of devices is not limited. See [Loading Devices](#loading-devices).

**Device configuration:**

- `deviceId` (required) - Unique device identifier. The bridge uses it in the MQTT topics (`{topicPrefix}/{deviceId}/data`). It must not be empty. It must not contain `+`, `#`, `/`, `$` or the null character.
- `driver` (required) - Driver package name: `@ya-modbus/driver-<name>`, `ya-modbus-driver-<name>` or `@<scope>/ya-modbus-driver-<name>`. `<name>` and `<scope>` can have lowercase letters, numbers and hyphens. The package must be installed.
- `connection` (required) - Connection configuration (RTU or TCP)
- `enabled` (optional) - Enable/disable device (default: true). A disabled device is added with the state `disconnected`. The bridge does not load its driver and does not poll it.
- `polling` (optional) - Polling configuration. Without it, the bridge polls the device every 5000 ms and uses the defaults of the polling options below.

**Connection:**

The fields depend on `type`. A field that does not belong to the type is an error, for example `host` in an RTU connection, or `parity` or `baudRate` in a TCP connection. A missing required field or an unknown `type` is an error too.

**RTU connection:**

- `type: "rtu"` (required)
- `port` (required) - Serial port path, for example `/dev/ttyUSB0` (Linux) or `COM3` (Windows). Prefer a stable path, see [Unplugging a Serial Adapter](#unplugging-a-serial-adapter)
- `baudRate` (optional) - Baud rate (e.g., 9600, 19200). Default: from the driver
- `slaveId` (required) - Modbus slave ID (0-247)
- `parity` (optional) - Parity: "none", "even", "odd". Default: from the driver
- `dataBits` (optional) - Data bits: 7 or 8. Default: from the driver
- `stopBits` (optional) - Stop bits: 1 or 2. Default: from the driver
- `timeout` (optional) - Time to wait for a response in milliseconds (1-86400000, default: 1000)
- `interDeviceDelay` (optional) - Pause in milliseconds before a request to this device when the previous request on the port went to another device (0-60000, default: 150). Some meters do not answer a request that comes too soon after another meter's reply: a DDS519MR misses it after 50 ms and answers after 100 ms. The pause counts from the end of the previous request. The bridge waits only when the device changes, not between the requests of one device. `0` turns the pause off.

The defaults of `baudRate`, `parity`, `dataBits` and `stopBits` are the factory settings of the device, from the `DEFAULT_CONFIG` of the driver. `ya-modbus show-defaults --driver <package>` shows them. If the driver has no `DEFAULT_CONFIG`, `baudRate` is required, and the bridge uses parity "none", 8 data bits and 1 stop bit.

When the bridge adds the device, it checks these settings and `slaveId` against the values that the driver supports (its `SUPPORTED_CONFIG`). If the driver does not support a value, the device does not load (see [Common Configuration Errors](#common-configuration-errors)). For each RTU device that loads, the bridge prints the settings that it uses:

```
Device meter1 uses /dev/ttyUSB0: baud rate 9600, data bits 8, parity odd, stop bits 1, inter-device delay 150 ms
```

**TCP connection:**

- `type: "tcp"` (required)
- `host` (required) - TCP host address
- `port` (optional) - TCP port (1-65535, default: 502)
- `slaveId` (required) - Modbus slave ID (0-247)
- `timeout` (optional) - Time to wait for a response, and for the TCP connection to open, in milliseconds (1-86400000, default: 1000)

**Polling configuration:**

- `interval` (required) - Polling interval in milliseconds (100-86400000)
- `mode` (optional) - Polling mode: "interval" (default) or "continuous"
  - `"interval"` - Poll at fixed intervals (normal behavior)
  - `"continuous"` - Poll immediately after receiving response (minimal 1ms delay)
    In this mode `interval` is not the poll period. It is the retry delay after a failed read, until `maxRetries` is reached (and the base for the default backoff).
- `maxRetries` (optional) - Number of consecutive failed reads after which the device goes to the `error` state (0-100, default: 3). From then on, the bridge waits `retryBackoff` ms between reads instead of `interval` ms. It is not a limit: the bridge never stops polling. See [Failed Reads and Backoff](#failed-reads-and-backoff).
- `retryBackoff` (optional) - Time to wait between reads in milliseconds while the device is in the `error` state (1-86400000, default: 2 × `interval`)

### Which Data Points Are Polled

The driver gives each data point a `pollType` and an `access`. The bridge uses them like this:

| Data point                               | When the bridge reads it                                     |
| ---------------------------------------- | ------------------------------------------------------------ |
| `pollType: 'dynamic'` (or no `pollType`) | On every poll                                                |
| `pollType: 'static'`                     | Once. Its values are kept and added to every `data` message. |
| `pollType: 'on-demand'`                  | Never                                                        |
| `access: 'w'` (write-only)               | Never                                                        |

Static points are read in a separate request, after the dynamic points, and only in a poll where the dynamic read worked. If the static read fails, the bridge logs a warning with the device ID and the static data point IDs, still publishes the dynamic points, and tries the static points again on the next poll. A failed static read does not count as a failed read (see below). When a device is removed and added again, the bridge reads its static points again.

### Failed Reads and Backoff

The bridge counts the consecutive failed reads of a device:

- After a failed read, while the count is below `maxRetries`, the bridge waits `interval` ms before the next read.
- When the count reaches `maxRetries`, the device goes to the `error` state. The bridge now waits `retryBackoff` ms between reads.
- The bridge keeps polling with `retryBackoff` until a read works. Then the count goes back to 0, the device goes back to the `connected` state, and the bridge waits `interval` ms again.

`maxRetries` says which failed read starts the backoff. It is not the number of extra tries before the backoff:

| `maxRetries`  | What happens                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `3` (default) | After the 1st and the 2nd failed read, the bridge waits `interval` ms. After the 3rd failed read, the backoff starts.       |
| `1`           | There is no extra try after `interval`. The backoff starts after the first failed read.                                     |
| `0`           | The same as `1`. The backoff starts after the first failed read. A device that works never uses the backoff, even with `0`. |

The transport also retries every Modbus request by itself before a read counts as failed. This is separate from `maxRetries`.

### Polling Logs

Every failed read writes one line to stderr with the device ID, the failure count and the error message:

```
Polling error for device ex9em-1 (failure 2): Timed out (/dev/ttyUSB0 9600 8N1, slave 1, FC03 read holding registers, address 0 (0x0000), count 2)
```

The message names the port (or host), serial settings, slave ID, function code, start address and count of the request. The same message is in the `errors` list of the device status. When a read works after failed reads, the bridge writes one line to stdout:

```
Device ex9em-1 recovered after 3 failed polls
```

To also see the full error with its stack and cause on every failed read, start the bridge with the environment variable `YA_MODBUS_DEBUG=1`. Then the bridge also writes one line to stderr for each request that the transport sends again after it failed:

```
Device meter1: request failed (try 1), sending it again: Timed out
```

A read that works on a later try is not a failed read, but each failed try can wait the whole `timeout`. Many of these lines explain a slow bus.

### Loading Devices

The bridge checks the whole config before it connects to the broker. If the config is not valid, the CLI prints the error and exits with code 1. No device is loaded.

After the bridge has connected to the broker, it loads the devices one after another, in the order of the `devices` array. For each device the CLI prints `✓ Loaded device: <deviceId>`.

- Devices share one connection when they use the same serial port with the same `baudRate`, `dataBits`, `parity` and `stopBits`, or the same TCP `host` and `port`. The first of them opens the connection and its `timeout` is used for all of them.
- Devices on the same serial port, or on the same TCP host and port, are read one at a time, in turn. The whole poll of a device (its dynamic and static points) runs before the poll of the next device. A device that is ready to poll again waits behind the devices that are already waiting, also in `continuous` mode.
- A device ID can be used only once. If it is used twice, loading the second device fails with `devices[<N>] (<deviceId>): Device <deviceId> already exists`.
- If a device fails to load, for example because the driver is not installed or does not support a serial setting, the CLI prints the error with the position and ID of the device, as `devices[<N>] (<deviceId>): <message>`, and exits with code 1. `N` is the position of the device in `devices`, counting from 0. The devices after it are not loaded.
- A port that cannot be opened does not stop the bridge, for example a USB serial adapter that is not plugged in, or a TCP device that refuses the connection. The bridge prints a warning, the device starts in the `error` state, and the other devices start normally. A later poll opens the port (see [Unplugging a Serial Adapter](#unplugging-a-serial-adapter)). This does not work for a driver that reads from the device while it loads: that device fails to load.

### Common Configuration Errors

The CLI prints a config error as `Error: Invalid configuration: <path>: <message>`. The path shows where the problem is. A problem at the top level of the file has no path: `Error: Invalid configuration: <message>`. In `devices.1.polling.interval`, `1` is the second device, because counting starts at 0. If there are several problems, they are all in the message, separated by commas.

**Unknown key**

```
Error: Invalid configuration: devices.0.connection: Unrecognized key: "paritty"
```

The key is not an option in that place. It is misspelled, or it belongs to the other connection type, for example `host` in an RTU connection. Fix the spelling or remove the key. A key at the top level of the file has no path: `Invalid configuration: Unrecognized key: "topicprefix"`.

**Wrong connection field**

```
Error: Invalid configuration: devices.0.connection: Invalid input
```

This message does not say which field is wrong. Compare the connection with the RTU and TCP lists above. The usual causes are:

- `slaveId` outside 0-247, or TCP `port` outside 1-65535
- `port`, `host` or `slaveId` is missing, or `port` or `host` is empty
- `baudRate` is not a positive number
- `parity`, `dataBits` or `stopBits` has a value that is not in the list
- `timeout` is not a whole number from 1 to 86400000
- `interDeviceDelay` is not a whole number from 0 to 60000
- `type` is not `"rtu"` or `"tcp"`, or `connection` is missing
- an unknown key, together with another problem in the same connection (an unknown key alone gives `Unrecognized key`)

**Setting that the driver does not support**

```
Error: devices[3] (xymd1): Invalid parity 'none'. This driver supports: odd (default: odd)
```

The message starts with the device: `3` is the position in `devices`, counting from 0, and `xymd1` is its `deviceId`. Use one of the listed values, or leave the setting out to use the default of the driver. The same check covers `baudRate`, `dataBits`, `stopBits` and `slaveId`.

**Wrong driver name**

```
Error: Invalid configuration: devices.0.driver: Driver must be @ya-modbus/driver-<name> or ya-modbus-driver-<name> with only lowercase letters, numbers, and hyphens
```

Write the full package name, for example `@ya-modbus/driver-ex9em`. Then install the package: `npm install @ya-modbus/driver-ex9em`.

**MQTT special characters in the device ID**

```
Error: Invalid configuration: devices.0.deviceId: Device ID must not contain MQTT special characters (+, #, /, $) or null character
```

The device ID is a level in the MQTT topics. Use letters, numbers, hyphens and underscores.

**Polling interval out of range**

```
Error: Invalid configuration: devices.0.polling.interval: Polling interval must be at least 100ms
```

Use an interval from 100 to 86400000 ms. If `polling` is set, `interval` is required.

**Wrong broker URL**

```
Error: Invalid configuration: mqtt.url: URL must start with mqtt://, mqtts://, ws://, or wss://
```

### Performance and Security Tips

- Devices that share a connection are read one at a time, so a device can wait for the others. On a serial port, each change to another device also costs its `interDeviceDelay`. Use more serial adapters if you need shorter times between the reads of a device.
- A device that does not answer keeps its connection busy while the bridge waits for the response. The transport tries every request up to 3 times, and each try can take up to `timeout` ms. Use a larger `retryBackoff` for devices that are often offline.
- The config file can contain the MQTT password. Make the file readable only by the user that runs the bridge, for example with `chmod 600 config.json`.
- Other users of the machine can see command line options such as `--mqtt-password` in the process list. Put credentials in the config file instead.
- `mqtt://` and `ws://` send the password without encryption. Use `mqtts://` or `wss://` when the broker is not on the same machine.

## Device States

Each device has a `state`. `bridge.getDevice()` and `bridge.listDevices()` return it.

| State          | Meaning                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| `disconnected` | The device is disabled (`enabled: false`). The bridge does not poll it.                                            |
| `connecting`   | The bridge is loading the driver.                                                                                  |
| `connected`    | The driver is loaded. The device is not in the `error` state.                                                      |
| `error`        | `maxRetries` consecutive reads failed, or the port was not open when the device was added. The bridge still polls. |

How the state changes:

- `disconnected` → `connecting` - the device is added and is enabled
- `connecting` → `connected` - the driver is loaded. If the driver does not load, `addDevice()` fails and the device is not added.
- `connected` → `error` - `maxRetries` consecutive reads failed (at least 1, so `0` works like `1`), or the port of the device is not open when the device is added. In the second case `addDevice()` works, and the state changes right after the driver is loaded.
- `error` → `connected` - the next read works

When the state changes between `connected` and `error`, the bridge publishes a message to `{topicPrefix}/{deviceId}/status`:

```json
{
  "deviceId": "sensor1",
  "timestamp": 1760000000000,
  "state": "error",
  "errors": [
    "Timed out (/dev/ttyUSB0 9600 8N1, slave 1, FC03 read holding registers, address 0 (0x0000), count 2)"
  ]
}
```

The `errors` field is only there when the state is `error`. It has the message of the last failed read, or why the port could not be opened. Status messages use QoS 0 and are not retained, the same as the messages on `{topicPrefix}/{deviceId}/data`. If the bridge is not connected to the broker when the state changes, the message is lost. Use `bridge.getDevice()` to read the current state at any time.

The `connected` field of the device status is deprecated. Use `state` instead. `connected` is `true` only when `state` is `connected`.

## Unplugging a Serial Adapter

The bridge keeps running when a USB serial adapter is unplugged:

- Polls of the devices on that port fail with an error like
  `Connection to /dev/ttyUSB0 lost: port closed (/dev/ttyUSB0 9600 8N1, slave 1, FC03 read holding registers, address 0 (0x0000), count 2)` (or `... lost: EIO: i/o error, write ...` when a
  write failed). The device status shows the error (`errors`, `consecutiveFailures`). The device
  is polled again on its normal schedule: after `interval`, and after `retryBackoff` once
  `maxRetries` polls failed in a row.
- A later poll opens the port again: the first poll 1 second after the loss, then with a delay
  that doubles after each failed attempt, up to 60 seconds. All devices on the port share the
  new connection.
- When the adapter is back, the next attempt opens the port and the devices are read again. No
  restart is needed.

The bridge also starts when an adapter is not plugged in. It prints a warning like
`Device meter1 is not connected, the bridge keeps trying to open its port: Could not open /dev/ttyUSB0: Error: No such file or directory, cannot open /dev/ttyUSB0`.
The devices on that port start in the `error` state, and the other devices start normally. The
port is opened with the same delays as above, so the devices are read soon after the adapter is
plugged in.

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
