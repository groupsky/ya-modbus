# MQTT Bridge Development Phases

This document outlines the planned development phases for the MQTT bridge package.

## Phase 1: Foundation (COMPLETED ✅)

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

## Phase 2: Driver Integration (NEXT)

**Goal**: Connect devices to actual Modbus hardware via drivers

**Key Features**:

- Dynamic driver loading from npm packages
- Driver lifecycle management (connect/disconnect)
- Polling coordination across devices
- Data point reading via driver interface
- Data transformation and publishing to MQTT
- Error handling and reconnection logic

**Implementation Tasks**:

### 2.1 Driver Loading

- Load driver packages dynamically using `import()`
- Validate driver implements `ModbusDriver` interface
- Cache loaded drivers for reuse
- Handle driver loading errors

### 2.2 Device Connection

- Update `DeviceManager` to manage driver instances
- Connect devices on `addDevice()`
- Disconnect devices on `removeDevice()`
- Track connection state (connecting/connected/disconnected/error)
- Implement reconnection logic for failed connections

### 2.3 Polling System

- Create `PollingScheduler` class
- Support per-device polling intervals
- Coordinate polling to avoid bus conflicts (RTU)
- Handle polling errors without stopping scheduler
- Implement backoff for consecutive failures

### 2.4 Data Publishing

- Read data points from drivers
- Transform driver data to MQTT payloads
- Publish to `modbus/{deviceId}/data` topic
- Include timestamps and metadata
- Handle publish failures gracefully

### 2.5 Testing

- Mock driver interface for tests
- Test driver loading and lifecycle
- Test polling coordination
- Test data transformation
- Test error scenarios

### 2.6 Integration Tests

- Set up Aedes MQTT broker for integration testing
- Test full MQTT bridge lifecycle (connect, publish, subscribe, disconnect)
- Test CLI signal handlers (SIGTERM, SIGINT) with real process
- Test MQTT reconnection and resubscription behavior
- Test end-to-end device data flow (driver → bridge → MQTT)
- Test concurrent device operations
- Test bridge behavior under network failures
- Test message handler error handling with real MQTT messages

**Dependencies**:

- `@ya-modbus/driver-types` (already added)
- `@ya-modbus/driver-sdk` (already added)

**Files to Modify**:

- `src/device-manager.ts` - Add driver loading and instance management
- `src/index.ts` - Integrate polling and data publishing
- `src/types.ts` - Add polling configuration types
- Add `src/polling-scheduler.ts` - New polling coordinator
- Add `src/driver-loader.ts` - Dynamic driver loading

**Estimated Complexity**: High (2-3 weeks)

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
- `src/config.ts` - Support state directory configuration

### 3.4 Systemd Integration

- Create systemd service unit file
- Support running as system service
- Automatic restart on failure
- Logging to journald
- Service management (start/stop/restart/status)
- Install/uninstall scripts

**Files to Create**:

- `systemd/ya-modbus-bridge.service` - Systemd unit file
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
- Add integration tests in Phase 2
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
**Phase 2**: 📋 Ready to start
**Phase 3**: 📅 Planned
**Phase 4**: 💭 Future consideration

## Next Steps

1. Review and approve Phase 1 PR
2. Create Phase 2 implementation plan
3. Begin driver integration work
4. Set up integration test environment with actual Modbus devices/simulators
