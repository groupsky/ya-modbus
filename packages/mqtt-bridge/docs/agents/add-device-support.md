---
paths: packages/mqtt-bridge/**/*.ts
---

# Adding Device Support

When adding new device types, ensure the bridge can:

- Load drivers dynamically
- Handle driver-specific configuration
- Publish driver-specific data points

## Implementation Checklist

BEFORE adding device support:

- READ docs/agents/driver-development.md
- VERIFY driver implements ModbusDriver interface
- UNDERSTAND data point structure for device

## Driver Integration

1. Driver loading via npm package resolution
2. Configuration validation using driver schema
3. Data point mapping and transformation
4. Error handling for driver-specific failures

See: packages/mqtt-bridge/src/device-manager.ts for device lifecycle
See: @ya-modbus/driver-sdk for driver interface
See: docs/agents/driver-development.md for complete guide
