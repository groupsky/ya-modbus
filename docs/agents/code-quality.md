---
paths: /**/*.ts
---

# Code Quality Guidelines

## Principles

- DRY: Don't Repeat Yourself
- KISS: Keep It Simple, Stupid
- YAGNI: Don't add features not explicitly requested

## Architectural Patterns

- Prefer functional programming over class-based
- Prefer composition over inheritance
- Use dependency injection for testability
- Wrap system APIs with thin abstractions to simplify testing

## File Size Limits

- Code files: soft target ~500 lines, refactor when approaching ~400 lines
- Test files: soft target ~1500 lines, refactor when approaching ~1200 lines
- REFACTOR BEFORE reaching limits, not after

Refactoring threshold is a signal—not a rule. When a file approaches the threshold:

- Review for extractable utilities, helpers, or sub-classes
- Split by responsibility if possible
- Only defer refactoring if design is already optimal

Exceptions require explicit documentation at file top

## Avoid Over-Engineering

- No abstractions for single-use operations
- No error handling for impossible scenarios
- Three similar lines > premature abstraction

## When Deleting Code

- Remove completely, no compatibility shims
- No `_unusedVar` renames
- No `// removed` comments
