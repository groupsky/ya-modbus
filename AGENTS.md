# ya-modbus-mqtt-bridge - Agent Guide

## Quick Navigation

Working on specific components? See specialized guides:
- **Core bridge logic**: `packages/core/AGENTS.md` (when created)
- **Device drivers**: `packages/devices/AGENTS.md` (when created)
- **CLI tools**: `packages/cli/AGENTS.md` (when created)
- **Converters**: `packages/converters/AGENTS.md` (when created)

## Project Type

TypeScript monorepo using npm workspaces. All packages share common tooling and configuration.

## Essential Commands

```bash
# Setup
npm install                    # Install all dependencies
npm run build                  # Build all packages

# Development
npm run dev                    # Watch mode (all packages)
npm run test                   # Run all tests with coverage
npm run lint                   # Lint all packages

# Package-specific
npm test --workspace=packages/core
npm run build --workspace=packages/devices
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

## Key Architectural Decisions

When implementing features, consult `ARCHITECTURE.md` for:
- **Modbus RTU vs TCP**: Different mutex strategies
- **Polling types**: Dynamic vs static vs on-demand
- **Register batching**: When to optimize multi-register reads
- **Error handling**: Which errors to publish vs retry vs log

## Directory Structure

```
packages/
├── core/         # Bridge orchestration, transport, polling, discovery
├── cli/          # Command-line tool (test, provision, monitor)
├── devices/      # Device-specific implementations
│   ├── energy-meters/
│   ├── solar/
│   └── hvac/
├── converters/   # Data normalization layer (optional companion)
├── emulator/     # Software Modbus device emulator for testing
└── mqtt-config/  # Runtime configuration management
```

## Common Clarifications

### When to use RTU vs TCP transport?
- **RTU**: Serial devices (RS-485, RS-232) - requires mutex
- **TCP**: Network devices - no global mutex needed
- **RTU-over-TCP**: Network bridges to serial devices - requires mutex

### When to add a new device driver?
- Device has unique register layout
- Device requires special handling (delays, custom reads)
- Generic device template insufficient

### When to use the emulator?
- **Required**: Writing tests for device drivers
- **Optional**: Integration testing, local development without hardware

### When to create a converter?
- Normalizing data for specific platforms (InfluxDB, Prometheus)
- Transforming device-specific units/formats
- Multiple devices share common schema

## File Organization Conventions

- Tests: `__tests__/` directory alongside source
- Config schemas: Use Zod for validation
- Device metadata: Export as const objects
- MQTT topics: Define in `mqtt-config` package

## External References

Only when needed - avoid duplicating documentation:
- Modbus spec: https://modbus.org/docs/Modbus_Application_Protocol_V1_1b3.pdf
- MQTT spec: https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/mqtt-v3.1.1.html
- Semantic versioning: https://semver.org/

## Next Steps

1. Read `ARCHITECTURE.md` for system design
2. Read `CONTRIBUTING.md` for development workflow
3. Navigate to relevant `packages/*/AGENTS.md` for specific work
