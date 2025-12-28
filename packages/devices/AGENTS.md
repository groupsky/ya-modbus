# Devices - Agent Guide

## Overview

Device driver implementations for Modbus devices. Each driver translates device-specific Modbus registers to standardized data points.

## Multi-Device Driver Pattern

Use when multiple device models share the same Modbus interface but differ in default configuration.

**Single source of truth**: `DEVICE_METADATA` exported constant

**Structure**:

- Device ID: Object key (lowercase identifiers like `md01`, `md02`)
- Device Name: Official product name (like `XY-MD01`, `XY-MD02`)
- Configs: Embedded in metadata (defaultConfig, supportedConfig)
- Data Points: Per-device dataPoints field

**When to use**:

- Devices have identical register layouts
- Only default configurations differ (baud rate, parity, address)
- Want to reduce package duplication

**When NOT to use**:

- Different register layouts or data points
- Different protocols or special handling required

Full guide: `docs/MULTI-DEVICE-PATTERN.md`

## Reference Implementations

**Multi-device driver**: `packages/ya-modbus-driver-xymd1`

- Supports XY-MD01 and XY-MD02 (Modbus-identical)
- Shared data points and supported config
- Different default parity (none vs even)

See: `packages/ya-modbus-driver-xymd1/src/index.ts`

## Device Selection

Users specify device variant via `deviceType` parameter:

```typescript
const driver = await createDriver({
  transport,
  slaveId: 1,
  deviceType: 'md02', // Select specific variant
})
```

If omitted, driver defaults to first device in DEVICE_METADATA.

## Discovery Integration

Discovery automatically tries all device variants in DEVICE_METADATA when `--device` not specified.

Uses `defaultConfig` from each device to prioritize parameter combinations.

Note: If devices are Modbus-identical (cannot be distinguished programmatically), users must manually specify device type based on physical markings.

See: `packages/cli/src/discovery/` for discovery implementation

## Creating New Drivers

1. Implement `DeviceDriver` interface from `@ya-modbus/driver-types`
2. Define data points (not raw registers)
3. For multi-device: Export `DEVICE_METADATA` with per-device configs
4. Add co-located tests
5. Document in README.md

See: `packages/driver-types/AGENTS.md` for interface details
