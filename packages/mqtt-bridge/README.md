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
  "topicPrefix": "modbus"
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
