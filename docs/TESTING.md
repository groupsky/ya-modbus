# Testing Guidelines

**REQUIRED**: Read this document before writing tests in this project.

## Test Organization

### Use `describe` Sparingly

Only use `describe` blocks when grouping **3 or more related tests**. For fewer tests, keep them flat.

**Good**:

```typescript
// Only 2 tests - no describe needed
test('validates required fields', () => {
  // ...
})

test('rejects invalid format', () => {
  // ...
})
```

**Bad**:

```typescript
// Unnecessary nesting for 2 tests
describe('validation', () => {
  test('validates required fields', () => {
    // ...
  })

  test('rejects invalid format', () => {
    // ...
  })
})
```

## Avoid Repetitive Tests

### Use `test.each` for Similar Tests

When testing multiple similar cases, use `test.each` instead of writing separate tests.

**Good**:

```typescript
test.each([
  { input: 0, expected: 0 },
  { input: 100, expected: 100 },
  { input: -50, expected: 0 },
  { input: 150, expected: 100 },
])('clamps value $input to $expected', ({ input, expected }) => {
  expect(clamp(input, 0, 100)).toBe(expected)
})
```

**Bad**:

```typescript
test('clamps negative values to 0', () => {
  expect(clamp(-50, 0, 100)).toBe(0)
})

test('clamps values above max', () => {
  expect(clamp(150, 0, 100)).toBe(100)
})

test('preserves values within range', () => {
  expect(clamp(50, 0, 100)).toBe(50)
})
```

### Alternative Formats

For readable test descriptions:

```typescript
test.each([
  ['negative value', -50, 0],
  ['value above max', 150, 100],
  ['value within range', 50, 50],
])('clamps %s correctly', (description, input, expected) => {
  expect(clamp(input, 0, 100)).toBe(expected)
})
```

## Test Location

Tests are **co-located** with source files:

- `foo.ts` → `foo.test.ts`
- Never use `__tests__` directories

## Additional Resources

- Main TDD workflow: See "Development Approach" in root AGENTS.md
- Device driver testing: See `docs/DRIVER-DEVELOPMENT.md`
