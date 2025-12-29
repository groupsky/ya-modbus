# Device Driver Development Guide

Guide for creating third-party device drivers for ya-modbus-mqtt-bridge.

## Overview

Device drivers are distributed as npm packages that:

- Implement the driver interface from `@ya-modbus/driver-sdk`
- Define semantic data points (not raw registers)
- Can be loaded dynamically by the bridge
- Are tested independently using provided tooling

## Quick Start

### 1. Create Driver Package

**Recommended naming**: `ya-modbus-driver-<name>`

- Examples: `ya-modbus-driver-solar`, `ya-modbus-driver-energymeter`
- Makes drivers easily discoverable
- Consistent with ecosystem conventions
- Can use scoped packages: `@acme/ya-modbus-driver-solar`

```bash
# Create new npm package with recommended naming
mkdir ya-modbus-driver-solar
cd ya-modbus-driver-solar
npm init -y

# Install SDK (production dependency)
npm install @ya-modbus/driver-sdk

# Install dev tools (development only)
npm install --save-dev @ya-modbus/driver-dev-tools typescript @types/node
```

### 2. Package Structure

```
my-modbus-driver/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Driver export
│   ├── device.ts             # Driver implementation
│   └── device.test.ts        # Tests
└── ya-modbus-driver.json     # Optional metadata
```

### 3. Implement Driver(s)

**Single package can export multiple device types:**

- Related devices from same manufacturer
- Device family with shared logic but different capabilities
- Multiple firmware versions with different register layouts

See `packages/devices/` for reference implementations.

**Required**: Implement `DeviceDriver` interface from `@ya-modbus/driver-sdk`.

**Key responsibilities**:

- Define data point catalog (semantic names, units, types)
- Transform raw Modbus registers to/from standard data types
- Declare device constraints (forbidden ranges, batch limits)
- Handle device-specific quirks (auth sequences, delays)

**Example multi-device package (functional approach):**

```typescript
// src/index.ts - Single factory function for all device types
export const createDriver = async (config) => {
  const { device, transport, slaveId } = config

  // Auto-detect device type if not specified
  const detectedType = device || (await detectDeviceType(transport, slaveId))

  // Return device-specific implementation
  switch (detectedType) {
    case 'X1000':
      return { name: 'SolarInverterX1000', maxPower: 1000 /* ... */ }
    case 'X2000':
      return { name: 'SolarInverterX2000', maxPower: 2000 /* ... */ }
    case 'X5000':
      return { name: 'SolarInverterX5000', maxPower: 5000 /* ... */ }
    default:
      throw new Error(`Unsupported device type: ${detectedType}`)
  }
}

// DEVICES registry - provides metadata for CLI tools
export const DEVICES = {
  X1000: {
    manufacturer: 'Acme Corp',
    model: 'X1000',
    description: '1kW Solar Inverter',
  },
  X2000: {
    manufacturer: 'Acme Corp',
    model: 'X2000',
    description: '2kW Solar Inverter',
  },
  X5000: {
    manufacturer: 'Acme Corp',
    model: 'X5000',
    description: '5kW Solar Inverter',
  },
}

// Auto-detection helper (reads device identification registers)
const detectDeviceType = async (transport, slaveId) => {
  // Read model register and determine type
  const modelId = await readRegister(transport, slaveId, 0x9000)
  return modelId === 1 ? 'X1000' : modelId === 2 ? 'X2000' : 'X5000'
}
```

**Benefits**: Single entry point, optional auto-detection, simpler configuration.

**Exports for multi-device drivers**:

- `createDriver` - Factory function (required)
- `DEFAULT_CONFIG` - Connection defaults (recommended)
- `SUPPORTED_CONFIG` - Valid parameter ranges (recommended)
- `DEVICES` - Device registry with metadata (recommended for multi-device drivers)

### 4. Development Workflow

```bash
# Test with emulator (fast iteration)
npm test

# Test with real device (in driver directory)
npx ya-modbus read --port /dev/ttyUSB0 --slave-id 1 \
  --data-point voltage_l1

# Characterize device (discover capabilities)
npx ya-modbus scan-registers --port /dev/ttyUSB0 --slave-id 1
npx ya-modbus discover --port /dev/ttyUSB0
npx ya-modbus characterize --port /dev/ttyUSB0 --slave-id 1 \
  --output device-profile.json
```

**Note**: Development commands use local CLI from devDependencies (via `npx`). No need to specify driver - current directory is used.

## Driver Interface

### Core Contract (Functional Approach)

**Single factory function per package** that handles all device types:

