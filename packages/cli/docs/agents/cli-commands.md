---
paths: /**/src/commands/*.ts
---

# CLI Command Structure

## Pattern

Commander.js subcommands with shared option sets.

Common option groups:

- RTU connection: port, baud-rate, parity, data-bits, stop-bits
- TCP connection: host, tcp-port
- Shared: slave-id, timeout, driver

Users specify RTU or TCP, never both.

## Adding a New Command

1. Create `src/commands/<name>.ts` and `src/commands/<name>.test.ts`
2. Define options interface
3. Implement command function (async)
4. Add command to `src/index.ts` with Commander
5. Update README with examples

See existing: `src/commands/read.ts`, `src/commands/write.ts`

## Directory Boundaries

`src/commands/` contains **ONLY** command implementations and tests.

### What Does NOT Belong Here

- ❌ Utils/helpers → `src/utils/commands.ts`
  - `withDriver()`, `withTransport()`, `applyDriverDefaults()`
- ❌ Validation → `src/utils/validation.ts`
  - `validateBaudRate()`, `validateParity()`, `ValidationError`
- ❌ Types → `src/types/` or `@ya-modbus/driver-types`
- ❌ Constants → relevant module (e.g., `src/utils/commands.ts`)
- ❌ Never: `utils.ts`, `helpers.ts`, `validation.ts` in commands/

### Related Directories

- `src/utils/` - Command helpers, validation
- `src/formatters/` - Table/JSON/performance output
- `src/transport/` - RTU/TCP transport implementations
- `src/driver-loader/` - Dynamic driver loading

See: `src/utils/commands.ts`, `src/formatters/table.ts`
