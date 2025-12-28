# Multi-Device Driver Pattern

This guide explains how to implement drivers that support multiple device variants within a single package.

## When to Use Multi-Device Support

Use multi-device support when:

1. **Multiple device models share the same Modbus interface** - They use identical register layouts and cannot be distinguished programmatically (e.g., XY-MD01 and XY-MD02)

2. **Device variants differ only in default configuration** - Same functionality, different typical factory settings (baud rate, parity, default address)

3. **You want to reduce package duplication** - Multiple similar devices would otherwise require separate packages

**Do NOT use multi-device support when:**

- Devices have different register layouts or data points
- Devices require different communication protocols
- Devices need different driver logic or special handling

For truly different devices, create separate driver packages.

## Architecture Overview

Multi-device drivers use `DEVICE_METADATA` as the single source of truth for all device-specific information:

```typescript
export const DEVICE_METADATA = {
  deviceId1: {
    name: 'Device Name 1',
    manufacturer: 'Manufacturer',
    model: 'MODEL-1',
    description: 'Brief description',
    dataPoints: SHARED_DATA_POINTS,
    defaultConfig: {
      /* device-specific defaults */
    },
    supportedConfig: {
      /* device-specific constraints */
    },
  },
  deviceId2: {
    // ... second device variant
  },
} as const satisfies Record<string, DeviceMetadata>
```

**Key Principles:**

- **Device ID**: Object key (lowercase, simple identifier like `md01`, `md02`)
- **Device Name**: Official product name (in metadata, like `XY-MD01`, `XY-MD02`)
- **Embedded Configs**: defaultConfig and supportedConfig live in metadata, not as separate exports
- **Shared Constants**: Extract common data points and configs when devices are identical

## Implementation Steps

### 1. Import DeviceMetadata Type

```typescript
import type {
  DeviceDriver,
  DataPoint,
  CreateDriverFunction,
  DriverConfig,
  DeviceMetadata, // ADD THIS
} from '@ya-modbus/driver-types'
```

### 2. Define Shared Constants

If devices share data points or configurations, extract them:

```typescript
/**
 * Supported configuration shared by all devices
 */
const SHARED_SUPPORTED_CONFIG = {
  validBaudRates: [9600, 14400, 19200],
  validParity: ['none', 'even', 'odd'],
  validDataBits: [8],
  validStopBits: [1],
  validAddressRange: [1, 247],
} as const

/**
 * Data points shared by all devices
 */
const SHARED_DATA_POINTS: ReadonlyArray<DataPoint> = [
  {
    id: 'temperature',
    name: 'Temperature',
    type: 'float',
    unit: '°C',
    access: 'r',
    description: 'Temperature in degrees Celsius',
    decimals: 1,
  },
  // ... other data points
]
```

### 3. Define DEVICE_METADATA

```typescript
/**
 * Device metadata for [DRIVER_NAME] driver variants
 *
 * Single source of truth for device information and configurations.
 * [Explain how devices differ or are identical from Modbus perspective]
 *
 * Summaries: Referenced in README.md and AGENTS.md
 */
export const DEVICE_METADATA = {
  device1: {
    name: 'DEVICE-1',
    manufacturer: 'Manufacturer Name',
    model: 'DEVICE-1',
    description: 'Device description (highlight key differences)',
    dataPoints: SHARED_DATA_POINTS,
    defaultConfig: {
      baudRate: 9600,
      parity: 'none',
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 1,
    },
    supportedConfig: SHARED_SUPPORTED_CONFIG,
  },
  device2: {
    name: 'DEVICE-2',
    manufacturer: 'Manufacturer Name',
    model: 'DEVICE-2',
    description: 'Device description (highlight key differences)',
    dataPoints: SHARED_DATA_POINTS,
    defaultConfig: {
      baudRate: 9600,
      parity: 'even', // Different parity
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 1,
    },
    supportedConfig: SHARED_SUPPORTED_CONFIG,
  },
} as const satisfies Record<string, DeviceMetadata>

export type YourDriverDeviceType = keyof typeof DEVICE_METADATA
```

**Important:**

- Use `as const` to preserve literal types
- Use `satisfies Record<string, DeviceMetadata>` for type validation
- Export a type alias for device IDs

### 4. Add Device Selection Helper

```typescript
/**
 * Determine device variant from DriverConfig
 * Defaults to first device if not specified
 */
function determineDeviceType(config: DriverConfig): YourDriverDeviceType {
  if (config.deviceType) {
    if (config.deviceType in DEVICE_METADATA) {
      return config.deviceType as YourDriverDeviceType
    }

    const validTypes = Object.keys(DEVICE_METADATA).join(', ')
    const deviceList = Object.entries(DEVICE_METADATA)
      .map(
        ([id, meta]) => `  - ${id}: ${meta.name}${meta.description ? ` (${meta.description})` : ''}`
      )
      .join('\n')

    throw new Error(
      `Invalid deviceType: "${config.deviceType}". ` +
        `Valid types for [your-driver] driver: ${validTypes}\n\n` +
        `Available devices:\n${deviceList}`
    )
  }

  // Default to first device (or choose most common variant)
  return 'device1'
}
```

