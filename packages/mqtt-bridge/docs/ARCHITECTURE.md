# MQTT Bridge Architecture

## Overview

The MQTT bridge orchestrates the following components:

1. **MQTT Client** - Connects to MQTT broker and manages subscriptions (`src/index.ts`)
2. **Device Manager** - Handles device lifecycle and driver loading (`src/device-manager.ts`, `src/driver-loader.ts`)
3. **Polling Scheduler** - Coordinates polling across devices (`src/polling-scheduler.ts`)
4. **State Manager** - Persists and recovers bridge state (future)
5. **Transport Manager** - Manages Modbus connections (RTU/TCP) and shares one connection between the devices on a serial port or a TCP host and port (`TransportManager` in `@ya-modbus/transport`, used by `src/driver-loader.ts`)

## MQTT Topic Structure

### Configuration Topics

- `modbus/config/*` - Configuration commands (future)
- `modbus/config/devices/add` - Add new device (future)
- `modbus/config/devices/remove` - Remove device (future)
- `modbus/config/devices/{deviceId}/polling` - Update polling config (future)
- `modbus/config/devices/{deviceId}/enabled` - Enable/disable device (future)
- `modbus/config/bridge/reload` - Reload configuration (future)

### Data Topics

- `modbus/{deviceId}/data` - Device data publications (`src/index.ts`)
- `modbus/{deviceId}/status` - Device state changes (`src/index.ts`, see README.md, Device States)
- `modbus/{deviceId}/errors/*` - Device errors (future)
- `modbus/bridge/status/*` - Bridge health and status (future)

## State Management

- Persistent state storage (JSON format with schema versioning) (future)
- Auto-save on changes, periodic saves, graceful shutdown (future)
- Recovery on startup with validation (future)

## Bridge Orchestration

The MQTT bridge acts as the central coordinator between Modbus devices and MQTT:

- Device lifecycle management (add, remove, enable/disable)
- Polling scheduler coordination
- State persistence and recovery (future)
- MQTT topic organization

## Current Implementation Status

### Phase 1 (Completed)

- MQTT connection management
- Topic publish/subscribe
- Device registry
- Basic device lifecycle (add/remove/list)

### Phase 2 (Completed)

- Driver integration (dynamic driver loading, devices from the config file)
- Polling coordination (interval and continuous mode, backoff after failed reads)
- Data and status publishing

### Phase 3 (Planned)

- State persistence
- MQTT configuration topics
- Bridge status publishing

See: ../../docs/ARCHITECTURE.md for complete system architecture
