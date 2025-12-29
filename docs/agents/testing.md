---
paths: /**/*.test.ts
---

# Testing Guidelines

## Methodology

- TDD required: write test first → fail → implement → pass → refactor
- Tests must be included with feature commits

## Behavior Over Implementation

- Test observable behavior, not internal details
- Tests should survive refactoring
- Focus on inputs → outputs, not how

## Mocking Strategy

- Mock external boundaries only (APIs, databases, filesystems)
- Prefer real implementations when feasible
- Never mock the unit under test

## Test Organization

- Co-located: `foo.ts` → `foo.test.ts`
- Use `test.each` for similar cases
- `describe` only for 3+ related tests

See: `docs/TESTING.md` for test.each patterns
