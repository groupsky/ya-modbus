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
- **Publish on Change** - Publish the data of a device only when a value changes, with a heartbeat
- **Writes** - Write data points from an MQTT message, then read the device at once and publish the new data
- **Devices from Config** - Load the devices of a config file on startup
- **Availability** - Retained status of the bridge (with a last-will) and of each device

### Planned Features

- State persistence, MQTT configuration topics and more bridge status topics (Phase 3)

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
- `--state-dir <path>` - Not used yet: the bridge keeps no state on disk, and it warns at startup when this is set
- `--stats-interval <seconds>` - Publish device stats every N seconds (default: off). See [Device Stats](#device-stats)
- `--stats-log` - Also log one line per device at every stats interval

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
      "allowWrites": false,
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
        "retryBackoff": 4000,
        "maxRetryBackoff": 60000
      },
      "publish": {
        "mode": "every-poll"
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

Each key must be one of the options below. A key that is not an option there is an error, for example a misspelled key such as `paritty`. This is true at the top level and in `mqtt`, in a device, in `connection`, in `polling` and in `publish`. Keys are case-sensitive.

**Configuration options:**

- `mqtt.url` (optional) - MQTT broker URL (mqtt://, mqtts://, ws://, wss://). Default: `mqtt://localhost:1883`, also when the `mqtt` section is missing. Without a config file, `--mqtt-url` is required.
- `mqtt.clientId` (optional) - MQTT client identifier. Default: the MQTT client creates a random one
- `mqtt.username` (optional) - Authentication username. Default: none
- `mqtt.password` (optional) - Authentication password. Default: none
- `mqtt.reconnectPeriod` (optional) - Time between reconnect attempts in milliseconds (1-86400000, default: 5000)
- `topicPrefix` (optional) - Topic prefix for all MQTT topics (default: `modbus`). It must not be empty. It must not contain `+`, `#`, `/`, `$` or the null character.
- `stateDir` (optional) - Not used yet: the bridge keeps no state on disk, and it warns at startup when this is set.
- `statsInterval` (optional) - Seconds between the messages on `{topicPrefix}/{deviceId}/stats` (0-86400, default: not set). Without it, or with `0`, the bridge publishes no stats. See [Device Stats](#device-stats).
- `statsLog` (optional) - Also write one line per device to stdout at every `statsInterval` (default: false). It does nothing without `statsInterval`.
- `devices` (optional) - Array of device configurations that the bridge loads at startup (default: no devices). The number of devices is not limited. See [Loading Devices](#loading-devices).

**Device configuration:**

- `deviceId` (required) - Unique device identifier. The bridge uses it in the MQTT topics (`{topicPrefix}/{deviceId}/data`). It must not be empty. It must not contain `+`, `#`, `/`, `$` or the null character. Do not use `bridge`: its status topic is the topic of the bridge status (see [Bridge Status](#bridge-status)).
- `driver` (required) - Driver package name: `@ya-modbus/driver-<name>`, `ya-modbus-driver-<name>` or `@<scope>/ya-modbus-driver-<name>`. `<name>` and `<scope>` can have lowercase letters, numbers and hyphens. The package must be installed.
- `connection` (required) - Connection configuration (RTU or TCP)
- `enabled` (optional) - Enable/disable device (default: true). A disabled device is added with the state `disconnected`. The bridge does not load its driver and does not poll it.
- `polling` (optional) - Polling configuration. Without it, the bridge polls the device every 5000 ms and uses the defaults of the polling options below.
- `allowWrites` (optional) - Write the data points of the messages on `{topicPrefix}/{deviceId}/set` (default: false). Without it, the bridge answers every write message with an error and writes nothing, so a meter cannot be written by mistake. See [Writing Data Points](#writing-data-points).
- `publish` (optional) - When the bridge publishes the data of a read on `{topicPrefix}/{deviceId}/data`. Without it, the bridge publishes every read. See [Publish Only on Change](#publish-only-on-change).

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
- `pollOrder` (optional) - `"arrival"` (default) or `"fixed"`: the order in which the devices on the port take turns. All devices on one port must have the same value. See [Fixed Poll Order](#fixed-poll-order).

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
- `pollOrder` (optional) - `"arrival"` (default) or `"fixed"`: the order in which the devices on the host and port take turns. All devices on one host and port must have the same value. See [Fixed Poll Order](#fixed-poll-order).

**Polling configuration:**

- `interval` (required) - Polling interval in milliseconds (100-86400000)
- `mode` (optional) - Polling mode: "interval" (default) or "continuous"
  - `"interval"` - Poll at fixed intervals (normal behavior)
  - `"continuous"` - Poll immediately after receiving response (minimal 1ms delay)
    In this mode `interval` is not the poll period. It is the retry delay after a failed read, until `maxRetries` is reached (and the base for the default backoff).
- `maxRetries` (optional) - Number of consecutive failed reads after which the device goes to the `error` state (0-100, default: 3). From then on, the bridge polls the device less often: it waits `retryBackoff` ms, then more, instead of `interval` ms. It is not a limit: the bridge never stops polling. See [Failed Reads and Backoff](#failed-reads-and-backoff).
- `retryBackoff` (optional) - Time to wait in milliseconds when the device enters the `error` state (1-86400000, default: 2 × `interval`). The wait doubles with every further failed read, up to `maxRetryBackoff`.
- `maxRetryBackoff` (optional) - Longest wait between reads in milliseconds while the device is in the `error` state (1-86400000, default: 60000, or `retryBackoff` if that is longer). It must not be smaller than `retryBackoff`. The bridge refuses to add a device with a smaller value.

### Which Data Points Are Polled

The driver gives each data point a `pollType` and an `access`. The bridge uses them like this:

| Data point                               | When the bridge reads it                                     |
| ---------------------------------------- | ------------------------------------------------------------ |
| `pollType: 'dynamic'` (or no `pollType`) | On every poll                                                |
| `pollType: 'static'`                     | Once. Its values are kept and added to every `data` message. |
| `pollType: 'on-demand'`                  | Never                                                        |
| `access: 'w'` (write-only)               | Never                                                        |

Static points are read in a separate request, after the dynamic points, and only in a poll where the dynamic read worked. If the static read fails, the bridge logs a warning with the device ID and the static data point IDs, still publishes the dynamic points, and tries the static points again on the next poll. A failed static read does not count as a failed read (see below). When a device is removed and added again, the bridge reads its static points again.

### Data Points the Device Refuses

A driver often reads several register blocks when the bridge asks it for the data points. When the device refuses one block, the whole read fails. How the bridge goes on depends on the error:

- **The device refuses the request** with Modbus exception 1 (illegal function), 2 (illegal data address) or 3 (illegal data value). The device is alive. The bridge reads each data point on its own, once, to find the points that fail (the search). It publishes the points that work. The state stays `connected`, and the status message lists the failed points in `failedDataPoints` (see [Device States](#device-states)).
- **Any other error**: a timeout, a closed port, or any other Modbus exception, for example 4 (device failure) or 6 (busy). The whole poll fails, the same as when the device does not answer (see [Failed Reads and Backoff](#failed-reads-and-backoff)). No point is marked as failed.

On later polls the bridge reads the good points in one request, and the failed points in a second request. When the second request works, the failed points are back in the data, and `failedDataPoints` goes away. Static points work the same way: the static points that work are kept, and only the failed ones are read again on each poll, in one request.

When the device refuses every dynamic point, the poll fails (see [Failed Reads and Backoff](#failed-reads-and-backoff)). Later polls read all of them in one request, until it works. When the device refuses every static point, the poll still works: the status names the static points, and later polls read them in one request.

Limits:

- The search costs one request per data point (for a meter with 56 points, about 4 seconds). It runs when the device refuses the request with the dynamic points that are not marked as failed, or the first request with the static points.
- A device that does not answer a bad range at all (a timeout instead of an exception) still fails as a whole.
- The failed points are retried together. When some of them work again and others do not, the second request still fails, so all of them stay failed until all of them work again.
- Failed static points are never searched again. They are only read again in one request.
- When the device refused every dynamic point, every poll fails, and the device goes to the `error` state and stays there, until all of them answer in one request. When the device answers some of them but not all, polls still fail.
- A driver can read a smaller range for one point than for many. Then a point can work alone but fail in the full request, and every poll runs the search: the data is complete, but the poll is slow.

### Publish Only on Change

A device that is polled often and changes little can send many messages with the same data. With `publish.mode` `on-change`, the bridge publishes a read only when its data differs from the last published data of the device, and at least every `publish.heartbeat` ms:

```json
"publish": { "mode": "on-change", "heartbeat": 300000 }
```

- `mode` (required) - `every-poll`: publish every read. `on-change`: publish a read when any value changed.
- `heartbeat` (optional) - In `on-change` mode, the longest time in milliseconds between two publishes when nothing changes (1-86400000, default: 300000).

In `on-change` mode the bridge always publishes:

- the first read after the bridge starts, or after the device is added again
- the first read after the broker connects again
- the first good read after failed reads (the device recovers)
- the read after a write (see [Writing Data Points](#writing-data-points))

The `timestamp` of a message is the time of the publish. A read that is not published does not change it, so a consumer sees the time of the last change or heartbeat.

### Failed Reads and Backoff

The bridge counts the consecutive failed reads of a device:

- After a failed read, while the count is below `maxRetries`, the bridge waits `interval` ms before the next read.
- When the count reaches `maxRetries`, the device goes to the `error` state. The bridge now polls the device less often (slow mode). It waits `retryBackoff` ms, and every further failed read doubles the wait, up to `maxRetryBackoff`. The bridge writes one log line when the device enters slow mode.
- The bridge keeps polling until a read works. Then the count goes back to 0, the device goes back to the `connected` state, and the bridge waits `interval` ms again. The bridge writes a log line `Device ... recovered after N failed polls`.

Example with `interval` 2000, `maxRetries` 3 and the default `retryBackoff` and `maxRetryBackoff`: after the 3rd failed read the waits are 4 s, 8 s, 16 s, 32 s, and then 60 s for every further failed read.

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

When a device enters slow mode, the bridge writes one more line to stderr:

```
Device ex9em-1 failed 3 polls in a row and is now polled less often: the wait starts at polling.retryBackoff and doubles up to polling.maxRetryBackoff
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
- Devices on the same serial port, or on the same TCP host and port, are read one at a time, in turn. The whole poll of a device (its dynamic and static points) runs before the poll of the next device. A device that is ready to poll again waits behind the devices that are already waiting, also in `continuous` mode. At the start this is the config order, but a slow or failed read can change the order. To keep the config order, see [Fixed Poll Order](#fixed-poll-order).
- A device ID can be used only once. If it is used twice, loading the second device fails with `devices[<N>] (<deviceId>): Device <deviceId> already exists`.
- If a device fails to load, for example because the driver is not installed or does not support a serial setting, the CLI prints the error with the position and ID of the device, as `devices[<N>] (<deviceId>): <message>`, and exits with code 1. `N` is the position of the device in `devices`, counting from 0. The devices after it are not loaded.
- A port that cannot be opened does not stop the bridge, for example a USB serial adapter that is not plugged in, or a TCP device that refuses the connection. The bridge prints a warning, the device starts in the `error` state, and the other devices start normally. A later poll opens the port (see [Unplugging a Serial Adapter](#unplugging-a-serial-adapter)). This does not work for a driver that reads from the device while it loads: that device fails to load.

### Fixed Poll Order

A line is one serial port, or one TCP host and port. Without a setting, the devices on a line take turns in the order their polls come (`pollOrder: "arrival"`). At the start this is the config order. A slow or failed read can change it, and the new order then stays.

With `pollOrder: "fixed"` in the `connection` of every device on the line, the devices take turns in the order of the `devices` array:

- A round polls each device once, from the first to the last, and then starts again from the first one. A slow or failed read does not change the order. The retries that the transport makes for a failed request stay in the turn of that device.
- A device that is not due skips its turn and the round goes on with the next device: its `interval` has not passed since its last read ended, or it waits in backoff after failed reads (see [Failed Reads and Backoff](#failed-reads-and-backoff)). It never makes the other devices wait.
- When no device is due, the line waits until the first device is due and then goes on with the device whose turn is next.
- `interval` and `continuous` devices can be on one line. `interDeviceDelay` works as without the setting.
- A device added with `bridge.addDevice()` takes its turn after the devices that are there already. A removed device leaves the round.

Use it when a meter does not answer right after one particular other meter. Put the devices in the order that works, and set `pollOrder: "fixed"`, so the order does not drift by itself. If the meter needs more time after the other meter's reply, on a serial port a longer `interDeviceDelay` (default: 150 ms) on the meter that does not answer can help too, with or without a fixed order. It also makes the logs and timings of different days easier to compare, and it gives each device exactly one turn per round.

```json
{
  "devices": [
    {
      "deviceId": "meter1",
      "driver": "@ya-modbus/driver-ex9em",
      "connection": { "type": "rtu", "port": "/dev/ttyUSB0", "slaveId": 1, "pollOrder": "fixed" }
    },
    {
      "deviceId": "meter2",
      "driver": "@ya-modbus/driver-ex9em",
      "connection": { "type": "rtu", "port": "/dev/ttyUSB0", "slaveId": 2, "pollOrder": "fixed" }
    }
  ]
}
```

After the devices are loaded, the CLI prints the order of each line with a fixed order. Disabled devices are not in it:

```
The devices on rtu:/dev/ttyUSB0 take turns in a fixed order: meter1, meter2
```

### Common Configuration Errors

The CLI prints a config error as `Error: Invalid configuration: <path>: <message>`. The path shows where the problem is. A problem at the top level of the file has no path: `Error: Invalid configuration: <message>`. In `devices.1.polling.interval`, `1` is the second device, because counting starts at 0. If there are several problems, they are all in the message, separated by commas.

**Unknown key**

```
Error: Invalid configuration: devices.0.connection: Unrecognized key: "paritty"
```

The key is not an option in that place. It is misspelled, or it belongs to the other connection type, for example `host` in an RTU connection. Fix the spelling or remove the key. A key at the top level of the file has no path: `Invalid configuration: Unrecognized key: "topicprefix"`.

**Wrong connection field**

```
Error: Invalid configuration: devices.0.connection.slaveId: Too big: expected number to be <=247
Error: Invalid configuration: devices.0.connection.type: Connection type must be 'rtu' or 'tcp'
Error: Invalid configuration: devices.0.connection.pollOrder: Poll order must be 'arrival' or 'fixed'
```

The path names the wrong field. Compare it with the RTU and TCP lists above. Without `connection` the message is `devices.0.connection: Connection is required`.

**Devices on one line with a different poll order**

```
Error: Invalid configuration: devices: The devices on rtu:/dev/ttyUSB0 must have the same connection.pollOrder: meter1 has 'fixed', meter2 has 'arrival' (not set)
```

All devices on one serial port, or on one TCP host and port, must have the same `pollOrder`. A device without it has `'arrival'`. Disabled devices count too, so a device can be enabled later without an error. Set the same value in every device on the line. `bridge.addDevice()` gives the same error for a device whose `pollOrder` differs from the devices on its line, and does not add the device.

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
- A device that does not answer keeps its connection busy while the bridge waits for the response. The transport tries every request up to 3 times, and each try can take up to `timeout` ms. A device that never answers costs the other devices on the same connection about 5 % of their reads at the longest wait (3 s of bus time every 63 s, with the default `timeout` and `maxRetryBackoff`). Use a larger `maxRetryBackoff` for devices that are often offline.
- The config file can contain the MQTT password. Make the file readable only by the user that runs the bridge, for example with `chmod 600 config.json`.
- Other users of the machine can see command line options such as `--mqtt-password` in the process list. Put credentials in the config file instead.
- `mqtt://` and `ws://` send the password without encryption. Use `mqtts://` or `wss://` when the broker is not on the same machine.

## Data Messages

The bridge publishes the data of a read on `{topicPrefix}/{deviceId}/data` (QoS 0, not retained):

```json
{
  "deviceId": "meter1",
  "timestamp": 1760000000000,
  "readMs": 180,
  "data": { "voltage": 230.1, "serial_number": "A1" }
}
```

| Field       | Description                                                                                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `timestamp` | When the read was done and the message was made, in milliseconds since the epoch                                                                                |
| `readMs`    | How long the read took, in milliseconds. It does not include the time the bridge waited for the connection to be free. The read started at `timestamp - readMs` |
| `data`      | The values of the polled data points                                                                                                                            |

The values of `static` points come from the first read that worked (see [Which Data Points Are Polled](#which-data-points-are-polled)). They are not read again, so `timestamp` and `readMs` are not their age.

## Bridge Status

The bridge publishes `online` or `offline` (plain text, not JSON) to `{topicPrefix}/bridge/status`, retained, so a new subscriber gets it at once:

- `online` - after every connect to the broker, also after a reconnect
- `offline` - when the bridge stops cleanly (`bridge.stop()`, or `SIGINT`/`SIGTERM` for the CLI)
- `offline` - when the connection is lost without a clean stop (crash, power loss, network down). The bridge registers this message as its MQTT last-will, and the broker publishes it (QoS 1, retained) when it notices the lost connection. This takes up to 1.5 times the MQTT keepalive (60 seconds by default), or less when the network connection closes.

The retained device status (see [Device States](#device-states)) is the last state the bridge published. It stays on the broker after the bridge stops, so read it together with the bridge status: when the bridge is `offline`, the state of the devices is not known.

## Device States

Each device has a `state`. `bridge.getDevice()` and `bridge.listDevices()` return it.

| State          | Meaning                                                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disconnected` | The device is disabled (`enabled: false`). The bridge does not poll it.                                                                                                                              |
| `connecting`   | The bridge is loading the driver.                                                                                                                                                                    |
| `connected`    | The driver is loaded. The device is not in the `error` state.                                                                                                                                        |
| `error`        | `maxRetries` consecutive reads failed (slow mode: the bridge polls less often), or the port was not open when the device was added (the bridge polls at `interval` until `maxRetries` reads failed). |

How the state changes:

- `disconnected` → `connecting` - the device is added and is enabled
- `connecting` → `connected` - the driver is loaded. If the driver does not load, `addDevice()` fails and the device is not added.
- `connected` → `error` - `maxRetries` consecutive reads failed (at least 1, so `0` works like `1`), or the port of the device is not open when the device is added. In the second case `addDevice()` works, and the state changes right after the driver is loaded.
- `error` → `connected` - the next read works

The bridge publishes the state of each device to `{topicPrefix}/{deviceId}/status`, retained: when the device is added, when the state changes between `connected` and `error` or the list of failed data points changes, and after every connect to the broker. A device that works sends its first status when it is added, and no more messages while it keeps working. A new subscriber gets the last status at once:

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

The `errors` field is only there when the state is `error`. It has the message of the last failed read, or why the port could not be opened. The `failedDataPoints` field is only there when the state is `connected` and the device refuses some data points (see [Data Points the Device Refuses](#data-points-the-device-refuses)):

```json
{
  "deviceId": "sensor1",
  "timestamp": 1760000000000,
  "state": "connected",
  "failedDataPoints": ["total_energy", "export_energy"]
}
```

Status messages use QoS 0 and are retained. If the bridge is not connected to the broker when the state changes, the message is lost, but the bridge publishes the state of every device again when it connects. `bridge.removeDevice()` deletes the retained status of the device (it publishes an empty retained message, also when the bridge is not connected: the message waits for the connect). Use `bridge.getDevice()` to read the current state at any time.

The `connected` field of the device status is deprecated. Use `state` instead. `connected` is `true` only when `state` is `connected`.

## Device Stats

With `statsInterval` set (seconds), the bridge publishes the poll statistics of each polled device to `{topicPrefix}/{deviceId}/stats` every `statsInterval` seconds. One timer serves all devices. Messages use QoS 0 and are not retained. The bridge does not publish while it is not connected to the broker. A device that is removed stops sending stats.

```json
{
  "deviceId": "sensor1",
  "timestamp": 1760000010000,
  "polls": 120,
  "errors": 3,
  "consecutiveFailures": 0,
  "lastSuccess": 1760000009500,
  "avgReadMs": 182.5,
  "readsPerSecond": 0.2
}
```

| Field                 | Meaning                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `timestamp`           | Time of the message in milliseconds since the epoch, as in the other messages                                        |
| `polls`               | Polls of the device since it was added, failed ones included                                                         |
| `errors`              | Failed polls since the device was added                                                                              |
| `consecutiveFailures` | Failed polls in a row; `0` after a poll that worked                                                                  |
| `lastSuccess`         | Time of the last poll that worked (milliseconds since the epoch), `null` before the first one                        |
| `avgReadMs`           | Average time of the polls that worked since the previous message, in milliseconds; `null` if none worked in the time |
| `readsPerSecond`      | Polls that worked per second since the previous message                                                              |

`polls`, `errors` and `consecutiveFailures` count from the time the device was added (the numbers start again at `0` when the bridge restarts). `avgReadMs` and `readsPerSecond` cover only the time since the previous message, so they show the present speed. The read time is the time of the Modbus requests of one poll. It does not include the wait for the turn on a shared bus. The read after a write is not counted.

With `statsLog` the bridge also writes one line per device to stdout at every interval, also when the broker is not connected:

```
Stats of device sensor1: 120 polls, 3 errors, 0 failures in a row, last success 2025-10-09T08:53:29.500Z, average read 183 ms, 0.2 reads/s
```

## Writing Data Points

The bridge subscribes to `{topicPrefix}/{deviceId}/set` for each enabled device. A message on this topic is a JSON object of data point IDs and the values to write:

```json
{ "setpoint": 21.5, "mode": 2 }
```

- The device takes writes only when its config has `allowWrites: true`.
- Before the bridge writes anything, it checks every point of the message. The point must exist in the driver and be writable: `access` is `'w'` or `'rw'`. A point without `access` is read-only. If the device does not allow writes, or a point does not exist or is read-only, the bridge writes nothing.
- The bridge writes the points with the driver, one at a time, in the order of the message. If the driver fails to write a point, for example because the device rejects the value, the bridge stops. The points before it stay written, and the result lists them in `written`. The points after it are not written.
- A write waits for its turn on the serial port or TCP connection, like a poll. It never runs in the middle of a poll. On a serial port, the pause between devices (`interDeviceDelay`) applies to it too.
- Right after the writes, the bridge reads the device and publishes the data on `{topicPrefix}/{deviceId}/data`, without waiting for the next poll. This read covers the points that a poll reads (see [Which Data Points Are Polled](#which-data-points-are-polled)): write-only and `on-demand` points are not read, and a `static` point keeps its first value. The bridge reads the device also after a driver error, so the data shows these points as they are on the device. After a timeout, the failed point may still have reached the device, even though it is not in `written`. When this read works, it counts as a good poll: the count of failed polls goes back to 0, and a device in the `error` state goes back to `connected`. The next poll stays at the time it was planned. If this read fails, the bridge logs a warning and the next poll reads the device. The failed read does not count as a failed poll.
- A message published with retain is written once: the broker clears the retain flag when it forwards the message to the bridge. The broker also keeps a copy and sends it again with the retain flag on every subscribe, at every start of the bridge and after every reconnect. The bridge ignores this copy and logs a warning. Publish write messages without retain.

The bridge publishes the result of every write message on `{topicPrefix}/{deviceId}/set/result`, except a retained copy that it ignores. Result messages use QoS 0 and are not retained, the same as data messages. When all points are written:

```json
{
  "deviceId": "thermostat1",
  "timestamp": 1760000000000,
  "ok": true,
  "values": { "setpoint": 21.5, "mode": 2 }
}
```

When the write failed:

```json
{
  "deviceId": "thermostat1",
  "timestamp": 1760000000000,
  "ok": false,
  "error": "Failed to write data point mode: Illegal data value",
  "written": ["setpoint"],
  "values": { "setpoint": 21.5, "mode": 9 }
}
```

`written` lists the IDs of the points that the driver wrote before the error, in the order of the message. It is `[]` when nothing was written. `values` is the message that was received. It is missing when the message is not a JSON object with at least one point. `error` says what is wrong, and names the point when the problem is a point:

| `error`                                                             | Cause                                                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Device <deviceId> does not allow writes (allowWrites is not true)` | The device config does not have `allowWrites: true`. Nothing is written.                                |
| `Data point <id> does not exist`                                    | The driver has no data point with this ID. Nothing is written.                                          |
| `Data point <id> is read-only`                                      | The data point cannot be written. Nothing is written.                                                   |
| `Failed to write data point <id>: <message>`                        | The driver failed to write this point. The points before it are written and listed in `written`.        |
| `The message is not valid JSON`                                     | Nothing is written.                                                                                     |
| `The message must be a JSON object of data point IDs and values`    | The message is an array, a number, a string, `null` or an empty object. Nothing is written.             |
| `Device <deviceId> is not polled`                                   | The device was removed, or the bridge stopped, while the write waited for its turn. Nothing is written. |

The bridge also logs every failed write to stderr, as `Write to device <deviceId> failed: <error>`.

## Unplugging a Serial Adapter

The bridge keeps running when a USB serial adapter is unplugged:

- Polls of the devices on that port fail with an error like
  `Connection to /dev/ttyUSB0 lost: port closed (/dev/ttyUSB0 9600 8N1, slave 1, FC03 read holding registers, address 0 (0x0000), count 2)` (or `... lost: EIO: i/o error, write ...` when a
  write failed). The device status shows the error (`errors`, `consecutiveFailures`). The device
  is polled again on its normal schedule: after `interval`, and after `retryBackoff` (growing up to
  `maxRetryBackoff`) once `maxRetries` polls failed in a row.
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
