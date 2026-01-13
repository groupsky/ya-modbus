---
paths: /**/README.md, /**/docs/*.md
---

# User Documentation Guidelines

## Code Snippets in Documentation

All TypeScript code snippets in README.md files MUST be:

1. **Synced from source files** using embedme comments
2. **Tested** via example files with Jest tests

## Embedme Pattern

PREFER embedding whole files for main examples. Use line ranges for small snippets showing specific operations.

**Whole file (for main usage example):**

````markdown
<!-- embedme examples/example-rtu.ts -->

```ts
// File content will be embedded here
```
````

**Line range (for focused snippets):**

````markdown
<!-- embedme examples/example-rtu.ts#L33-L37 -->

```ts
// Only lines 33-37 will be embedded
```
````

**Constants from source (no example file needed):**

````markdown
<!-- embedme src/index.ts#L89-L95 -->

```ts
// Embeds DEFAULT_CONFIG directly from source
```
````

Constants like `DEFAULT_CONFIG`, `SUPPORTED_CONFIG`, or type definitions can be embedded directly from source files. These don't need example files or tests since they're already tested as part of the main package.

**Required format:**

- Use `ts` for code blocks (not `typescript`)
- Blank line after embedme comment, before code block
- CI enforces all `ts`/`typescript` blocks have embedme comments

See: packages/driver-xymd1/README.md for reference implementation

## Example File Requirements

Example files (`packages/*/examples/example-*.ts`) MUST:

1. Be self-contained and runnable
2. Have paired `*.test.ts` file (CI enforces this)

See: packages/driver-xymd1/examples/ for patterns

## What NOT to Test

- Bash/CLI usage examples (documentation only)
- JSON/YAML configuration snippets
- Type definition examples
- Constants embedded from source files (already tested in main package)

## Verification

Run `npm run docs:verify` to check embedme sync status.

## Reference Files

- Pattern: packages/driver-xymd1/README.md
- Example: packages/driver-xymd1/examples/example-rtu.ts
- Test: packages/driver-xymd1/examples/example-rtu.test.ts
