# XYMD1 Driver - Agent Guide

## Overview

Multi-device driver for XY-MD01 and XY-MD02 temperature and humidity sensors.

**Key characteristic**: Both devices are **Modbus-identical** - same register layout, cannot be distinguished programmatically, only by physical appearance.

## Device Metadata

**Single source of truth**: `DEVICE_METADATA` exported constant

**Supported devices**:

- `md01`: XY-MD01 (typical config: parity none)
- `md02`: XY-MD02 (typical config: parity even)

**Shared components**:

- `SHARED_DATA_POINTS` - Both devices have identical data points
- `SHARED_SUPPORTED_CONFIG` - Both support same baud rates and parameters

**Only difference**: `defaultConfig.parity` (none vs even)

Device selection via `deviceType` parameter in DriverConfig.

See: `src/index.ts` for DEVICE_METADATA implementation

## Register Mapping

**Input registers** (read-only measurements):

- 1-2: Temperature and humidity (×10 scaling)

**Holding registers** (read-write configuration):

- 0x101: Device address (1-247)
- 0x102: Baud rate setting
- 0x103: Temperature correction (signed, ×10, -100 to +100)
- 0x104: Humidity correction (signed, ×10, -100 to +100)

## Data Points

Six data points defined in `SHARED_DATA_POINTS`:

1. `temperature` - Read-only, float, °C
2. `humidity` - Read-only, float, %
3. `device_address` - Read-write, integer, 1-247 (on-demand poll)
4. `baud_rate` - Read-write, enum, 9600/14400/19200 (on-demand poll)
5. `temperature_correction` - Read-write, float, -10.0 to +10.0°C (on-demand poll)
6. `humidity_correction` - Read-write, float, -10.0 to +10.0%RH (on-demand poll)

## Calibration

Correction registers allow sensor calibration:

- Applied immediately (no device restart required)
- Persist across power cycles
- Range: -10.0 to +10.0 for both temperature and humidity

Corrected values reflected in temperature/humidity input registers.

See: README.md "Calibration" section

## Batch Read Optimization

`readDataPoints()` optimizes Modbus transactions:

- Single read for all input registers (temperature + humidity)
- Batches adjacent holding registers:
  - 0x101-0x102 together (device_address + baud_rate)
  - 0x103-0x104 together (corrections)
  - 0x101-0x104 all together if all 4 requested

See: `src/index.ts:326` readDataPoints implementation

## Testing

Tests cover:

- DEVICE_METADATA structure and type safety
- Both device variants (md01, md02)
- Device selection via deviceType
- Default selection (no deviceType → md01)
- Invalid deviceType error messages
- Register read/write operations
- Batch read optimization
- Encoding/decoding with scaling (×10)

See: `src/index.test.ts`

## Usage Examples

See: README.md for CLI and programmatic usage examples
