# Package Compatibility Examples

This directory contains example projects that verify ya-modbus packages can be correctly consumed in different module systems and project types.

## Purpose

These examples serve as:

1. **Integration tests** - Verify dual CommonJS/ESM package support works correctly
2. **Documentation** - Show developers how to use ya-modbus packages in their projects
3. **CI validation** - Run automatically in CI to catch packaging regressions
4. **Package coverage** - Dynamically verify all publishable packages are tested in all module systems

## Examples

### 1. CommonJS Consumer (`cjs-consumer/`)

**Type**: Pure CommonJS project
**Tests**: `require()` imports work without `.default` workarounds

```javascript
// Named exports from SDK packages
const { readScaledUInt16BE, createEnumValidator } = require('@ya-modbus/driver-sdk')
const { createTransport, createRTUTransport } = require('@ya-modbus/transport')

// Driver packages (NO .default workaround needed)
const driverXymd1 = require('@ya-modbus/driver-xymd1')
const driver = await driverXymd1.createDriver({
  transport: { type: 'tcp', host: 'localhost', port: 502 },
})
```

**Key verification**: Default exports work directly without `.default` access

**Note**: JavaScript consumers cannot import type-only packages like `@ya-modbus/driver-types`

### 2. ES Module Consumer (`esm-consumer/`)

**Type**: Pure ES Module project
**Tests**: `import` statements work natively

```javascript
// Named exports from SDK packages
import { readScaledUInt16BE, createEnumValidator } from '@ya-modbus/driver-sdk'
import { createTransport, createRTUTransport } from '@ya-modbus/transport'

// Driver packages
import { createDriver as createXYMD1Driver, DEFAULT_CONFIG } from '@ya-modbus/driver-xymd1'
const driver = await createXYMD1Driver({ transport: { type: 'tcp', host: 'localhost', port: 502 } })
```

**Key verification**: Both named and default imports work correctly

**Note**: JavaScript consumers cannot import type-only packages like `@ya-modbus/driver-types`

### 3. TypeScript ESM Consumer (`typescript-esm-consumer/`)

**Type**: TypeScript project compiling to ESM
**Tests**: Full type safety with ES module output

```typescript
// Type-only imports
import type { DataType, DeviceDriver } from '@ya-modbus/driver-types'

// Runtime imports
import { readScaledUInt16BE, createEnumValidator } from '@ya-modbus/driver-sdk'
import { createDriver as createXYMD1Driver, DEFAULT_CONFIG } from '@ya-modbus/driver-xymd1'

// Full type safety
const driver: DeviceDriver = await createXYMD1Driver({
  transport: { type: 'tcp', host: 'localhost', port: 502 },
  slaveId: 1,
} as any)

const dataType: DataType = 'float' // Type-only usage
```

**Key verification**:

- TypeScript compilation succeeds
- Type definitions are correct
- Type-only imports work (`import type`)
- Runtime execution works

### 4. TypeScript CJS Consumer (`typescript-cjs-consumer/`)

**Type**: TypeScript project compiling to CommonJS
**Tests**: Full type safety with CommonJS output

```typescript
// Type-only imports
import type { DataType, DeviceDriver } from '@ya-modbus/driver-types'

// Runtime imports (NO .default workaround needed!)
import { readScaledUInt16BE } from '@ya-modbus/driver-sdk'
import { createDriver as createXYMD1Driver, DEFAULT_CONFIG } from '@ya-modbus/driver-xymd1'

const driver: DeviceDriver = await createXYMD1Driver({
  transport: { type: 'tcp', host: 'localhost', port: 502 },
  slaveId: 1,
} as any)
```

**Key verification**:

- TypeScript with `esModuleInterop: true` works
- No `.default` workaround required
- Types are correct in CommonJS context

## Running Examples

### Run All Examples (Recommended)

```bash
# From the examples directory
./run-all.sh
```

This script:

1. **Verifies package coverage** - Ensures all packages are declared and imported
2. **Runs all 4 consumer examples** - Tests CJS, ESM, TypeScript CJS, and TypeScript ESM
3. **Reports results** - Shows which examples passed/failed

### Run Package Coverage Verification Only

```bash
# From the examples directory
node verify-coverage.js
```

This script dynamically discovers all publishable packages and verifies:

- All consumer examples include all packages in `dependencies`
- All test files import from all packages
- Both default and named import patterns are tested

### Run Individual Example

```bash
cd cjs-consumer
npm install
npm test
```

## What Gets Tested

Each example verifies:

### Import Patterns

- ✅ Named exports (`import { DataType }`)
- ✅ Default exports (`import driver from`)
- ✅ Type-only imports (`import type`)
- ✅ No `.default` workaround needed in CJS

### Package Coverage

All examples test **all 10 publishable packages** from the monorepo:

- **@ya-modbus/cli** - Command-line interface
- **@ya-modbus/device-profiler** - Device profiling utilities
- **@ya-modbus/driver-ex9em** - EX9EM device driver
- **@ya-modbus/driver-loader** - Dynamic driver loading
- **@ya-modbus/driver-sdk** - SDK utilities and functions
- **@ya-modbus/driver-types** - TypeScript type definitions
- **@ya-modbus/driver-xymd1** - XY-MD1 device driver
- **@ya-modbus/emulator** - Modbus device emulator
- **@ya-modbus/mqtt-bridge** - MQTT bridge service
- **@ya-modbus/transport** - Transport layer (TCP/RTU)

Package coverage is **verified dynamically** - when you add a new package, `verify-coverage.js` will detect it and require it to be tested.

### Type Safety (TypeScript only)

- ✅ Type definitions resolve correctly
- ✅ Type checking passes
- ✅ IntelliSense works
- ✅ Type-only imports work

## CI Integration

These examples run automatically in CI via the `Test Package Compatibility` workflow. The workflow:

1. Builds all packages (`npm run build`)
2. Runs `examples/run-all.sh`
3. Fails the build if any example fails

This ensures package compatibility is never broken.

## Adding New Packages

When you add a new publishable package to the monorepo:

1. The `verify-coverage.js` script will **automatically detect it**
2. CI will **fail** until the package is added to all consumer examples
3. Add the package to each consumer's `package.json`:
   ```json
   "@ya-modbus/your-new-package": "file:../../packages/your-new-package"
   ```
4. Import and test at least one export from the package in each test file
5. Run `./run-all.sh` to verify

## Adding New Consumer Examples

To add a new example for testing a different module system/configuration:

1. Create directory: `examples/new-example/`
2. Add `package.json` with `file:` dependencies to **all** packages
3. Add test script that imports from **all** packages
4. Update `run-all.sh` to include the new example
5. Update `verify-coverage.js` to recognize the new consumer
6. Document the example in this README

## Dependencies

Examples use `file:` protocol to depend on local packages:

```json
{
  "dependencies": {
    "@ya-modbus/driver-types": "file:../../packages/driver-types"
  }
}
```

This ensures examples test the actual built packages (from `dist/` directories), not the source code.

## Troubleshooting

### Example fails with "Cannot find module"

- Ensure packages are built: `npm run build` from root
- Check the `file:` paths in example's package.json
- Try deleting `node_modules` and running `npm install` again

### TypeScript compilation fails

- Check `tsconfig.json` moduleResolution settings
- Ensure package type definitions are built
- Verify `esModuleInterop: true` is set for CJS projects

### Tests pass locally but fail in CI

- Check Node.js version (CI uses 20.x, 22.x, 24.x)
- Ensure no absolute paths are used
- Verify all dependencies are declared in package.json
