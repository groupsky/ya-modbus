---
paths: /**/*.test.ts
---

# Testing

## Test Strategy

- Mock MQTT client for unit tests
- Test device lifecycle operations
- Test polling coordination
- Test state persistence and recovery
- Test error handling and reconnection logic

## Unit Tests

Mock MQTT client for testing bridge logic in isolation.

See: packages/mqtt-bridge/src/index.test.ts

## Integration Tests

See: docs/agents/integration-testing.md for integration test patterns

## Timeouts

ALWAYS use `withTimeout()` from test-utils.ts for promise timeouts.
NEVER use bare `setTimeout()` or `Promise.race()` - uncanceled timers prevent Jest from exiting.

See: packages/mqtt-bridge/src/utils/test-utils.ts

## Coverage Requirements

95% coverage (branches, functions, lines, statements)

See: docs/agents/testing.md (root) for general testing guidelines
See: packages/mqtt-bridge/jest.config.cjs for coverage configuration
