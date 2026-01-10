---
paths: /**/packages/*/package.json, /**/packages/*/jest.config.cjs, /**/packages/*/tsconfig.json
---

# Package Creation Guidelines

Creating packages in this monorepo. See docs/NEW-PACKAGE.md for comprehensive user guide.

## Required Files

Every new package MUST include:

1. **package.json** - Dual package configuration with exports field
2. **jest.config.cjs** - 95% coverage thresholds (all metrics)
3. **tsconfig.esm.json** - Extends root tsconfig.esm.json for ESM build
4. **tsconfig.cjs.json** - Extends root tsconfig.cjs.json for CJS build
5. **tsconfig.lint.json** - Extends tsconfig.lint-base.json (for ESLint)
6. **AGENTS.md** - Package-specific agent guidance
7. **README.md** - User documentation

## Critical Requirements

### Dual Package Configuration

All packages publish BOTH CommonJS and ESM formats:

**package.json structure:**
```json
{
  "type": "module",
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/esm/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/esm/index.d.ts",
        "default": "./dist/esm/index.js"
      },
      "require": {
        "types": "./dist/cjs/index.d.ts",
        "default": "./dist/cjs/index.js"
      }
    }
  },
  "scripts": {
    "build": "npm run build:esm && npm run build:cjs && npm run build:package-json",
    "build:esm": "../../node_modules/.bin/tsc -p tsconfig.esm.json",
    "build:cjs": "../../node_modules/.bin/tsc -p tsconfig.cjs.json",
    "build:package-json": "echo '{\"type\":\"module\"}' > dist/esm/package.json && echo '{\"type\":\"commonjs\"}' > dist/cjs/package.json",
    "typecheck": "../../node_modules/.bin/tsc --noEmit"
  }
}
```

### TypeScript Configuration

**tsconfig.esm.json:**
```json
{
  "extends": "../../tsconfig.esm.json",
  "compilerOptions": {
    "outDir": "dist/esm",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [
    { "path": "../dependency/tsconfig.esm.json" }
  ]
}
```

**tsconfig.cjs.json:**
```json
{
  "extends": "../../tsconfig.cjs.json",
  "compilerOptions": {
    "outDir": "dist/cjs",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [
    { "path": "../dependency/tsconfig.cjs.json" }
  ]
}
```

IMPORTANT: Add references to BOTH tsconfig files for each dependency.

### CommonJS Module Interop

When importing CommonJS modules (like `modbus-serial`, `aedes`) in ESM builds, use namespace imports:

```typescript
// ❌ DON'T - breaks with Node16 module resolution
import ModbusRTU from 'modbus-serial'

// ✅ DO - works with both ESM and CJS
import * as ModbusRTUNamespace from 'modbus-serial'
const ModbusRTU = (ModbusRTUNamespace as any).default || ModbusRTUNamespace
```

For type-only imports where types are used in function signatures, use `any` for simplicity:
```typescript
// Internal utility - using any for ESM/CJS interop
function createTransport(client: any): Transport {
  return { /* ... */ }
}
```

### Coverage Thresholds

All packages require 95% coverage (branches, functions, lines, statements).

See: `packages/driver-xymd1/jest.config.cjs:23-30` for required `coverageThreshold` configuration.

### Root Configuration Updates

CRITICAL: When creating a new package, update these root files:

1. **jest.config.js** - Add package to projects array (tests won't run from root otherwise)
2. **tsconfig.lint-base.json** - Add package to paths mapping (ESLint won't resolve imports)

NOTE: No longer need to update root tsconfig.json - packages handle their own build configurations.

### Naming Patterns

- All packages: `@ya-modbus/<name>` (scoped naming)
- Driver folders: `packages/driver-<device>`
- Driver package names: `@ya-modbus/driver-<device>`

### Engines Field

All packages MUST include the engines field:

```json
"engines": {
  "node": ">=20.0.0"
}
```

## Driver Packages

For driver development (architecture, workflow, testing), see docs/agents/driver-development.md

## Verification Steps

Before committing:

1. `npm install` succeeds
2. `npm run build` builds package
3. `npm test` from root discovers package tests
4. Coverage meets 95% thresholds
5. Package added to root jest.config.js

Before merging to main (for publishable packages):

6. First-time npm publish completed manually (see `docs/PUBLISHING-SETUP.md`)
7. Trusted publisher configured on npm.com

## References

- Comprehensive guide: docs/NEW-PACKAGE.md
- Driver development: docs/agents/driver-development.md
- Driver reference: packages/driver-xymd1
- CLI reference: packages/cli