```typescript
import type { DeviceDriver, DataPoint } from '@ya-modbus/driver-sdk'

// Single factory function - handles device type selection
export const createDriver = async (config): Promise<DeviceDriver> => {
  const { device, transport, slaveId } = config

  // Auto-detect if type not specified
  const type = device || (await autoDetectDeviceType(transport, slaveId))

  // Return driver configuration for detected type
  return {
    name: `my-device-${type}`,
    manufacturer: 'Acme Corp',
    model: type,

    dataPoints: getDataPointsForType(type),
    decodeDataPoint: (id, rawValue) => decode(type, id, rawValue),
    encodeDataPoint: (id, value) => encode(type, id, value),
    constraints: getConstraintsForType(type),
    initialize: async () => initializeDevice(type, transport, slaveId),
  }
}

// Auto-detection reads device identification registers
const autoDetectDeviceType = async (transport, slaveId) => {
  const modelReg = await readRegister(transport, slaveId, 0x9000)
  return modelReg === 1 ? 'ModelA' : 'ModelB'
}
```

**Key principles**:

- **Single entry point**: One `createDriver` function per package
- **Optional device type**: Auto-detect if not specified
- **Functional**: Composable, testable, simpler than classes
- **Type-specific logic**: Internal implementation detail

### Data Points vs Registers

**External API** (what users configure):

- Semantic data point IDs: `"voltage_l1"`, `"total_energy"`
- Standard units: `V`, `A`, `W`, `kWh`
- Standard types: `float`, `integer`, `boolean`, `timestamp`

**Internal Implementation** (driver responsibility):

- Raw register addresses: `0x0000`, `0x0006`
- Wire formats: `uint16`, `int32`, `float32`, `BCD`
- Multipliers, offsets, custom decoders

Driver owns the transformation layer - consumers never see raw registers.

### Example Driver

See `packages/devices/src/energy-meters/` for complete examples.

## Testing

### Test with Emulator

```typescript
import { createTestHarness } from '@ya-modbus/driver-dev-tools'
import { createDriver } from './device'

describe('MyDevice', () => {
  const harness = createTestHarness()

  beforeEach(async () => {
    await harness.start({
      devices: [
        {
          slaveId: 1,
          registers: {
            0x0000: 0x43664000, // 230.5 as float32
            0x9000: 1, // Model ID for auto-detection
          },
        },
      ],
    })
  })

  afterEach(() => harness.stop())

  it('should read voltage with explicit device type', async () => {
    const driver = await createDriver({
      device: 'ModelA',
      slaveId: 1,
      transport: harness.getTransport(),
    })

    const value = await driver.readDataPoint('voltage_l1')
    expect(value).toBeCloseTo(230.5, 1)
  })

  it('should auto-detect device type', async () => {
    const driver = await createDriver({
      // No device - will auto-detect
      slaveId: 1,
      transport: harness.getTransport(),
    })

    expect(driver.model).toBe('ModelA')
  })
})
```

### Test with Real Device

```bash
# Development testing (in driver directory, uses local deps)
npx ya-modbus read --port /dev/ttyUSB0 --slave-id 1 \
  --data-point voltage_l1 --format json

# Production testing (CLI installed globally)
ya-modbus read --driver my-driver --port /dev/ttyUSB0 \
  --slave-id 1 --data-point voltage_l1
```

## Device Characterization

Use characterization tools to discover device capabilities:

### Connection Discovery

```bash
# Auto-detect baud rate, parity, stop bits, slave ID
npx ya-modbus discover --port /dev/ttyUSB0
```

Output: Connection parameters and device identification.

### Register Scanning

```bash
# Find readable register ranges
npx ya-modbus scan-registers --port /dev/ttyUSB0 --slave-id 1 \
  --start 0 --end 10000 --type holding

# Find write-protected registers
npx ya-modbus scan-registers --port /dev/ttyUSB0 --slave-id 1 \
  --test-writes --start 0 --end 100
```

Output: Valid ranges, forbidden ranges, access restrictions.

### Device Limits

```bash
# Test maximum batch read size
npx ya-modbus test-limits --port /dev/ttyUSB0 --slave-id 1

# Test minimum timing requirements
npx ya-modbus test-timing --port /dev/ttyUSB0 --slave-id 1
```

Output: Max registers per read, min inter-command delay.

### Complete Characterization

```bash
# Run all characterization tests
npx ya-modbus characterize --port /dev/ttyUSB0 --slave-id 1 \
  --output device-profile.json
```

**Output** (`device-profile.json`):

```json
{
  "connection": {
    "baudRate": 9600,
    "parity": "none",
    "stopBits": 1,
    "slaveId": 1
  },
  "limits": {
    "maxReadRegisters": 80,
    "maxWriteRegisters": 60,
    "minCommandDelay": 50
  },
  "readableRanges": [
    { "type": "holding", "start": 0, "end": 200 },
    { "type": "input", "start": 0, "end": 50 }
  ],
  "forbiddenRanges": [{ "type": "holding", "start": 1000, "end": 1099, "reason": "Exception 2" }],
  "accessRestrictions": {
    "readProtected": [{ "address": 500, "note": "Write-only config" }],
    "writeProtected": [{ "address": 100, "note": "Read-only serial" }],
    "requiresAuth": {
      "unlockRegister": 9999,
      "protectedRange": { "start": 1000, "end": 1099 }
    }
  },
  "quirks": [
    {
      "type": "write-delay-required",
      "register": 200,
      "minDelayMs": 100,
      "reason": "EEPROM commit"
    }
  ]
}
```

