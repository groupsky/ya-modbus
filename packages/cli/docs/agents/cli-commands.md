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

## Testing Commands

Mock all dependencies (transport/factory, driver-loader, formatters).

Verify flow: create transport → load driver → read/write → format output.

See: `src/commands/read.test.ts`, `src/commands/write.test.ts`
