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

See `packages/cli/jest.config.cjs` or `packages/ya-modbus-driver-xymd1/jest.config.cjs` for reference.

### 3. AGENTS.md

Create an AGENTS.md file with package-specific guidance for AI agents.

**REQUIRED**: Read `docs/AGENTS-MAINTENANCE.md` before creating the file.

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
- [ ] AGENTS.md follows guidelines in `docs/AGENTS-MAINTENANCE.md`
- [ ] README.md contains essential usage information

## Common Patterns

### TypeScript Configuration

Packages typically extend the base tsconfig:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
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

Device driver packages should follow naming: `ya-modbus-driver-<device>`

**Required exports**:

1. **createDriver function**: Main driver factory function

**Recommended exports**:

1. **DEFAULT_CONFIG constant**: Factory-default device configuration
   ```typescript
   export const DEFAULT_CONFIG = {
     baudRate: 9600,
     parity: 'even' as const,
     dataBits: 8,
     stopBits: 1,
     defaultAddress: 1,
   } as const
   ```
2. **Valid configuration constants**: Export validation constants to enable DRY testing
   ```typescript
   export const VALID_BAUD_RATES = [9600, 14400, 19200] as const
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

See `packages/ya-modbus-driver-xymd1` for reference implementation.

### Utility Package

Utility packages should use scoped naming: `@ya-modbus/<name>`

Examples: `@ya-modbus/driver-types`, `@ya-modbus/cli`

## Getting Help

- See existing packages for reference implementations
- Consult `packages/AGENTS.md` for development patterns
- Check `docs/AGENTS-MAINTENANCE.md` for documentation guidelines
