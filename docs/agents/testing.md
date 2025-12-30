---
paths: /**/*.test.ts
---

# Testing Guidelines

## Methodology

- WRITE tests first (TDD): fail → implement → pass → refactor
- INCLUDE tests in feature commits (NEVER commit untested code)

## Behavior Over Implementation

- Test observable behavior, not internal details
- Tests should survive refactoring
- Focus on inputs → outputs, not how

## Mocking Strategy

- Mock external boundaries only (APIs, databases, filesystems)
- Prefer real implementations when feasible
- NEVER mock the unit under test

## Test Organization

- Co-located: `foo.ts` → `foo.test.ts`
- Use `test.each` for similar cases
- `describe` only for 3+ related tests

See: `docs/TESTING.md` for test.each patterns
