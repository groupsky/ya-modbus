# @ya-modbus/driver-loader

Dynamic driver loader for ya-modbus device drivers.

## Installation

```bash
npm install @ya-modbus/driver-loader
```

## Usage

### Auto-detect driver from current directory

<!-- embedme examples/api-examples.ts#L17-L20 -->

```ts
export async function autoDetectExample(): Promise<void> {
  const driver = await loadDriver({})
  console.log('Loaded driver:', driver)
}
```

### Load specific driver package

<!-- embedme examples/api-examples.ts#L23-L26 -->

```ts
export async function loadSpecificExample(): Promise<void> {
  const driver = await loadDriver({ driverPackage: '@ya-modbus/driver-xymd1' })
  console.log('Loaded driver:', driver)
}
```

### Error Handling

The driver-loader exports custom error classes for type-safe error handling:

<!-- embedme examples/api-examples.ts#L29-L47 -->

```ts
export async function errorHandlingExample(): Promise<void> {
  try {
    const driver = await loadDriver({ driverPackage: 'my-driver' })
    console.log('Loaded driver:', driver)
  } catch (error) {
    // Type-safe error handling with instanceof
    if (error instanceof DriverNotFoundError) {
      console.error(`Package not found: ${error.packageName}`)
      console.error(`Install with: npm install ${error.packageName}`)
    } else if (error instanceof ValidationError) {
      console.error(`Validation failed for field: ${error.field ?? 'unknown'}`)
      console.error(`Error: ${error.message}`)
    } else if (error instanceof PackageJsonError) {
      console.error('package.json issue:', error.message)
    } else {
      console.error('Unexpected error:', error)
    }
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

<!-- embedme examples/api-examples.ts#L50-L65 -->

```ts
export async function customLoggingExample(): Promise<void> {
  const myLogger = {
    warning: (prefix: string, msg: string) => console.warn(prefix, msg),
    debug: (prefix: string, msg: string) => console.debug(prefix, msg),
  }

  const logger: Logger = {
    warn: (msg) => myLogger.warning('[DRIVER]', msg),
    debug: (msg) => myLogger.debug('[DRIVER]', msg), // Optional
  }

  const driver = await loadDriver({
    driverPackage: 'my-driver',
    logger,
  })
  console.log('Loaded driver:', driver)
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

<!-- embedme examples/api-examples.ts#L69-L76 -->

```ts
export function clearCacheExample(): void {
  // In test setup
  clearDriverCache() // Ensure each test starts with clean cache

  // After updating a driver package
  // await updateDriver('my-driver')
  clearDriverCache() // Force reload on next loadDriver call
}
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
- **Cache key:** Package name (e.g., '@ya-modbus/driver-xymd1')
- **Cache lifetime:** Persists for the lifetime of the Node.js process
- **Auto-detect mode:** Even auto-detected drivers are cached by their package name
- **No cache on errors:** Failed loads are not cached, allowing retry

**Example:**

<!-- embedme examples/api-examples.ts#L79-L87 -->

```ts
export async function cacheStatsExample(): Promise<void> {
  // First load - cache miss
  await loadDriver({ driverPackage: 'my-driver' })
  console.log(getDriverCacheStats()) // { hits: 0, misses: 1, size: 1 }

  // Second load - cache hit
  await loadDriver({ driverPackage: 'my-driver' })
  console.log(getDriverCacheStats()) // { hits: 1, misses: 1, size: 1 }
}
```

## Testing Utilities

The package provides testing utilities for applications using driver-loader.

<!-- embedme examples/api-examples.ts#L124-L137 -->

```ts
  const mockDriver = createMockDriver({
    defaultConfig: { baudRate: 9600 },
    devices: { test: { manufacturer: 'Test', model: 'Model' } },
  })

  // Create mock system dependencies
  const deps = mockSystemDeps({
    importModule: mockFn().mockResolvedValue(mockDriver),
  })

  // Use with loadDriver in tests
  void loadDriver({ driverPackage: 'test-driver' }, deps)
}

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

   <!-- embedme examples/api-examples.ts#L110-L111 -->

   ```ts
   // Example of correct DEFAULT_CONFIG
   export const DEFAULT_CONFIG_CORRECT = { baudRate: 9600 }
   ```

2. **ValidationError - Invalid SUPPORTED_CONFIG:**

   <!-- embedme examples/api-examples.ts#L113-L114 -->

   ```ts
   // Example of correct SUPPORTED_CONFIG
   export const SUPPORTED_CONFIG_CORRECT = { validBaudRates: [9600, 19200] }
   ```

3. **ValidationError - Missing createDriver:**

   <!-- embedme examples/api-examples.ts#L143-L146 -->

   ```ts
   type MockSystemDeps = (opts: { importModule: unknown }) => Record<string, unknown>

   // Correct createDriver export pattern
   export function createDriver(): void {
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

   <!-- embedme examples/api-examples.ts#L148-L150 -->

   ```ts
   }

   // Consistent configuration example
   ```

### Getting More Help

For additional debugging:

1. **Enable verbose logging:**

   <!-- embedme examples/api-examples.ts#L90-L98 -->

   ```ts
   export async function verboseLoggingExample(): Promise<void> {
     const logger = {
       warn: (msg: string) => console.warn('[DRIVER]', msg),
       debug: (msg: string) => console.debug('[DRIVER]', msg),
     }

     const driver = await loadDriver({ logger })
     console.log('Loaded driver:', driver)
   }
   ```

2. **Check cache statistics:**

   <!-- embedme examples/api-examples.ts#L101-L103 -->

   ```ts
   export function checkCacheExample(): void {
     console.log(getDriverCacheStats())
   }
   ```

3. **Clear the cache:**

   <!-- embedme examples/api-examples.ts#L106-L108 -->

   ```ts
   export function clearCacheTroubleshoot(): void {
     clearDriverCache()
   }
   ```

## License

GPL-3.0-or-later
