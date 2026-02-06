# Creating a New Package

This guide covers the requirements and steps for creating a new package in the monorepo.

## Required Files and Configuration

When creating a new package in `packages/`, you MUST include:

### 1. package.json

Required scripts:

```json
{
  "scripts": {
    "build": "tsc --build",
    "clean": "rm -rf dist",
    "test": "jest",
    "lint": "eslint ."
  }
}
```

### 2. jest.config.cjs

Create a Jest configuration following the pattern in existing packages:

```javascript
module.exports = {
  displayName: 'your-package-name',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../../tsconfig.base.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@ya-modbus/(.*)$': '<rootDir>/../$1/src',
  },
  collectCoverageFrom: [
    '<rootDir>/src/**/*.ts',
    '!<rootDir>/src/**/*.test.ts',
    '!<rootDir>/src/**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
}
```

**REQUIRED**: All new packages must set minimum coverage thresholds of **95%** for branches, functions, lines, and statements. This ensures high test quality and prevents regressions.

See `packages/cli/jest.config.cjs` or `packages/driver-xymd1/jest.config.cjs` for reference.

### 3. AGENTS.md

Create an AGENTS.md file with package-specific guidance for AI agents.

**Template structure**:

```markdown
# Package Name - Development Guide

Brief description of the package's purpose.

## Purpose

What this package does and when to use it.

## Key Concepts

Package-specific concepts, patterns, or architecture.

## Common Tasks

Typical development workflows for this package.

## Testing

Package-specific testing patterns or requirements.
```

### 4. README.md

Create a README.md with:

- Package description
- Installation instructions
- Usage examples
- API documentation (if applicable)

## Root Configuration Updates

### Add to Root Jest Configuration

Add your package to the `projects` array in `/jest.config.js`:

```javascript
module.exports = {
  projects: [
    '<rootDir>/packages/your-package-name',
    // ... other packages
  ],
  // ... rest of config
}
```

**CRITICAL**: This is required for tests to run when executing `npm test` from the root.

## Verification Checklist

After creating the package:

- [ ] `npm install` completes successfully
- [ ] `npm run build` builds the package
- [ ] `npm run test` from package directory runs tests
- [ ] `npm test` from root discovers and runs package tests
- [ ] Coverage thresholds are set to 95% in jest.config.cjs
- [ ] Tests achieve at least 95% coverage across all metrics
- [ ] `npm run lint` from package directory lints successfully
- [ ] `npm run lint` from root includes the package
- [ ] README.md contains essential usage information
- [ ] `npm run validate:packages` passes (validates exports and types)

## First-Time NPM Publishing

When publishing a new package to npm for the first time, you MUST publish manually before automated releases will work. This is due to a "chicken and egg" problem with npm trusted publishers:

- Trusted publishers require the package to already exist on npm
- The package doesn't exist until you publish it
- **Solution**: Manual first publish → configure trusted publisher → automation works

### Quick Steps

1. **Manual first publish** from package directory:

   ```bash
   npm login
   npm run build
   npm publish --access public
   ```

2. **Configure trusted publisher** on npm:
   - Go to package settings on npm.com
   - Add trusted publisher with: owner=`<github-owner>`, repo=`<repo-name>`, workflow=`release.yml`, environment=`npm`

3. **Verify** by opening a PR to trigger preview packages via pkg.pr.new, then merging to trigger production release (see [Release Process](RELEASE-PROCESS.md) for details)

