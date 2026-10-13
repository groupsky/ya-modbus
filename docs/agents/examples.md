# Package Compatibility Examples

## Purpose

Examples verify dual CommonJS/ESM package support across module systems.

## Dynamic Package Coverage

The `examples/verify-coverage.js` script automatically discovers all publishable packages.

BEFORE modifying consumer examples:
→ RUN `node examples/verify-coverage.js` to see current coverage
→ UNDERSTAND which packages are missing from which consumers

## Adding New Packages

When creating a new publishable package:

1. Package will be auto-detected by `verify-coverage.js`
2. CI WILL FAIL until package is added to all 4 consumer examples
3. ADD package to each consumer's `package.json` using `file:` protocol
4. IMPORT at least one export in each test file
5. RUN `examples/run-all.sh` to verify

## Bin-only Packages

Packages with a `bin` field and no `main` or `exports` (the unscoped `npx` wrappers, see docs/agents/package-creation.md) have nothing to import.

`verify-coverage.js` skips them automatically:
→ DO NOT add them to consumer examples
→ Their executables are covered by `npm run validate:bins`

A package with `bin` AND `main` or `exports` is NOT bin-only and MUST be covered like any other package.

## Modifying Consumer Examples

NEVER remove package dependencies from consumer examples.

ALWAYS maintain coverage of ALL publishable packages (except bin-only) in ALL consumers.

If removing a package from examples:
→ Package MUST be marked `private: true` in its package.json
→ UPDATE `verify-coverage.js` if consumer list changes

## Test Requirements

Each consumer example MUST:

- Include ALL publishable packages (except bin-only) in dependencies
- Import from ALL packages (except bin-only) in test file
- Test both named and default/namespace imports
- Pass TypeScript compilation (TypeScript consumers only)
- Execute successfully at runtime

See: `examples/README.md` for usage and troubleshooting
See: Research summary from PR for best practices and tooling recommendations

## CI Integration

The Package Compatibility job in CI runs these steps in order:

1. Build all packages (`npm run build`)
2. Validate package exports with publint (`npm run validate:publint`)
3. Validate TypeScript types with arethetypeswrong (`npm run validate:attw`); for bin-only packages it reports "does not contain types" and still exits 0
4. Check that built files import only declared packages (`npm run validate:dist-imports`)
5. Run consumer examples (`examples/run-all.sh`)

This provides layered verification: static analysis → type checking → runtime testing.
The examples link the packages from the monorepo, so they cannot catch an undeclared dependency. Step 4 does.
