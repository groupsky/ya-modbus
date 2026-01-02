# @ya-modbus/driver-loader

Dynamic driver loader for ya-modbus device drivers.

## Required Reading by Task

BEFORE making ANY changes:
→ READ ../../docs/agents/git.md
→ READ ../../docs/agents/code-quality.md
→ READ ../../docs/agents/testing.md

BEFORE modifying loader logic:
→ READ src/loader.ts (caching, module resolution)
→ READ src/config-validator.ts (validation rules)

BEFORE modifying testing utilities:
→ READ src/testing.ts (mock driver and system dependencies)

## Package Purpose

This package provides runtime driver loading and validation functionality for ya-modbus drivers. It supports:

- Auto-detection of drivers from package.json
- Explicit driver package loading
- Runtime validation of driver exports
- Configuration validation (DEFAULT_CONFIG, SUPPORTED_CONFIG, DEVICES)
- Cross-validation of configuration constraints
- Driver caching for improved performance
- Testing utilities for applications

## Key Modules

- **loader.ts**: Core driver loading functionality with caching
- **config-validator.ts**: Validation of driver configuration exports
- **testing.ts**: Test utilities for applications using driver-loader

## Usage

See: README.md for usage examples and API documentation

## Testing Requirements

- Follow TDD approach (test first, then implement)
- Mock filesystem and module imports using SystemDependencies
- Test both success and error paths
- 95% coverage threshold required
- Use dependency injection pattern for testability

## References

- README.md - User documentation and API examples
- ../../docs/agents/testing.md - Testing guidelines
- ../../docs/agents/code-quality.md - Code quality guidelines
- src/loader.ts - Core loading logic with caching
- src/config-validator.ts - Validation implementation
- src/testing.ts - Testing utilities
