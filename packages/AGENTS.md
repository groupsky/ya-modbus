# Packages - Development Guide

This guide covers development practices for all executable code in the packages directory.

## Directory Structure

```
packages/
├── core/         # Bridge orchestration, transport, polling, discovery
├── cli/          # Command-line tool (test, provision, monitor)
├── devices/      # Device-specific implementations
├── converters/   # Data normalization layer (optional companion)
├── emulator/     # Software Modbus device emulator for testing
└── mqtt-config/  # Runtime configuration management
```

## Development Approach

**TDD (Test-Driven Development)** is required for AI agents:

- New features
- Bug fixes
- Device drivers

**Workflow**:

1. Write test first (should fail)
2. Write minimal code to pass
3. Refactor while keeping tests green
4. Commit with tests included

**REQUIRED**: Read `docs/TESTING.md` before writing tests for test organization rules and patterns.

## Package-Specific Guides

For detailed information about specific packages:

- **Core bridge logic**: `packages/core/AGENTS.md`
- **Device drivers**: `packages/devices/AGENTS.md`
- **CLI tools**: `packages/cli/AGENTS.md`
- **Converters**: `packages/converters/AGENTS.md`