Use this output to:

1. Configure device constraints in driver
2. Validate device documentation
3. Debug communication issues
4. Document device quirks

## Device Constraints

Declare device-specific limits and restrictions in driver object:

```typescript
export const createMyDevice = (config) => ({
  // ... other properties

  constraints: {
    // Modbus operation limits
    maxReadRegisters: 80,
    maxWriteRegisters: 60,

    // Forbidden ranges (read/write blocked)
    forbiddenRanges: [
      {
        type: 'holding' as const,
        start: 1000,
        end: 1099,
        reason: 'Protected configuration area',
      },
    ],

    // Timing requirements
    minCommandDelay: 50, // milliseconds
  },
})
```

Bridge enforces these constraints automatically.

## Device Quirks

Handle device-specific behaviors:

### Authentication Required

```typescript
export const createMyDevice = (config) => ({
  // ... other properties

  initialize: async () => {
    // Write password to unlock protected registers
    await writeRegister(9999, Buffer.from('PASSWORD'))
  },
})
```

### Multi-Step Operations

```typescript
export const createMyDevice = (config) => {
  const writeConfig = async (value) => {
    // Write value
    await writeRegister(200, value)

    // Trigger EEPROM commit
    await writeRegister(201, 1)

    // Wait for commit (device-specific delay)
    await sleep(100)
  }

  return {
    // ... other properties
    writeConfig,
  }
}
```

### Order-Dependent Reads

Document in driver implementation, enforce via function composition.

## Package Metadata

### package.json

```json
{
  "name": "ya-modbus-driver-solar",
  "version": "1.0.0",
  "description": "Modbus drivers for Acme Solar inverters (X1000, X2000, X5000 series)",
  "keywords": ["ya-modbus-driver", "modbus", "solar", "inverter"],
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "@ya-modbus/driver-sdk": "^1.0.0"
  },
  "devDependencies": {
    "@ya-modbus/driver-dev-tools": "^1.0.0",
    "typescript": "^5.0.0"
  },
  "peerDependencies": {
    "@ya-modbus/driver-sdk": "^1.0.0"
  }
}
```

**Naming conventions**:

- **Recommended**: `ya-modbus-driver-<name>` (e.g., `ya-modbus-driver-solar`)
- **Scoped packages**: `@org/ya-modbus-driver-<name>` (e.g., `@acme/ya-modbus-driver-solar`)
- Any name works if `keywords` includes `"ya-modbus-driver"`

**Required fields**:

- `keywords` must include `"ya-modbus-driver"` for discovery
- `peerDependencies` declares SDK compatibility
- `description` should list supported device types if multiple

### Optional: ya-modbus-driver.json