See [PUBLISHING-SETUP.md](PUBLISHING-SETUP.md#first-time-package-publishing) for detailed instructions.

## Common Patterns

### TypeScript Configuration

Packages typically extend the base tsconfig:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "."
  },
  "include": ["src"]
}
```

**IMPORTANT:** Always use `rootDir: "."` (not `"src"`). This ensures consistent output structure across all packages and prevents configuration errors when adding bin executables later.

### Engine Requirements

All packages MUST specify the Node.js engine requirement:

```json
{
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### Module Resolution

For ESM packages, set in package.json:

```json
{
  "type": "module"
}
```

### Internal Dependencies

Reference other workspace packages:

```json
{
  "dependencies": {
    "@ya-modbus/driver-types": "^0.0.0"
  }
}
```

## Package Types

### Driver Package

Device driver packages use scoped naming: `@ya-modbus/driver-<device>`

The package folder should be named `driver-<device>` (e.g., `packages/driver-xymd1`).

**Required exports**:

1. **createDriver function**: Main driver factory function

**Recommended exports**:

1. **DEFAULT_CONFIG constant**: Factory-default device configuration

   ```typescript
   import type { DefaultSerialConfig } from '@ya-modbus/driver-types'

   export const DEFAULT_CONFIG = {
     baudRate: 9600,
     parity: 'even',
     dataBits: 8,
     stopBits: 1,
     defaultAddress: 1,
   } as const satisfies DefaultSerialConfig
   ```

   For Modbus TCP devices, use `DefaultTCPConfig`:

   ```typescript
   import type { DefaultTCPConfig } from '@ya-modbus/driver-types'

   export const DEFAULT_CONFIG = {
     defaultAddress: 1,
     defaultPort: 502,
   } as const satisfies DefaultTCPConfig
   ```

2. **Supported configuration values**: Export device-specific supported configuration values

   ```typescript
   import type { SupportedSerialConfig } from '@ya-modbus/driver-types'

   export const SUPPORTED_CONFIG = {
     validBaudRates: [9600, 14400, 19200],
     validParity: ['even', 'none'],
     validDataBits: [8],
     validStopBits: [1],
     validAddressRange: [1, 247],
   } as const satisfies SupportedSerialConfig
   ```

   Only include the properties that are device-specific. Omit properties if your device supports standard values (e.g., omit `validParity` if supporting all standard parity settings).

   For Modbus TCP devices, use `SupportedTCPConfig`:

   ```typescript
   import type { SupportedTCPConfig } from '@ya-modbus/driver-types'

   export const SUPPORTED_CONFIG = {
     validPorts: [502],
     validAddressRange: [1, 247],
   } as const satisfies SupportedTCPConfig
   ```

**Benefits**:

- Makes device specifications discoverable via code completion
- Reduces configuration errors
- Provides single source of truth for defaults
- Enables DRY compliance in tests
- Type-safe with TypeScript `as const`

**Documentation recommendations** (if implementing DEFAULT_CONFIG):

- File header comment should reference DEFAULT_CONFIG instead of duplicating values
- README should include example using DEFAULT_CONFIG
- Add JSDoc with usage example on DEFAULT_CONFIG constant

**Testing recommendations** (if implementing both DEFAULT_CONFIG and SUPPORTED_CONFIG):

Add cross-validation tests to ensure DEFAULT_CONFIG values are within SUPPORTED_CONFIG constraints:

```typescript
describe('Configuration consistency', () => {
  it('should include DEFAULT_CONFIG baud rate in valid baud rates', () => {
    expect(SUPPORTED_CONFIG.validBaudRates).toContain(DEFAULT_CONFIG.baudRate)
  })

  it('should include DEFAULT_CONFIG parity in valid parity options', () => {
    expect(SUPPORTED_CONFIG.validParity).toContain(DEFAULT_CONFIG.parity)
  })

  it('should include DEFAULT_CONFIG address in valid address range', () => {
    const [min, max] = SUPPORTED_CONFIG.validAddressRange
    expect(DEFAULT_CONFIG.defaultAddress).toBeGreaterThanOrEqual(min)
    expect(DEFAULT_CONFIG.defaultAddress).toBeLessThanOrEqual(max)
  })
})
```

This pattern ensures the factory defaults are always valid according to the device's supported values.

See `packages/driver-xymd1` for reference implementation.

### Utility Package

Utility packages should use scoped naming: `@ya-modbus/<name>`

Examples: `@ya-modbus/driver-types`, `@ya-modbus/cli`

## Getting Help

- See existing packages for reference implementations
