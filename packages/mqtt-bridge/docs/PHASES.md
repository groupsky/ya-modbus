# MQTT Bridge Development Phases

This document lists the development phases of the MQTT bridge package and the status of each.

## Phase 1: Foundation (COMPLETED ✅, PR #86)

**Goal**: Establish core bridge infrastructure

**Completed Features**:

- MQTT connection management with authentication
- Topic publish/subscribe with QoS support
- Device registry (add/remove/list/get)
- Bridge lifecycle (start/stop/status)
- Configuration loading with Zod validation
- CLI with config file support
- Comprehensive test coverage (100%)

**Status**: Merged and production-ready

---

## Phase 2: Driver Integration (COMPLETED ✅, PR #90)

**Goal**: Connect devices to actual Modbus hardware via drivers

**Completed Features**:

- ✅ Dynamic driver loading from npm packages, with validation of the package name (`src/driver-loader.ts`)
- ✅ Device lifecycle: the driver is loaded on `addDevice()` and unloaded on `removeDevice()`. Device states: `disconnected`, `connecting`, `connected`, `error` (`src/device-manager.ts`, PR #537)
- ✅ Shared transports, so devices on one serial port or TCP host and port do not collide (`TransportManager` in `@ya-modbus/transport`)
- ✅ Polling of all devices with per-device intervals. A failed read does not stop the scheduler, and polling slows down to `retryBackoff` after repeated failures, then doubles the wait up to `maxRetryBackoff` (`src/polling-scheduler.ts`)
- ✅ Continuous polling mode (PR #383)
- ✅ Data publishing to `{topicPrefix}/{deviceId}/data` and state publishing to `{topicPrefix}/{deviceId}/status` (`src/index.ts`)
- ✅ Devices in the config file are loaded on startup (`src/cli.ts`, PR #341, PR #352)
- ✅ MQTT reconnection with automatic resubscription (`src/index.ts`)
- ✅ Unit tests with mocked drivers, reconnection tests with a mocked MQTT client (`src/index.reconnect.test.ts`) and integration tests with an Aedes MQTT broker (`src/index.integration.test.ts`, `src/cli.integration.test.ts`)

**Status**: Merged and production-ready

---

## Phase 3: State Persistence & MQTT Config (PLANNED)

**Goal**: Production-grade reliability and runtime configurability

**Key Features**:

### 3.1 State Persistence

- Save bridge state to JSON file
- Schema versioning for state files
- Auto-save on device changes
- Periodic saves during operation
- Graceful shutdown with state save
- State recovery on startup
- Migration for schema changes

### 3.2 MQTT Configuration Topics

- Subscribe to `modbus/config/*` topics
- Handle `modbus/config/devices/add` - Add device via MQTT
- Handle `modbus/config/devices/remove` - Remove device via MQTT
- Handle `modbus/config/devices/{deviceId}/polling` - Update polling config
- Handle `modbus/config/devices/{deviceId}/enabled` - Enable/disable device
- Handle `modbus/config/bridge/reload` - Reload configuration
- Publish command responses with status

### 3.3 Bridge Status Publishing

- Publish to `modbus/bridge/status/health` - Overall health
- Publish to `modbus/bridge/status/devices` - Device count and list
- Publish to `modbus/bridge/status/mqtt` - MQTT connection status
- Include uptime, memory usage, error counts

**Implementation Tasks**:

### State Persistence

- Create `StateManager` class
- Define state schema with Zod
- Implement save/load with atomic writes
- Add state validation on load
- Handle migration between schema versions
- Add tests for state operations

### MQTT Config Handlers

- Create `ConfigHandler` class
- Parse and validate MQTT config messages
- Execute config commands safely
- Publish command responses
- Add tests for all config commands

### Status Publishing

- Create `StatusPublisher` class
- Publish on interval (e.g., every 30s)
- Publish on events (startup, shutdown, errors)
- Include relevant metrics
- Add tests for status publishing

**Files to Create**:

- `src/state-manager.ts` - State persistence
- `src/config-handler.ts` - MQTT config command handling
- `src/status-publisher.ts` - Bridge status publishing

**Files to Modify**:

- `src/index.ts` - Integrate state manager and config handler
- `src/types.ts` - Add state and config types
- `src/utils/config.ts` - Use the state directory configuration

### 3.4 Systemd Integration (partly completed)

- ✅ Systemd service unit file with automatic restart on failure and logging to journald (`systemd/ya-modbus-bridge.service`, PR #157)
- ✅ Installation guide and example config and environment files (`systemd/INSTALL.md`, `systemd/config.json.example`, `systemd/environment.example`)
- Install/uninstall scripts

**Files to Create**:

- `scripts/install-service.sh` - Service installation script
- `scripts/uninstall-service.sh` - Service removal script

**Estimated Complexity**: Medium (1-2 weeks)

---

## Phase 4: Advanced Features (FUTURE)

**Goal**: Enterprise-grade capabilities

**Potential Features**:

- TLS/SSL support with certificate validation
- Multiple MQTT broker support (failover)
- Rate limiting for polling and publishing
- Data aggregation and batching
- Historical data querying
- Prometheus metrics export
- Web-based monitoring dashboard
- Device discovery via Modbus scanning
- Driver hot-reload without restart
- Advanced error recovery strategies

**Status**: Not yet scoped

---

## Implementation Strategy

### Incremental Development

- Each phase builds on previous phases
- Maintain backward compatibility
- Keep existing tests passing
- Add new tests for new features

### Testing Requirements

- Maintain 95% test coverage for all phases
- Cover MQTT flows with integration tests that use an Aedes broker
- Mock external dependencies (drivers, filesystem, MQTT)
- Test error scenarios thoroughly

### Documentation Updates

- Update README.md for new features
- Update ARCHITECTURE.md with new components
- Add examples for new functionality
- Update AGENTS.md with new task guidelines

### Review and Approval

- Each phase requires PR review
- Architectural changes require design review
- Breaking changes require major version bump

---

## Current Status

**Phase 1**: ✅ Complete (PR #86)
**Phase 2**: ✅ Complete (PR #90)
**Phase 3**: 📅 Planned (3.4 is partly completed)
**Phase 4**: 💭 Future consideration

## Open Work

1. State persistence (3.1)
2. MQTT configuration topics (3.2)
3. Bridge status publishing (3.3)
4. Install/uninstall scripts for the systemd service (3.4)
