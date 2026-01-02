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

### Error Handling

The driver-loader exports custom error classes for type-safe error handling:

```typescript
import {
  loadDriver,
  ValidationError,
  DriverNotFoundError,
  PackageJsonError,
} from '@ya-modbus/driver-loader'

try {
  const driver = await loadDriver({ driverPackage: 'my-driver' })
} catch (error) {
  // Type-safe error handling with instanceof
  if (error instanceof DriverNotFoundError) {
    console.error(`Package not found: ${error.packageName}`)
    console.error(`Install with: npm install ${error.packageName}`)
  } else if (error instanceof ValidationError) {
    console.error(`Validation failed for field: ${error.field}`)
    console.error(`Error: ${error.message}`)
  } else if (error instanceof PackageJsonError) {
    console.error('package.json issue:', error.message)
  } else {
    console.error('Unexpected error:', error)
  }
}
```

**Error Types:**

- **`ValidationError`**: Driver configuration validation failed
  - `field?: string` - The configuration field that failed validation
  - Example: Invalid DEFAULT_CONFIG, missing createDriver function

- **`DriverNotFoundError`**: Driver package not found or cannot be loaded
  - `packageName: string` - The package that couldn't be found
  - Example: Package not installed, wrong package name

- **`PackageJsonError`**: package.json not found or invalid
  - Example: Missing package.json, invalid JSON, missing ya-modbus-driver keyword

### Custom Logging

You can provide a custom logger to control warning and debug output:

```typescript
import { loadDriver, type Logger } from '@ya-modbus/driver-loader'

const logger: Logger = {
  warn: (msg) => myLogger.warning('[DRIVER]', msg),
  debug: (msg) => myLogger.debug('[DRIVER]', msg), // Optional
}

const driver = await loadDriver({
  driverPackage: 'my-driver',
  logger,
})
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

**When to use:**

- **In tests:** Clear cache between test cases to ensure isolation
- **After package updates:** Force reload of updated driver packages
- **During development:** Reload drivers after making changes

```typescript
import { clearDriverCache } from '@ya-modbus/driver-loader'

// In test setup
beforeEach(() => {
  clearDriverCache() // Ensure each test starts with clean cache
})

// After updating a driver package
await updateDriver('my-driver')
clearDriverCache() // Force reload on next loadDriver call
```

### `getDriverCacheStats(): DriverCacheStats`

Returns cache statistics including hits, misses, and current cache size.

**Returns:**

- `DriverCacheStats` object containing:
  - `hits`: Number of cache hits
  - `misses`: Number of cache misses
  - `size`: Number of cached drivers

**Cache Behavior:**

- **Automatic caching:** Drivers are cached by package name after first load
- **Cache key:** Package name (e.g., 'ya-modbus-driver-xymd1')
- **Cache lifetime:** Persists for the lifetime of the Node.js process
- **Auto-detect mode:** Even auto-detected drivers are cached by their package name
- **No cache on errors:** Failed loads are not cached, allowing retry

**Example:**

```typescript
import { loadDriver, getDriverCacheStats } from '@ya-modbus/driver-loader'

// First load - cache miss
await loadDriver({ driverPackage: 'my-driver' })
console.log(getDriverCacheStats()) // { hits: 0, misses: 1, size: 1 }

// Second load - cache hit
await loadDriver({ driverPackage: 'my-driver' })
console.log(getDriverCacheStats()) // { hits: 1, misses: 1, size: 1 }
```

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

## Troubleshooting

### Package Not Found

If you encounter `Driver package not found` errors:

1. **Verify the package is installed:**

   ```bash
   npm list ya-modbus-driver-<name>
   ```

2. **Install the driver package:**

   ```bash
   npm install ya-modbus-driver-<name>
   ```

3. **Check the package name:**
   - Ensure the package name in your code matches the actual npm package name
   - Driver packages typically follow the naming convention: `ya-modbus-driver-<device>`

### Module Resolution Issues

If TypeScript or Node.js can't find `@ya-modbus/driver-loader`:

1. **Check your package.json:**

   ```bash
   npm list @ya-modbus/driver-loader
   ```

2. **Reinstall dependencies:**

   ```bash
   npm install
   ```

3. **TypeScript module resolution:**
   - Ensure `"moduleResolution": "node"` or `"moduleResolution": "bundler"` in tsconfig.json
   - Check that `"types"` field isn't excluding driver-loader

4. **For local driver development:**
   - The loader tries multiple import paths: `src/index.js`, `src/index.ts`, `dist/index.js`
   - Build your driver before testing: `npm run build`

### Validation Failures

If driver validation fails with configuration errors:

1. **ValidationError - Invalid DEFAULT_CONFIG:**

   ```typescript
   // ❌ Wrong
   export const DEFAULT_CONFIG = { speed: 9600 } // Should be "baudRate"

   // ✅ Correct
   export const DEFAULT_CONFIG = { baudRate: 9600 }
   ```

2. **ValidationError - Invalid SUPPORTED_CONFIG:**

   ```typescript
   // ❌ Wrong
   export const SUPPORTED_CONFIG = { baudRates: [9600] } // Should be "validBaudRates"

   // ✅ Correct
   export const SUPPORTED_CONFIG = { validBaudRates: [9600, 19200] }
   ```

3. **ValidationError - Missing createDriver:**

   ```typescript
   // ❌ Wrong
   export function makeDriver() {
     ...
   }

   // ✅ Correct
   export function createDriver() {
     ...
   }
   ```

4. **PackageJsonError - Not a driver package:**

   Add the `ya-modbus-driver` keyword to your package.json:

   ```json
   {
     "name": "ya-modbus-driver-mydevice",
     "keywords": ["ya-modbus-driver"]
   }
   ```

5. **Configuration inconsistency warnings:**

   Ensure DEFAULT_CONFIG values are within SUPPORTED_CONFIG constraints:

   ```typescript
   // ❌ Inconsistent
   export const DEFAULT_CONFIG = { baudRate: 115200 }
   export const SUPPORTED_CONFIG = { validBaudRates: [9600, 19200] }

   // ✅ Consistent
   export const DEFAULT_CONFIG = { baudRate: 9600 }
   export const SUPPORTED_CONFIG = { validBaudRates: [9600, 19200] }
   ```

### Getting More Help

For additional debugging:

1. **Enable verbose logging:**

   ```typescript
   const logger = {
     warn: (msg: string) => console.warn('[DRIVER]', msg),
     debug: (msg: string) => console.debug('[DRIVER]', msg),
   }

   const driver = await loadDriver({ logger })
   ```

2. **Check cache statistics:**

   ```typescript
   import { getDriverCacheStats } from '@ya-modbus/driver-loader'

   console.log(getDriverCacheStats())
   ```

3. **Clear the cache:**
   ```typescript
   import { clearDriverCache } from '@ya-modbus/driver-loader'
   clearDriverCache()
   ```

## License

GPL-3.0-or-later
