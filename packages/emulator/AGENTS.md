# @ya-modbus/emulator

Software Modbus device emulator for testing drivers without physical hardware.

## Required Pre-Task Checklist

BEFORE making ANY changes to this package:

1. IDENTIFY your task type from the list below
2. READ the corresponding documentation file COMPLETELY
3. VERIFY you understand the requirements
4. BEGIN implementation

Reading task-specific documentation prevents implementation errors and ensures alignment with project patterns.

---

## Required Reading by Task

**BEFORE writing ANY test:**
→ READ ../../docs/agents/testing.md (TDD, behavior tests, mocking)

**BEFORE writing ANY production code:**
→ READ ../../docs/agents/code-quality.md (DRY, KISS, file limits)

**BEFORE making ANY changes (commits, branches, PRs):**
→ READ ../../docs/agents/git.md (Branching, commits, PRs)

**BEFORE fixing a bug:**
→ READ ../../docs/agents/bug-fixing.md (Root cause, regression tests)

**BEFORE refactoring code:**
→ READ ../../docs/agents/refactoring.md (Coverage, safe patterns)

**BEFORE updating dependencies:**
→ READ ../../docs/agents/dependencies.md (Semver, breaking changes)

**For architecture questions:**
→ READ ../../docs/ARCHITECTURE.md

---

## Package-Specific Guidelines

**Architecture**: Transport abstraction (BaseTransport), device management (EmulatedDevice), behavior composition (timing, function codes)

**Testing**: TDD required. Co-located tests (\*.test.ts). Integration tests for end-to-end scenarios.

**Implementation Plan**: See docs/emulator-implementation-plan.md for phased development approach

**Key Files**:

- src/emulator.ts - Main emulator class
- src/device.ts - Device with register storage
- src/transports/ - Transport implementations
- src/behaviors/ - Timing, function codes
