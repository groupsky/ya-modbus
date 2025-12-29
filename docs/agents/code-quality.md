---
paths: /**/*.ts
---

# Code Quality Guidelines

## Principles

- DRY: Don't Repeat Yourself
- KISS: Keep It Simple, Stupid
- YAGNI: Don't add features not explicitly requested

## File Size Limits

- Code files: ~500 lines max (soft limit)
- Test files: ~1500 lines max (soft limit)
- If approaching limit, refactor/split proactively

## Avoid Over-Engineering

- No abstractions for single-use operations
- No error handling for impossible scenarios
- Three similar lines > premature abstraction

## When Deleting Code

- Remove completely, no compatibility shims
- No `_unusedVar` renames
- No `// removed` comments
