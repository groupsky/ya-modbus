---
paths: /**/*.integration.test.ts
---

# Integration Testing

## Required Reading

BEFORE writing integration tests:
→ READ packages/mqtt-bridge/src/index.integration.test.ts (event-based patterns)
→ READ packages/mqtt-bridge/src/cli.integration.test.ts (CLI test patterns)
→ READ packages/mqtt-bridge/src/utils/test-utils.ts (available helpers)

## Core Rules

- NEVER use `setTimeout()` - use broker events instead
- ALWAYS set up event listeners BEFORE performing actions
- ALWAYS use event-based helpers from test-utils.ts
- Use `withTimeout()` for promise timeouts (never bare `Promise.race()`)

## Test Structure

1. Start test broker with `startTestBroker()`
2. Set up event promise BEFORE action
3. Perform action
4. Wait for event promise
5. Assert expected state
6. Clean up with `broker.close()`

See: docs/agents/testing.md (root) for general testing guidelines
