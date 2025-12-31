# MQTT Bridge Package

MQTT bridge for ya-modbus - orchestrates device management, polling, and MQTT publishing.

## Required Reading by Task

BEFORE making ANY changes:
→ READ ../../docs/agents/git.md
→ READ ../../docs/agents/code-quality.md
→ READ ../../docs/agents/testing.md

BEFORE adding device support:
→ READ docs/agents/add-device-support.md
→ READ ../../docs/agents/driver-development.md

BEFORE writing tests:
→ READ docs/agents/testing.md

## Purpose

This package provides the core bridge functionality that:

- Manages MQTT connections and topic structure
- Orchestrates device lifecycle (registration, removal, status)
- Coordinates polling across multiple devices (future)
- Publishes device data and status to MQTT topics (future)
- Handles runtime configuration via MQTT (future)

## Key Concepts

### Bridge Orchestration

The MQTT bridge acts as the central coordinator between Modbus devices and MQTT.

See: docs/ARCHITECTURE.md for complete architecture
See: ../../docs/ARCHITECTURE.md for system architecture

### MQTT Topic Structure

See: docs/ARCHITECTURE.md for topic structure

### State Management

See: docs/ARCHITECTURE.md for state management details

## Common Tasks

### Adding Device Support

See: docs/agents/add-device-support.md

### Testing

See: docs/agents/testing.md

## References

- docs/ARCHITECTURE.md - Bridge architecture
- ../../docs/ARCHITECTURE.md - System architecture
- ../../docs/agents/testing.md - Testing guidelines
- ../../docs/agents/code-quality.md - Code quality guidelines
