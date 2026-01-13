---
paths: /**/README.md, /**/docs/*.md
---

# User Documentation Guidelines

## Code Snippets in Documentation

All TypeScript code snippets in README.md files MUST be:

1. **Synced from source files** using embedme comments
2. **Tested** via example files with Jest tests

## Embedme Pattern

PREFER embedding whole files. Use line ranges only when showing a small snippet without setup/teardown parts.

**Whole file (preferred):**

```markdown
<!-- embedme examples/example-usage.ts -->
```

**Line range (when necessary):**

```markdown
<!-- embedme examples/example-usage.ts#L10-L25 -->
```

**Code block format** - Use `ts` for code blocks (embedme requires this):

````markdown
<!-- embedme examples/example-usage.ts -->

```ts

```
````

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

## Verification

Run `npm run docs:verify` to check embedme sync status.

## Reference Files

- Pattern: packages/driver-xymd1/README.md
- Example: packages/driver-xymd1/examples/example-rtu.ts
- Test: packages/driver-xymd1/examples/example-rtu.test.ts
