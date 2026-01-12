---
paths: /**/README.md, /**/docs/*.md
---

# User Documentation Guidelines

## Code Snippets in Documentation

All TypeScript code snippets in README.md files MUST be:

1. **Synced from source files** using embedme comments
2. **Tested** via example files that run in CI

## Embedme Pattern

Use embedme comments to sync code from example files:

```markdown
<!-- embedme examples/example-usage.ts#L10-L25 -->
```

See: packages/driver-xymd1/README.md for reference implementation

## Example File Requirements

Example files (`packages/*/examples/example-*.ts`) MUST:

1. Be self-contained and runnable
2. Use `withEmulator()` for in-memory testing OR
3. Have paired `*.test.ts` for complex scenarios (RTU)

See: packages/driver-xymd1/examples/ for patterns

## Testing Strategy

- **Simple examples**: Self-contained, run by `npm run test:examples`
- **Complex examples (RTU)**: Paired Jest tests with `withRtuEmulator()`

## What NOT to Test

- Bash/CLI usage examples (documentation only)
- JSON/YAML configuration snippets
- Type definition examples

## Verification

Run `npm run docs:verify` to check embedme sync status.

## Reference Files

- Pattern: packages/driver-xymd1/README.md
- Simple example: packages/driver-xymd1/examples/example-read-sensor.ts
- RTU example: packages/driver-xymd1/examples/example-rtu.ts
- RTU test: packages/driver-xymd1/examples/example-rtu.test.ts
