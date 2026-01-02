# @ya-modbus/emulator

Software Modbus device emulator for testing drivers without physical hardware.

See: ../../CLAUDE.md for project-wide guidelines (git, testing, code quality, bug fixing, refactoring, dependencies)

## Package-Specific Guidelines

**Architecture**: Transport abstraction (BaseTransport), device management (EmulatedDevice), behavior composition (timing, function codes)

**Testing**: TDD required. Co-located tests (\*.test.ts). Integration tests for end-to-end scenarios.

**Implementation Plan**: See docs/emulator-implementation-plan.md for phased development approach

**Key Files**:

- src/emulator.ts - Main emulator class
- src/device.ts - Device with register storage
- src/transports/ - Transport implementations
- src/behaviors/ - Timing, function codes
