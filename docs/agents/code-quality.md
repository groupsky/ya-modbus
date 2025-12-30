---
paths: /**/*.ts
---

# Code Quality Guidelines

## Principles

- DRY: Don't Repeat Yourself
- KISS: Keep It Simple, Stupid
- YAGNI: Don't add features not explicitly requested

## File Size Limits

- Code files: target ~500 lines
- Test files: target ~1500 lines
- REFACTOR BEFORE reaching limits, not after

## Avoid Over-Engineering

- No abstractions for single-use operations
- No error handling for impossible scenarios
- Three similar lines > premature abstraction

## When Deleting Code

- Remove completely, no compatibility shims
- No `_unusedVar` renames
- No `// removed` comments
