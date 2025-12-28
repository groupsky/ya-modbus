# Driver Types - Agent Guide

## Overview

Core TypeScript interfaces for Modbus device drivers and transport layers.

## Key Interfaces

### DeviceDriver

Driver interface that devices must implement.

**Methods**:

- `readDataPoint(id)` - Read single data point
- `readDataPoints(ids[])` - Batch read optimization
- `writeDataPoint(id, value)` - Write single data point

**Fields**:

- `name`, `manufacturer`, `model` - Device identification
- `dataPoints` - Available data point definitions

See: `src/device-driver.ts`

### Transport

Modbus protocol layer (RTU/TCP).

**Methods**: readCoils, readInputRegisters, readHoldingRegisters, writeMultipleCoils, writeMultipleRegisters, connect, disconnect, isConnected

See: `src/transport.ts`

## Multi-Device Driver Support

**DeviceMetadata Interface**: Single source of truth for multi-device driver packages.

**Structure**:

```typescript
export const DEVICE_METADATA = {
  deviceId: {
    name: 'Official Name',
    manufacturer: 'Manufacturer',
    model: 'MODEL',
    description: 'Brief description',
    dataPoints: SHARED_DATA_POINTS, // Device-specific data points
    defaultConfig: {
      /* Default serial/connection settings */
    },
    supportedConfig: {
      /* Valid parameter ranges */
    },
  },
} as const satisfies Record<string, DeviceMetadata>
```

**Key points**:

- Device ID comes from object key (lowercase: `md01`, `md02`)
- Device Name is official product name (in metadata: `XY-MD01`, `XY-MD02`)
- Configs embedded in metadata (single source of truth)
- Use `as const satisfies Record<string, DeviceMetadata>` for type safety
- `dataPoints` field specifies device-specific data points

**Device selection**: Users specify `deviceType` in DriverConfig to select variant.

See:

- `src/device-driver.ts` for DeviceMetadata interface
- `docs/MULTI-DEVICE-PATTERN.md` for implementation guide
- `packages/ya-modbus-driver-xymd1` for reference implementation

## Data Point Types

**Standard types**: float, integer, boolean, string, timestamp, enum

**Access modes**:

- `r` - Read-only (measurements, status)
- `w` - Write-only (commands, triggers)
- `rw` - Read-write (configuration, setpoints)

**Poll types**:

- `dynamic` - Frequently changing (measurements)
- `static` - Read once at startup (serial number, firmware)
- `on-demand` - Manual requests only (configuration)

Full definitions: `src/device-driver.ts` DataPoint interface

## Configuration Types

**DefaultConfig**: Factory default connection settings for a device.

Fields: baudRate, parity, dataBits, stopBits, defaultAddress

**SupportedConfig**: Valid parameter ranges and options.

Fields: validBaudRates, validParity, validDataBits, validStopBits, validAddressRange

Used by discovery to constrain parameter search space.

See: `src/device-driver.ts`

## Testing

No runtime code - pure TypeScript types. Type tests verify interface contracts.

Example test approach: Create mock implementations to verify interface completeness.

See: Device driver packages for concrete implementation tests
