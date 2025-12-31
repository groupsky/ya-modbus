# MQTT Bridge Package

MQTT bridge for ya-modbus - orchestrates device management, polling, and MQTT publishing.

## Purpose

This package provides the core bridge functionality that:

- Manages MQTT connections and topic structure
- Orchestrates device lifecycle (registration, removal, status)
- Coordinates polling across multiple devices
- Publishes device data and status to MQTT topics
- Handles runtime configuration via MQTT

## Key Concepts

### Bridge Orchestration

The MQTT bridge acts as the central coordinator between Modbus devices and MQTT:

- Device lifecycle management (add, remove, enable/disable)
- Polling scheduler coordination
- State persistence and recovery
- MQTT topic organization

### MQTT Topic Structure

See docs/ARCHITECTURE.md for complete topic structure:

- `modbus/config/*` - Configuration commands
- `modbus/{deviceId}/data` - Device data publications
- `modbus/{deviceId}/status/*` - Device status
- `modbus/{deviceId}/errors/*` - Device errors
- `modbus/bridge/status/*` - Bridge health and status

### State Management

- Persistent state storage (JSON format with schema versioning)
- Auto-save on changes, periodic saves, graceful shutdown
- Recovery on startup with validation

## Common Tasks

### Adding Device Support

When adding new device types, ensure the bridge can:

- Load drivers dynamically
- Handle driver-specific configuration
- Publish driver-specific data points

### Testing

- Mock MQTT client for unit tests
- Test device lifecycle operations
- Test polling coordination
- Test state persistence and recovery
- Test error handling and reconnection logic

## Architecture References

- docs/ARCHITECTURE.md - Complete system architecture
- docs/agents/testing.md - Testing patterns
- docs/agents/code-quality.md - Code quality guidelines
