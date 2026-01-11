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

All packages MUST publish BOTH CommonJS and ESM formats.

See: packages/driver-xymd1/package.json for exports configuration and build scripts
See: packages/driver-xymd1/tsconfig.esm.json for ESM build config
See: packages/driver-xymd1/tsconfig.cjs.json for CJS build config

CRITICAL: Add references to BOTH tsconfig files for each dependency.

### Package Types: CLI vs Library

**Library packages** (drivers, transport, etc.):

- Use `rootDir: "src"` in tsconfig
- Output: `dist/esm/index.js` and `dist/cjs/index.js`
- Exports point to `dist/{esm,cjs}/index.js`

**CLI packages** (cli, device-profiler, mqtt-bridge):

- Use `rootDir: "."` in tsconfig
- Include both `src` and `bin` directories
- Output: `dist/esm/src/` and `dist/esm/bin/`
- Exports point to `dist/{esm,cjs}/src/index.js`
- Bin field points to `dist/esm/bin/*.js`

See: packages/cli/tsconfig.esm.json for CLI package structure
See: packages/driver-xymd1/tsconfig.esm.json for library package structure

### CommonJS Module Interop

When importing CommonJS modules (like `modbus-serial`, `aedes`), use direct default imports with `esModuleInterop: true`.

See: packages/mqtt-bridge/src/index.ts for correct import patterns
See: packages/transport/src/tcp-transport.ts for modbus-serial imports
See: packages/mqtt-bridge/src/utils/test-utils.ts for aedes imports

Root configs have `esModuleInterop: true` which synthesizes default exports for CommonJS modules.

### Coverage Thresholds

All packages require 95% coverage (branches, functions, lines, statements).

See: packages/driver-xymd1/jest.config.cjs (coverageThreshold section) for required configuration.

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

All packages MUST include engines field specifying minimum Node.js version.

See: packages/driver-xymd1/package.json (engines section) for configuration.

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
