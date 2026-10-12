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

The current directory must hold a package with the `ya-modbus-driver` keyword. The loader imports the file that Node loads for `import` of that package: `exports["."]` (conditions `node`, `import`, `module-sync`, `default`), else `main`, else `index.js`. The entry must name the file with its extension, and Node's `--conditions` flag is not used.

The driver must be built, and built again after each change to its source. If the entry file is missing (no `dist` directory), or it is TypeScript source that Node cannot run, `loadDriver` throws a `DriverNotBuiltError`: build the driver first (`npm run build`), or run with Node's built-in type stripping (Node 22.18+ or 24).

### Load specific driver package

```typescript
import { loadDriver } from '@ya-modbus/driver-loader'

const driver = await loadDriver({ driverPackage: '@ya-modbus/driver-xymd1' })
```

### Load a driver by short name

A plain lowercase name such as `xymd1` is a short name. The loader tries these packages in order and uses the first one that is installed:

1. `@ya-modbus/driver-<name>`
2. `ya-modbus-driver-<name>`
3. `<name>`, the name as given

```typescript
// Loads @ya-modbus/driver-xymd1
const driver = await loadDriver({ driverPackage: 'xymd1' })
```

Anything else (scoped names, `ya-modbus-driver-*` names, paths) is used as given. If a candidate package is installed but fails to load, the search stops there and the `DriverNotFoundError` message shows the load error (the original error is its `cause`), so a later candidate does not hide it. If no candidate is installed, the message lists every package that was tried, and `packageName` is the preferred one (`@ya-modbus/driver-<name>`).

### Error Handling

The driver-loader exports custom error classes for type-safe error handling:

```typescript
import {
  loadDriver,
  ValidationError,
  DriverNotFoundError,
  DriverNotBuiltError,
  PackageJsonError,
} from '@ya-modbus/driver-loader'

try {
  const driver = await loadDriver({ driverPackage: 'my-driver' })
} catch (error) {
  // Type-safe error handling with instanceof
  if (error instanceof DriverNotFoundError) {
    if (error.cause) {
      // The package is installed but failed to load
      console.error(`Failed to load ${error.packageName}:`, error.cause)
    } else {
      console.error(`Package not found: ${error.packageName}`)
      console.error(`Install with: npm install ${error.packageName}`)
    }
  } else if (error instanceof DriverNotBuiltError) {
    console.error(`${error.packageName} is not built: run npm run build`)
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
  - `packageName: string` - The package that could not be found or loaded. For a package that is not installed this is the package to install
  - `cause?: unknown` - Set when the package is installed but fails to load: the original error
  - Example: Package not installed, wrong package name, syntax error in the driver

- **`DriverNotBuiltError`**: Driver package is installed but not built
  - `packageName: string` - The package that cannot be loaded
  - `cause?: unknown` - The error Node reported
  - Example: Missing `dist` directory, TypeScript source that Node cannot run

- **`PackageJsonError`**: package.json not found or invalid
  - Example: Missing package.json, invalid JSON, missing ya-modbus-driver keyword, `exports` without an entry for `import`

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

- `driverPackage` (optional): Name of the driver package to load, or a short name such as `xymd1`. If omitted, auto-detects from current directory's package.json.

**Returns:**

- `LoadedDriver` object containing:
  - `createDriver`: Factory function to create driver instances (required)
  - `devices`: Device registry for multi-device drivers (optional)
  - `defaultConfig`: Default configuration for serial or TCP (optional)
  - `supportedConfig`: Configuration constraints (optional)

**Throws:**

- `DriverNotFoundError` if driver package is not found or fails to load
- `DriverNotBuiltError` if the driver is not built
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
- **Cache key:** Name of the package that was loaded (e.g., '@ya-modbus/driver-xymd1'). A short name and the full name share one entry. If two candidates of a short name are installed, a candidate that was loaded earlier in the process is returned
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

### `getCallerPackageInfo(): PackageInfo`

Returns the `version` and `description` from the package.json of the package that contains the calling module. CLIs use it to report their own version without hardcoding it.

It finds the caller from the call stack, so it works the same in the ESM and CommonJS builds of a package.

It does not work when the caller and driver-loader are bundled into one file, because both then appear as the same file on the call stack.

**Returns:**

- `PackageInfo` object containing:
  - `version`: Version from the closest package.json that has one
  - `description`: Description from that package.json (empty string if missing)

**Throws:**

- Error if the calling module cannot be determined
- Error if no package.json with a version is found above the calling module

```typescript
import { getCallerPackageInfo } from '@ya-modbus/driver-loader'

program.version(getCallerPackageInfo().version)
```

### `isValidDriverPackageName(name: unknown): boolean`

Checks a driver package name against the shared naming rule for applications that read the driver name from a configuration, such as the MQTT bridge. Allowed forms:

- `@ya-modbus/driver-<name>`
- `ya-modbus-driver-<name>`
- `@<scope>/ya-modbus-driver-<name>`

`<name>` and `<scope>` use only lowercase letters, numbers and hyphens. Paths (`../x`, `/opt/x`), sub paths, backslashes and any other package name are rejected. `loadDriver` does not check this rule. If your tool reads the driver name from a config file, call `assertValidDriverPackageName` before `loadDriver`.

### `assertValidDriverPackageName(name: string): void`

Same check as `isValidDriverPackageName`. Throws a `ValidationError` (field `driverPackage`) that shows the rejected name and lists the allowed forms.

`DRIVER_PACKAGE_NAME_RULE` is the text of the rule ("must be ..."), for applications that build their own error message.

```typescript
import { assertValidDriverPackageName, loadDriver } from '@ya-modbus/driver-loader'

assertValidDriverPackageName(config.driver)
await loadDriver({ driverPackage: config.driver })
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
   npm list @ya-modbus/driver-<name>
   ```

2. **Install the driver package:**

   ```bash
   npm install @ya-modbus/driver-<name>
   ```

3. **Check the package name:**
   - Ensure the package name in your code matches the actual npm package name
   - Driver packages follow the naming rule described under `isValidDriverPackageName` (for example `ya-modbus-driver-<device>` or `@<scope>/ya-modbus-driver-<device>`)

If the message starts with `Failed to load driver package`, the package is installed but its code failed to load. Read the reason in the message (or `error.cause`) instead of reinstalling.

### Driver Not Built

If you encounter `DriverNotBuiltError` (message `Cannot load driver <name>: ...`):

1. **Build the driver:**

   ```bash
   npm run build
   ```

2. **Check the entry point:** `exports["."]` (or `main`) in package.json must name the built JavaScript file with its extension, for example `./dist/esm/index.js`.

3. **TypeScript source:** Node 22.18+ and 24 run `.ts` files themselves, but only outside `node_modules`, and only if the source uses erasable TypeScript syntax (no enums) and imports files with their `.ts` extension. Build the driver otherwise.

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
   - The loader imports the entry file from `exports` or `main` in package.json
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
