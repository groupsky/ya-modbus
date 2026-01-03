---
paths: /**/packages/*/package.json, /**/packages/*/jest.config.cjs, /**/packages/*/tsconfig.json
---

# Package Creation Guidelines

Creating packages in this monorepo. See docs/NEW-PACKAGE.md for comprehensive user guide.

## Required Files

Every new package MUST include:

1. **package.json** - Standard scripts: build, clean, test, lint
2. **jest.config.cjs** - 95% coverage thresholds (all metrics)
3. **tsconfig.json** - Extends tsconfig.base.json (for build)
4. **tsconfig.lint.json** - Extends tsconfig.lint-base.json (for ESLint)
5. **AGENTS.md** - Package-specific agent guidance
6. **README.md** - User documentation

## Critical Requirements

### Coverage Thresholds

All packages require 95% coverage (branches, functions, lines, statements).

See: `packages/ya-modbus-driver-xymd1/jest.config.cjs:23-30` for required `coverageThreshold` configuration.

### Root Configuration Updates

CRITICAL: When creating a new package, update these root files:

1. **jest.config.js** - Add package to projects array (tests won't run from root otherwise)
2. **tsconfig.json** - Add package to references array (build won't include package)
3. **tsconfig.lint-base.json** - Add package to paths mapping (ESLint won't resolve imports)

See: Root `tsconfig.json:24-32` for references format
See: Root `tsconfig.lint-base.json:19-27` for paths format

### Naming Patterns

- Drivers: `ya-modbus-driver-<device>`
- Utilities: `@ya-modbus/<name>`

## Driver Packages

For driver development (architecture, workflow, testing), see docs/agents/driver-development.md

## Verification Steps

Before committing:

1. `npm install` succeeds
2. `npm run build` builds package
3. `npm test` from root discovers package tests
4. Coverage meets 95% thresholds
5. Package added to root jest.config.js

## References

- Comprehensive guide: docs/NEW-PACKAGE.md
- Driver development: docs/agents/driver-development.md
- Driver reference: packages/ya-modbus-driver-xymd1
- CLI reference: packages/cli