### 5. Update createDriver Function

```typescript
export const createDriver: CreateDriverFunction = (config: DriverConfig) => {
  try {
    const { transport } = config

    const deviceType = determineDeviceType(config)
    const metadata = DEVICE_METADATA[deviceType]

    const driver: DeviceDriver = {
      name: metadata.name, // From device metadata
      manufacturer: metadata.manufacturer, // From device metadata
      model: metadata.model, // From device metadata
      dataPoints: metadata.dataPoints, // From device metadata

      async readDataPoint(id: string): Promise<unknown> {
        // ... implementation (same for all devices)
      },

      async writeDataPoint(id: string, value: unknown): Promise<void> {
        // ... implementation (same for all devices)
      },

      async readDataPoints(ids: string[]): Promise<Record<string, unknown>> {
        // ... implementation (same for all devices)
      },
    }

    return Promise.resolve(driver)
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}
```

**Note:** Use metadata for device-specific values in validation/encoding if needed:

```typescript
function encodeDataPoint(id: string, value: unknown): Buffer {
  if (id === 'device_address') {
    const [min, max] = DEVICE_METADATA.device1.supportedConfig.validAddressRange
    if (typeof value !== 'number' || value < min || value > max) {
      throw new Error(`Invalid device address: must be between ${min} and ${max}`)
    }
    // ... encode
  }
  // ...
}
```

## CLI Integration

Users can specify device variant via `--device` flag:

```bash
# Use default device (first in DEVICE_METADATA)
ya-modbus read --port /dev/ttyUSB0 --slave-id 1 --driver your-driver --all

# Explicit device selection
ya-modbus read --port /dev/ttyUSB0 --slave-id 1 --driver your-driver --device device2 --all
```

The CLI passes `deviceType` to your driver via DriverConfig.

## Discovery Considerations

Discovery will try all device variants when `--device` is not specified:

1. Discovery iterates `Object.entries(DEVICE_METADATA)` in definition order
2. For each device, uses its `defaultConfig` as priority parameters
3. Tries to identify device using available parameters
4. Reports which device variant was detected (if distinguishable)

**Important:** If devices are Modbus-identical (like XY-MD01/XY-MD02), discovery cannot distinguish them. Users must manually specify `--device` based on physical device markings.

## Documentation Requirements

### 1. README.md

Add sections:

#### Device Information

```markdown
## Device Information

- **Models**: MODEL-1, MODEL-2
- **Type**: Device category
- **Communication**: Modbus RTU

### Device Variants

This driver supports multiple device variants:

| Model   | Typical Config | Description |
| ------- | -------------- | ----------- |
| MODEL-1 | Parity: none   | Description |
| MODEL-2 | Parity: even   | Description |

**Note:** [Explain if devices are distinguishable or identical from Modbus perspective]
```

#### Device Selection

````markdown
### Device Selection

For multi-device drivers, you can optionally specify which device variant to use via the `deviceType` parameter. If omitted, the driver defaults to `device1`.

```typescript
import { createDriver, DEVICE_METADATA } from 'your-driver'

// Explicit device selection
const driver = await createDriver({
  transport,
  slaveId: 1,
  deviceType: 'device2',
})

console.log(driver.name) // 'MODEL-2'
```
````

````

#### Accessing Device Configuration
```markdown
### Accessing Device Configuration

The driver exports `DEVICE_METADATA` containing configuration for each device variant:

```typescript
import { DEVICE_METADATA } from 'your-driver'

// List available devices (iterate to avoid hardcoding keys)
for (const [deviceId, metadata] of Object.entries(DEVICE_METADATA)) {
  console.log(`${deviceId}: ${metadata.name}`)
  console.log(`  Default parity: ${metadata.defaultConfig.parity}`)
  console.log(`  Supported baud rates: ${metadata.supportedConfig.validBaudRates}`)
}

// Access specific device configuration
const device2Config = DEVICE_METADATA.device2.defaultConfig
const transport = new ModbusRTU({
  path: '/dev/ttyUSB0',
  baudRate: device2Config.baudRate,
  parity: device2Config.parity,
  dataBits: device2Config.dataBits,
  stopBits: device2Config.stopBits,
})

const driver = await createDriver({
  transport,
  slaveId: device2Config.defaultAddress,
  deviceType: 'device2',
})
````

````

### 2. AGENTS.md

