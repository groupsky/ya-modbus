---
paths: /**/*.ts
---

# Refactoring Guidelines

## When to Refactor

- Code violates DRY, KISS, or YAGNI principles
- File size approaching limits (~500 lines for code, ~1500 for tests)
- Extract duplicated logic into reusable functions
- Simplify complex conditional logic
- Extract magic numbers into named constants

## Coverage Maintenance

- NEVER refactor without comprehensive test coverage
- Tests must exist BEFORE refactoring begins
- Refactor ONLY changes implementation, not behavior
- Run full test suite after each refactoring step
- Commit frequently (small, atomic changes)

## Safe Refactoring Patterns

- Rename: update all references at once with IDE tools
- Extract: create new function with tests, then use it
- Inline: remove wrapper function only after inlining all calls
- Move: update imports after moving file, test all modules
- Split: one function per responsibility, test each independently

## Refactoring Commits

- Separate from feature/bug fix commits
- Use conventional format: `refactor(scope): reason for refactoring`
- No functional changes in refactoring commits
- Test suite must PASS before AND after refactor

## What NOT to Refactor

- Code covered by insufficient tests
- Performance-critical paths without profiling data
- Code about to be deleted (wait for deletion)
- External interfaces or public APIs (requires deprecation)

See: `docs/agents/code-quality.md` for quality principles
See: `docs/agents/testing.md` for test-first approach
