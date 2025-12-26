# Commands Directory

## Directory Organization Rule

**CRITICAL**: This directory contains **ONLY command implementations**.

## What Belongs Here

- **Command files**: `read.ts`, `write.ts`, etc.
  - Each file implements a specific CLI command
  - Exports a command function (e.g., `readCommand`, `writeCommand`)
  - Contains command-specific options interface

- **Command test files**: `read.test.ts`, `write.test.ts`, etc.
  - Co-located with command implementations
  - Test command-specific logic and behavior

## What Does NOT Belong Here

- ❌ **Utility functions** → Move to `src/utils/`
- ❌ **Validation logic** → Move to `src/utils/validation.ts`
- ❌ **Helper functions** → Move to `src/utils/commands.ts`
- ❌ **Type definitions** → Move to `src/types/` or keep in `@ya-modbus/driver-types`
- ❌ **Constants** → Move to `src/utils/` or relevant module

## Examples

### ✅ Correct (Command Implementation)

```typescript
// commands/read.ts
export interface ReadOptions {
  port?: string
  host?: string
  dataPoint?: string
  // ... command-specific options
}

export async function readCommand(options: ReadOptions): Promise<void> {
  // Command implementation using utilities from ../utils/
}
```

### ❌ Incorrect (Utility/Helper)

```typescript
// commands/utils.ts - WRONG LOCATION!
export function validateBaudRate(rate: number): boolean {
  // This should be in src/utils/validation.ts
}

export function withDriver<T>(...): Promise<T> {
  // This should be in src/utils/commands.ts
}
```

## File Naming Convention

- Command implementations: `<command-name>.ts`
- Command tests: `<command-name>.test.ts`
- No `utils.ts`, `helpers.ts`, `validation.ts`, etc.

## Enforcement

When adding new files to this directory, ask:

1. **Does this file export a command function?** If no → wrong directory
2. **Is this file testing a command?** If no → wrong directory
3. **Is this a utility/helper?** If yes → move to `src/utils/`

## Related Directories

- **`src/utils/`**: Shared utilities and helpers
  - `commands.ts`: Command helper functions (withDriver, etc.)
  - `validation.ts`: Validation logic
- **`src/formatters/`**: Output formatting (table, JSON, etc.)
- **`src/transport/`**: Transport layer (RTU, TCP)
- **`src/driver-loader/`**: Driver loading logic
