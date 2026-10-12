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

### TypeScript Configuration

ALL packages MUST use consistent tsconfig structure:

**tsconfig.esm.json and tsconfig.cjs.json:**

- Use `rootDir: "."` (NEVER use `rootDir: "src"`)
- Include `["src"]` for library packages
- Include `["src", "bin"]` for packages with CLI executables
- Output: `dist/esm/src/` and `dist/cjs/src/` for all packages

**package.json structure:**

- `main`: `"./dist/cjs/src/index.js"`
- `module`: `"./dist/esm/src/index.js"`
- `types`: `"./dist/esm/src/index.d.ts"`
- `exports["."]` points to `dist/{esm,cjs}/src/index.js`
- `bin` (if present): `"./dist/esm/bin/<name>.js"`
- Bin files MUST include shebang (`#!/usr/bin/env node` as first line)
- Build script MUST set executable permissions on bin files (ESM and CJS)
- CLI `--version` MUST come from `getCallerPackageInfo()` of `@ya-modbus/driver-loader` (works in ESM and CJS builds), NEVER a hardcoded string. See: packages/cli/src/index.ts

CRITICAL: Using `rootDir: "."` for all packages ensures consistent output structure and prevents configuration errors when adding bin executables.

CRITICAL: TypeScript compilation does not preserve executable permissions. Add `chmod +x` to build script for all bin files.

See: packages/cli for reference package with bin executable
See: packages/cli/package.json (build script) for chmod pattern
See: packages/driver-xymd1 for reference library package

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

- All packages except bin-only wrappers: `@ya-modbus/<name>` (scoped naming)
- Driver folders: `packages/driver-<device>`
- Driver package names: `@ya-modbus/driver-<device>`

### Engines Field

All packages MUST include engines field specifying minimum Node.js version.

See: packages/driver-xymd1/package.json (engines section) for configuration.

## Bin-only Wrapper Packages

Unscoped packages that only exist so `npx <name>` works (`ya-modbus`, `ya-modbus-bridge`, `ya-modbus-emulator`, `ya-modbus-profile`). They have no API and nothing to compile, so the dual-package, tsconfig, jest and coverage requirements above do NOT apply.

- Folder name = npm name (`packages/ya-modbus`)
- `bin/<name>.js`: plain ESM JavaScript with shebang, executable bit set, no build step
- NO `main`, `exports`, tsconfig files, jest.config.cjs, AGENTS.md or build script
- `bin` command name MUST equal the package name and the command of the target package
- Dependency on the target package uses a caret range of its current version, like other internal dependencies: lerna keeps it current and publishes the wrapper with every target release
- `files`: `bin`, `README.md`, `CHANGELOG.md`
- Behavior is verified by `npm run validate:bins` (every `bin` runs `--help` and exits 0), not by jest
- `examples/verify-coverage.js` skips them, see docs/agents/examples.md

See: packages/ya-modbus for reference

## Driver Packages

For driver development (architecture, workflow, testing), see docs/agents/driver-development.md

## Verification Steps

Before committing:

1. `npm install` succeeds
2. `npm run build` builds package
3. `npm test` from root discovers package tests
4. Coverage meets 95% thresholds
5. Package added to root jest.config.js
6. `npm run validate:packages` passes (for publishable packages)
7. `npm run validate:bins` passes (for packages with `bin`; each bin MUST exit 0 on `--help` and print its package.json version on `--version`)
8. `npm run validate:dist-imports` passes (built files import only declared packages; when the build imports `tslib`, it MUST be in `dependencies`)

Bin-only wrappers skip steps 2-5.

Before merging to main (for publishable packages):

9. First-time npm publish completed manually (see `docs/PUBLISHING-SETUP.md`)
10. Trusted publisher configured on npm.com

## References

- Comprehensive guide: docs/NEW-PACKAGE.md
- Driver development: docs/agents/driver-development.md
- Driver reference: packages/driver-xymd1
- CLI reference: packages/cli