Document in your driver's AGENTS.md:

```markdown
## Device Metadata

**Single source of truth**: `DEVICE_METADATA` exported constant

Supported devices:
- `device1`: MODEL-1 (typical config: parity none)
- `device2`: MODEL-2 (typical config: parity even)

Both devices are Modbus-identical / have different register layouts (choose one).

Device selection via `deviceType` parameter in DriverConfig.

See README.md for usage examples.
````

## Testing

Add tests for multi-device support:

```typescript
describe('DEVICE_METADATA', () => {
  test('contains valid metadata for all devices', () => {
    expect(DEVICE_METADATA.device1).toMatchObject({
      name: 'MODEL-1',
      manufacturer: 'Manufacturer',
      model: 'MODEL-1',
      dataPoints: expect.any(Array),
      defaultConfig: expect.any(Object),
      supportedConfig: expect.any(Object),
    })

    expect(DEVICE_METADATA.device2).toMatchObject({
      name: 'MODEL-2',
      manufacturer: 'Manufacturer',
      model: 'MODEL-2',
      dataPoints: expect.any(Array),
      defaultConfig: expect.any(Object),
      supportedConfig: expect.any(Object),
    })
  })

  test('shared data points are identical for both devices', () => {
    expect(DEVICE_METADATA.device1.dataPoints).toBe(DEVICE_METADATA.device2.dataPoints)
  })

  test('default configs differ in parity', () => {
    expect(DEVICE_METADATA.device1.defaultConfig.parity).toBe('none')
    expect(DEVICE_METADATA.device2.defaultConfig.parity).toBe('even')
  })
})

describe('createDriver with deviceType', () => {
  test('creates device1 driver when deviceType is device1', async () => {
    const driver = await createDriver({
      transport: mockTransport,
      slaveId: 1,
      deviceType: 'device1',
    })

    expect(driver.name).toBe('MODEL-1')
  })

  test('creates device2 driver when deviceType is device2', async () => {
    const driver = await createDriver({
      transport: mockTransport,
      slaveId: 1,
      deviceType: 'device2',
    })

    expect(driver.name).toBe('MODEL-2')
  })

  test('defaults to device1 when deviceType not specified', async () => {
    const driver = await createDriver({
      transport: mockTransport,
      slaveId: 1,
    })

    expect(driver.name).toBe('MODEL-1')
  })

  test('throws error with device list for invalid deviceType', async () => {
    await expect(
      createDriver({
        transport: mockTransport,
        slaveId: 1,
        deviceType: 'invalid',
      })
    ).rejects.toThrow(/Invalid deviceType.*device1, device2.*Available devices/s)
  })
})
```

## Reference Implementation

See `packages/ya-modbus-driver-xymd1` for a complete multi-device driver implementation:

- **Devices**: XY-MD01 and XY-MD02 (Modbus-identical variants)
- **Difference**: Only default parity (none vs even)
- **Shared Constants**: `SHARED_SUPPORTED_CONFIG` and `SHARED_DATA_POINTS`
- **File**: `packages/ya-modbus-driver-xymd1/src/index.ts`

Key files to review:

- `/packages/ya-modbus-driver-xymd1/src/index.ts` - Implementation
- `/packages/ya-modbus-driver-xymd1/src/index.test.ts` - Tests
- `/packages/ya-modbus-driver-xymd1/README.md` - Documentation

## Migration from Single-Device

If converting an existing single-device driver to multi-device:

1. **Preserve existing exports** during alpha (if needed):

   ```typescript
   // Deprecated: For backward compatibility during migration
   export const DEFAULT_CONFIG = DEVICE_METADATA.device1.defaultConfig
   export const SUPPORTED_CONFIG = DEVICE_METADATA.device1.supportedConfig
   ```

2. **Add deprecation warnings** to README

3. **Remove deprecated exports** in next major version

**Note:** During private alpha, no backward compatibility is needed - make a clean break.

## Common Pitfalls

1. **Hardcoding device IDs**: Always iterate `Object.entries(DEVICE_METADATA)` instead of hardcoding keys like `md01`, `md02`

2. **Forgetting `as const`**: Without it, TypeScript won't preserve literal types for baud rates, parity, etc.

3. **Not using `satisfies`**: Without it, TypeScript won't validate that metadata matches DeviceMetadata interface

4. **Device-specific logic in driver**: If devices need different read/write logic, they should be separate drivers

5. **Assuming distinguishability**: If devices are Modbus-identical, document that users must manually specify device type based on physical markings

## Summary

Multi-device support is appropriate when:

- Devices share the same Modbus interface
- Only default configurations differ
- You want to reduce duplication

Use `DEVICE_METADATA` as single source of truth, extract shared constants, and provide clear documentation for users to select device variants.
