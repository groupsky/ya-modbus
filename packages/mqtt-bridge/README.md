# @ya-modbus/mqtt-bridge

MQTT bridge for ya-modbus - orchestrates device management, polling, and MQTT publishing.

## Overview

The MQTT bridge is the core component that connects Modbus devices to MQTT, providing:

- **Device Lifecycle Management** - Add, remove, enable/disable devices at runtime
- **Polling Coordination** - Schedule and coordinate polling across multiple devices
- **MQTT Publishing** - Publish device data, status, and errors to MQTT topics
- **Runtime Configuration** - Configure devices and bridge via MQTT commands
- **State Persistence** - Save and restore bridge state across restarts

## Installation

```bash
npm install @ya-modbus/mqtt-bridge
```

## Architecture

The MQTT bridge orchestrates the following components:

1. **MQTT Client** - Connects to MQTT broker and manages subscriptions
2. **Device Manager** - Handles device lifecycle and driver loading
3. **Polling Scheduler** - Coordinates polling across devices
4. **State Manager** - Persists and recovers bridge state
5. **Transport Manager** - Manages Modbus connections (RTU/TCP)

## MQTT Topic Structure

### Configuration Topics

- `modbus/config/devices/add` - Add new device
- `modbus/config/devices/remove` - Remove device
- `modbus/config/devices/{deviceId}/polling` - Update polling config
- `modbus/config/devices/{deviceId}/enabled` - Enable/disable device
- `modbus/config/bridge/reload` - Reload configuration

### Data Topics

- `modbus/{deviceId}/data` - Device data publications
- `modbus/{deviceId}/status/*` - Device status
- `modbus/{deviceId}/errors/*` - Device errors
- `modbus/bridge/status/*` - Bridge health and status

## Usage

```typescript
import { createBridge } from '@ya-modbus/mqtt-bridge'

const bridge = await createBridge({
  mqtt: {
    url: 'mqtt://localhost:1883',
    clientId: 'modbus-bridge',
  },
  stateFile: './bridge-state.json',
})

await bridge.start()
```

## Configuration

See the [Architecture documentation](../../docs/ARCHITECTURE.md) for complete configuration details.

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
