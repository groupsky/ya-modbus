# CLI Package - Agent Guide

## Overview

Interactive CLI tool for testing and developing Modbus device drivers. Supports RTU (serial) and TCP connections with real-time data point reading/writing.

## Package Structure

```
src/
├── commands/          # Command implementations
│   ├── read.ts        # Read data points
│   └── write.ts       # Write data points
├── transport/         # Transport layer (Modbus RTU/TCP)
│   ├── factory.ts     # Auto-detect RTU vs TCP
│   ├── rtu-transport.ts
│   └── tcp-transport.ts
├── driver-loader/     # Dynamic driver loading
│   └── loader.ts
├── formatters/        # Output formatting
│   ├── table.ts       # Table output (cli-table3)
│   ├── json.ts        # JSON output
│   └── performance.ts # Performance metrics
└── index.ts           # CLI entry (Commander.js)
```

## Key Architectural Decisions

### Transport Layer

**Pattern**: Wrap `modbus-serial` to implement Transport interface

- Implement all 8 Transport methods
- Automatic retry on transient failures (3 attempts, 100ms backoff)
- Return Buffers for consistency with driver interface

**Retry rationale**: RTU on RS-485 has transient bus collisions; auto-retry improves reliability.

### Driver Loading

**Pattern**: Convention over configuration + dynamic imports

Two loading modes:

1. **Auto-detect** (`localPackage: true`): Read cwd package.json, check for `keywords: ["ya-modbus-driver"]`, try import paths (src → dist → package name)
2. **Explicit** (`driverPackage: 'pkg-name'`): Direct dynamic import

**Import path fallback order**:

```
1. ./src/index.ts (development, TypeScript source)
2. ./dist/index.js (development, compiled)
3. <package-name> (production, installed)
```

**Validation**: Ensure module exports `createDriver` function and is callable.

### Command Structure

**Pattern**: Commander.js subcommands with shared option sets

Common option groups:

- RTU connection: port, baud-rate, parity, data-bits, stop-bits
- TCP connection: host, tcp-port
- Shared: slave-id, timeout, driver

**Design rationale**: Group related options reduces duplication. Users specify RTU or TCP, never both.

### Error Handling

**Pattern**: Validate early, fail with helpful messages

Validation: CLI args → data point existence → access mode → value range → transport

Error messages include what/why/how-to-fix (install commands, permission fixes).

## Testing Patterns

### Transport Tests

Mock `modbus-serial` library. Test retry logic by failing N times then succeeding.

See: `src/transport/rtu-transport.test.ts`, `src/transport/tcp-transport.test.ts`

### Command Tests

Mock all dependencies (transport/factory, driver-loader, formatters).

Verify flow: create transport → load driver → read/write → format output.

See: `src/commands/read.test.ts`, `src/commands/write.test.ts`

### Integration Tests

Use real driver packages with mock transport.

See: `src/commands/read.test.ts` integration test suites

## Common Tasks

### Adding a New Command

1. Create `src/commands/<name>.ts` and `src/commands/<name>.test.ts`
2. Define options interface
3. Implement command function (async)
4. Add command to `src/index.ts` with Commander
5. Update README with examples

See existing commands: `src/commands/read.ts`, `src/commands/write.ts`

### Adding a New Formatter

1. Create `src/formatters/<name>.ts` and test file
2. Export function: `export function formatX(data, options): string`
3. Import in command that uses it
4. Add `--format x` option if applicable

### Debugging Transport Issues

**Enable modbus-serial debug logging**: `DEBUG=modbus-serial ya-modbus read ...`

**Common issues**:

- **Timeouts**: Increase `--timeout`, check wiring, verify slave ID
- **CRC errors**: Check baud rate, parity, RS-485 termination
- **Permission denied**: Add user to `dialout` group (Linux)

## Performance Considerations

**Batch reads**: Commands use `driver.readDataPoints()` for multiple data points (single Modbus transaction vs multiple).

**Connection reuse**: Each command invocation creates new transport connection. For high-frequency polling, use the core bridge instead.

**Response time tracking**: Use `performance.now()` for sub-millisecond precision.

## Dependencies

**Production**:

- `commander` - CLI framework
- `chalk` - Terminal colors
- `cli-table3` - Table formatting
- `modbus-serial` - Modbus RTU/TCP client
- `zod` - Runtime validation (future use)

**Development**:

- `jest` + `ts-jest` - Testing
- `@types/cli-table3` - TypeScript definitions

## Future Enhancements

**Discovery commands** (planned):

- `discover` - Auto-detect slave ID, baud rate, parity
- `scan-registers` - Find readable/writable register ranges
- `test-limits` - Determine max batch size, timing requirements

**Implementation approach**: Create `src/discovery/` directory, implement algorithms with tests, add commands to `src/index.ts`.

## Troubleshooting Command Development

### Test Failures

**Mock not working**: Ensure mock is hoisted (`jest.mock()` before imports)

**Import errors**: Check path has `.js` extension (ESM requirement)

**Type errors in tests**: Cast mocks explicitly: `as jest.Mocked<Type>`

### Build Errors

**Cannot find module**: Verify `tsconfig.json` references include `@ya-modbus/driver-types`

**Shebang not working**: Ensure `bin/ya-modbus.ts` is executable: `chmod +x`

## Related Documentation

- Main CLI README: `packages/cli/README.md`
- Transport interface: `packages/driver-types/src/transport.ts`
- Driver interface: `packages/driver-types/src/device-driver.ts`
- Testing rules: `docs/TESTING.md`
