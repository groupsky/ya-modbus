# Commands Directory Organization

This document provides detailed guidance on organizing files in the `src/commands/` directory.

## Organization Rule

The `src/commands/` directory contains **ONLY command implementations**.

## What Belongs Here

### Command Files

Files like `read.ts`, `write.ts` that implement CLI commands.

Each command file:

- Exports a command function (e.g., `readCommand`, `writeCommand`)
- Defines a command-specific options interface
- Implements command-specific logic

Example: `read.ts`

See: `src/commands/read.ts`, `src/commands/write.ts`

### Command Test Files

Co-located test files like `read.test.ts`, `write.test.ts`.

Tests cover:

- Command-specific logic and behavior
- Integration with transport and driver loader
- Output formatting

See: `src/commands/read.test.ts`, `src/commands/write.test.ts`

## What Does NOT Belong Here

The following should be moved to appropriate locations:

### ❌ Utility Functions → `src/utils/`

Helper functions, shared logic, and command utilities.

Examples:

- `withDriver()` - Creates transport and driver instances
- `withTransport()` - Transport lifecycle management
- `applyDriverDefaults()` - Merges user options with driver defaults

Location: `src/utils/commands.ts`

### ❌ Validation Logic → `src/utils/validation.ts`

Input validation, constraint checking, and validation errors.

Examples:

- `validateBaudRate()` - Validates against driver constraints
- `validateParity()`, `validateDataBits()`, `validateStopBits()`
- `ValidationError` class

Location: `src/utils/validation.ts`

### ❌ Type Definitions → `src/types/` or `@ya-modbus/driver-types`

Shared types and interfaces used across multiple files.

Examples:

- Driver interface types
- Transport configuration types
- Shared option types

Location: Package `@ya-modbus/driver-types` for cross-package types, or `src/types/` for CLI-specific types.

### ❌ Constants → `src/utils/` or relevant module

Configuration constants, default values, and enumerations.

Examples:

- `DEFAULT_RTU_CONFIG` - Default serial port settings
- `DEFAULT_TCP_PORT` - Default Modbus TCP port

Location: `src/utils/commands.ts` or where they're used

## File Naming Convention

- Command implementations: `<command-name>.ts`
- Command tests: `<command-name>.test.ts`
- **Never**: `utils.ts`, `helpers.ts`, `validation.ts` in commands directory

## Decision Checklist

When adding a new file to `src/commands/`, ask:

1. **Does this file export a command function?**
   - If no → wrong directory

2. **Is this file testing a command?**
   - If no → wrong directory

3. **Is this a utility/helper?**
   - If yes → move to `src/utils/`

## Related Directories

### `src/utils/`

Shared utilities and helpers:

- `commands.ts` - Command helper functions (`withDriver`, `withTransport`, etc.)
- `validation.ts` - Validation logic and error classes

### `src/formatters/`

Output formatting:

- `table.ts` - Table output (cli-table3)
- `json.ts` - JSON output
- `performance.ts` - Performance metrics formatting

### `src/transport/`

Transport layer implementations:

- `factory.ts` - Auto-detect RTU vs TCP
- `rtu-transport.ts` - Serial RTU transport
- `tcp-transport.ts` - TCP transport

### `src/driver-loader/`

Driver loading logic:

- `loader.ts` - Dynamic driver imports and metadata loading

## Rationale

This organization ensures:

1. **Clarity**: Commands directory contains only command entry points
2. **Reusability**: Utilities can be shared across multiple commands
3. **Testability**: Utilities can be tested independently
4. **Maintainability**: Clear separation of concerns

## Historical Note

Prior to this organization, `commands/utils.ts` and `commands/validation.ts` existed in the commands directory, causing confusion about what constitutes a "command". These were moved to `src/utils/` to establish a clear convention.
