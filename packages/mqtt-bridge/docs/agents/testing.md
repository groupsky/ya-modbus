---
paths: packages/mqtt-bridge/**/*.test.ts
---

# Testing

## Test Strategy

- Mock MQTT client for unit tests
- Test device lifecycle operations
- Test polling coordination
- Test state persistence and recovery
- Test error handling and reconnection logic

## Mocking MQTT Client

See: packages/mqtt-bridge/src/index.test.ts for MQTT client mocking pattern

## Coverage Requirements

95% coverage (branches, functions, lines, statements)

See: docs/agents/testing.md (root) for general testing guidelines
See: packages/mqtt-bridge/jest.config.cjs for coverage configuration
