# @ya-modbus/driver-loader

Dynamic driver loader for ya-modbus device drivers.

## Installation

```bash
npm install @ya-modbus/driver-loader
```

## Usage

### Auto-detect driver from current directory

```typescript
import { loadDriver } from '@ya-modbus/driver-loader'

const driver = await loadDriver({})
```

### Load specific driver package

```typescript
import { loadDriver } from '@ya-modbus/driver-loader'

const driver = await loadDriver({ driverPackage: 'ya-modbus-driver-xymd1' })
```

## API

### `loadDriver(options?: LoadDriverOptions): Promise<LoadedDriver>`

Loads a ya-modbus driver package and validates its exports.

**Options:**

- `driverPackage` (optional): Name of the driver package to load. If omitted, auto-detects from current directory's package.json.

**Returns:**

- `LoadedDriver` object containing:
  - `createDriver`: Factory function to create driver instances (required)
  - `devices`: Device registry for multi-device drivers (optional)
  - `defaultConfig`: Default configuration for serial or TCP (optional)
  - `supportedConfig`: Configuration constraints (optional)

**Throws:**

- Error if driver package is not found
- Error if driver exports are invalid
- Error if configuration validation fails

### `clearDriverCache(): void`

Clears the driver cache. Useful for testing or when you need to reload drivers.

### `getDriverCacheStats(): DriverCacheStats`

Returns cache statistics including hits, misses, and current cache size.

**Returns:**

- `DriverCacheStats` object containing:
  - `hits`: Number of cache hits
  - `misses`: Number of cache misses
  - `size`: Number of cached drivers

## Testing Utilities

The package provides testing utilities for applications using driver-loader.

```typescript
import { createMockDriver, mockSystemDeps } from '@ya-modbus/driver-loader/testing'

// Create a mock driver
const mockDriver = createMockDriver({
  defaultConfig: { baudRate: 9600 },
  devices: { test: { manufacturer: 'Test', model: 'Model' } },
})

// Create mock system dependencies
const deps = mockSystemDeps({
  importModule: jest.fn().mockResolvedValue(mockDriver),
})

// Use with loadDriver in tests
const driver = await loadDriver({ driverPackage: 'test-driver' }, deps)
```

### `createMockDriver(options?: MockDriverOptions): LoadedDriver`

Creates a mock driver for testing.

**Options:**

- `createDriver`: Custom createDriver implementation (default: jest.fn())
- `defaultConfig`: Mock default configuration
- `supportedConfig`: Mock supported configuration
- `devices`: Mock device registry

### `mockSystemDeps(options?: MockSystemDepsOptions): SystemDependencies`

Creates mock system dependencies for testing.

**Options:**

- `readFile`: Custom readFile implementation
- `importModule`: Custom importModule implementation
- `getCwd`: Custom getCwd implementation (default: '/mock/cwd')

## License

GPL-3.0-or-later
