---
paths: /**/packages/*/package.json, /**/packages/*/jest.config.cjs, /**/packages/*/tsconfig.json
---

# Package Creation Guidelines

Creating packages in this monorepo. See docs/NEW-PACKAGE.md for comprehensive user guide.

## Required Files

Every new package MUST include:

1. **package.json** - Standard scripts: build, clean, test, lint
2. **jest.config.cjs** - 95% coverage thresholds (all metrics)
3. **tsconfig.json** - Extends tsconfig.base.json
4. **AGENTS.md** - Package-specific agent guidance
5. **README.md** - User documentation

## Critical Requirements

### Coverage Thresholds

```javascript
coverageThreshold: {
  global: {
    branches: 95,
    functions: 95,
    lines: 95,
    statements: 95,
  },
}
```

### Root Jest Configuration

CRITICAL: Add package to `/jest.config.js` projects array or tests won't run from root.

### Naming Patterns

- Drivers: `ya-modbus-driver-<device>`
- Utilities: `@ya-modbus/<name>`

## Driver Package Exports

Required:

- `createDriver` function

Recommended:

- `DEFAULT_CONFIG` constant - Factory defaults (use `DefaultSerialConfig` or `DefaultTCPConfig`)
- `SUPPORTED_CONFIG` constant - Device-specific constraints (use `SupportedSerialConfig` or `SupportedTCPConfig`)

If exporting both configs, add cross-validation tests ensuring defaults are within supported ranges.

## Verification Steps

Before committing:

1. `npm install` succeeds
2. `npm run build` builds package
3. `npm test` from root discovers package tests
4. Coverage meets 95% thresholds
5. Package added to root jest.config.js

## References

- Comprehensive guide: docs/NEW-PACKAGE.md
- Driver reference: packages/ya-modbus-driver-xymd1
- CLI reference: packages/cli