> **Note**: This file is for future tooling integration. Currently, use the `DEVICES` export
> (see [multi-device example](#example-multi-device-package-functional-approach)) which provides
> device metadata programmatically and is used by the CLI's `list-devices` command.

Static metadata for package registries and discovery tools:

```json
{
  "supportsAutoDetection": true,
  "manufacturer": "Acme Corp",
  "deviceFamily": "X-Series Solar Inverters",
  "documentation": "https://example.com/docs",
  "homepage": "https://github.com/acme/modbus-driver-solar"
}
```

**Benefits of single factory approach**:

- Single import, simpler API
- Auto-detection when possible
- Easier configuration (no need to specify class name)
- Shared code and dependencies
- Consistent behavior across device family

## Data Transformation

### Standard Data Types

See `packages/core/src/types/data-types.ts` for complete list.

Common types:

- `float` - Floating-point measurements
- `integer` - Whole numbers
- `boolean` - True/false states
- `timestamp` - ISO 8601 timestamps
- `string` - Text values

### Standard Units

See `packages/core/src/types/units.ts` for complete list.

Common units:

- Electrical: `V`, `A`, `W`, `kW`, `VA`, `kVA`, `kWh`
- Frequency: `Hz`
- Temperature: `°C`, `°F`, `K`
- Percentage: `%`

### Transformation Examples

| Device Encoding | Raw Buffer   | Decoded Value              |
| --------------- | ------------ | -------------------------- |
| uint16 × 0.1    | `0x0901`     | `230.5` (float)            |
| int16           | `0xFFFE`     | `-2` (integer)             |
| float32 BE      | `0x43664000` | `230.5` (float)            |
| Decimal YYMMDD  | `0x03D3EC`   | `"2025-12-20"` (timestamp) |
| BCD             | `0x1234`     | `1234` (integer)           |

Use transformation helpers from `@ya-modbus/driver-sdk`.

## Publishing

### Before Publishing

1. ✅ All tests pass
2. ✅ Tested with real device
3. ✅ Documentation complete
4. ✅ Package metadata correct
5. ✅ License specified (GPL-3.0-or-later compatible)

### Publish to npm

```bash
npm publish
```

### Distribution

Users install driver alongside bridge:

```bash
# Install bridge
npm install -g ya-modbus-mqtt-bridge

# Install driver (supports multiple device types)
npm install -g ya-modbus-driver-solar

# Use in configuration
{
  "devices": [
    {
      "id": "inverter_1",
      "driver": "ya-modbus-driver-solar",
      "device": "X1000",  // Optional: auto-detect if omitted
      "transport": "tcp",
      "host": "192.168.1.100"
    },
    {
      "id": "inverter_2",
      "driver": "ya-modbus-driver-solar",
      "device": "X2000",  // Explicit type
      "transport": "tcp",
      "host": "192.168.1.101"
    },
    {
      "id": "inverter_3",
      "driver": "ya-modbus-driver-solar",
      // No device - will auto-detect
      "transport": "tcp",
      "host": "192.168.1.102"
    }
  ]
}
```

**Configuration format**:

- `driver`: Package name only (e.g., `ya-modbus-driver-solar`)
- `device`: Optional, specifies which device variant (use `ya-modbus list-devices` to see available devices)
- Auto-detection: Omit `device` and driver will detect device model
- Single package handles entire device family

## Best Practices

### 1. Test-Driven Development

Write tests first using emulator, then implement driver.

See: `CONTRIBUTING.md` for TDD workflow.

### 2. Semantic Data Points

Define data points users understand, not register addresses:

✅ Good: `"voltage_l1"`, `"total_energy"`, `"operating_mode"`
❌ Bad: `"reg_0000"`, `"holding_6"`, `"input_register_12"`

### 3. Standard Units

Use canonical units from `driver-sdk`:

✅ Good: `V`, `A`, `kWh`
❌ Bad: `volts`, `amps`, `kilowatt_hours`

### 4. Document Quirks

Non-obvious behaviors belong in code comments and README.

### 5. Minimal Dependencies

Keep driver packages lightweight - avoid unnecessary dependencies.

## Versioning

Drivers and SDK follow semantic versioning independently:

**SDK version** (e.g., `@ya-modbus/driver-sdk@2.3.1`):

- Major: Breaking interface changes
- Minor: New features, backward compatible
- Patch: Bug fixes

**Driver version** (e.g., `@acme/modbus-driver-solar@1.2.0`):

- Major: Breaking changes to data points or behavior
- Minor: New data points, backward compatible
- Patch: Bug fixes

**Compatibility**: Declare in `peerDependencies`:

```json
{
  "peerDependencies": {
    "@ya-modbus/driver-sdk": "^2.0.0"
  }
}
```

Bridge validates SDK compatibility at runtime.

## Troubleshooting

### Driver Not Found

Bridge can't load driver package.

**Check**:

1. Driver installed? `npm list -g @acme/modbus-driver-solar`
2. `keywords` includes `"ya-modbus-driver"`?
3. Package exports driver correctly?

### Type Errors

TypeScript compilation fails.

**Check**:

1. `@ya-modbus/driver-sdk` version matches `peerDependencies`
2. TypeScript version compatible
3. `tsconfig.json` extends SDK base config

### Emulator Tests Fail

Tests fail with emulator but work with real device.

**Check**:

1. Emulator register values match expected format
2. Emulator configured for correct transport (RTU/TCP)
3. Test cleanup (stop emulator in `afterEach`)

### Real Device Tests Fail

Tests pass with emulator but fail with real device.

**Check**:

1. Device constraints accurate (max batch size, timing)
2. Device quirks handled (auth, delays, read order)
3. Characterization tool results match implementation

## Examples

Complete driver examples in monorepo:

- `packages/devices/src/energy-meters/sdm630.ts` - Energy meter with float32
- `packages/devices/src/solar-inverters/sun2000.ts` - Solar inverter with auth
- `packages/devices/src/generic/` - Generic configurable driver

Study these for patterns and conventions.

## Resources

- **API Reference**: `packages/driver-sdk/docs/`
- **Type Definitions**: `packages/driver-types/index.d.ts`
- **Test Utilities**: `packages/driver-dev-tools/docs/`
- **Architecture**: `docs/ARCHITECTURE.md`
- **Contributing**: `CONTRIBUTING.md`

## Support

- **GitHub Issues**: Bug reports for SDK/tools
- **GitHub Discussions**: Questions about driver development
- **Examples**: Reference implementations in `packages/devices/`
