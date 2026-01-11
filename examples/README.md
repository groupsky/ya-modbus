# Package Compatibility Examples

This directory contains example projects that verify ya-modbus packages can be correctly consumed in different module systems and project types.

## Purpose

These examples serve as:

1. **Integration tests** - Verify dual CommonJS/ESM package support works correctly
2. **Documentation** - Show developers how to use ya-modbus packages in their projects
3. **CI validation** - Run automatically in CI to catch packaging regressions

## Examples

### 1. CommonJS Consumer (`cjs-consumer/`)

**Type**: Pure CommonJS project
**Tests**: `require()` imports work without `.default` workarounds

```javascript
const { DataType } = require('@ya-modbus/driver-types')
const xymd1Driver = require('@ya-modbus/driver-xymd1')
```

**Key verification**: Default exports work directly without `.default` access

### 2. ES Module Consumer (`esm-consumer/`)

**Type**: Pure ES Module project
**Tests**: `import` statements work natively

```javascript
import { DataType } from '@ya-modbus/driver-types'
import xymd1Driver from '@ya-modbus/driver-xymd1'
```

**Key verification**: Both named and default imports work correctly

### 3. TypeScript ESM Consumer (`typescript-esm-consumer/`)

**Type**: TypeScript project compiling to ESM
**Tests**: Full type safety with ES module output

```typescript
import { DataType } from '@ya-modbus/driver-types'
import type { ModbusDriver } from '@ya-modbus/driver-types'
import xymd1Driver from '@ya-modbus/driver-xymd1'

const driver: ModbusDriver = xymd1Driver
```

**Key verification**:

- TypeScript compilation succeeds
- Type definitions are correct
- Type-only imports work
- Runtime execution works

### 4. TypeScript CJS Consumer (`typescript-cjs-consumer/`)

**Type**: TypeScript project compiling to CommonJS
**Tests**: Full type safety with CommonJS output

```typescript
import { DataType } from '@ya-modbus/driver-types'
import xymd1Driver from '@ya-modbus/driver-xymd1' // No .default needed!
```

**Key verification**:

- TypeScript with `esModuleInterop: true` works
- No `.default` workaround required
- Types are correct in CommonJS context

## Running Examples

### Run All Examples

```bash
# From the examples directory
./run-all.sh
```

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

### Package Types

- **@ya-modbus/driver-types** - Enums and type definitions
- **@ya-modbus/driver-sdk** - SDK functions
- **@ya-modbus/transport** - Transport utilities
- **@ya-modbus/driver-xymd1** - Complete driver implementation

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

## Adding New Examples

To add a new example:

1. Create directory: `examples/new-example/`
2. Add `package.json` with `file:` dependencies to packages
3. Add test script that verifies imports work
4. Update `run-all.sh` to include the new example
5. Document the example in this README

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
