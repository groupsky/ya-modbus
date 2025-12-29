---
paths: packages/devices/**/*.ts
---

# Driver Development Guidelines

## Architecture

- Single factory function per package: `createDriver(config)`
- Functional approach: no classes, composable functions
- One package can export multiple device types
- Auto-detection when possible (read device registers)

## Data Points vs Registers

- External API: semantic names (`voltage_l1`, `total_energy`)
- Internal: raw registers (driver responsibility)
- Users NEVER see register addresses
- Use standard units: `V`, `A`, `W`, `kWh`
- Use standard types: `float`, `integer`, `boolean`, `timestamp`

## Naming Conventions

- Package: `ya-modbus-driver-<name>` (e.g., `ya-modbus-driver-solar`)
- Scoped: `@org/ya-modbus-driver-<name>`
- Data points: semantic, not `reg_0000` or `holding_6`
- Units: canonical from driver-sdk (`V` not `volts`)

## Development Workflow

1. Write test with emulator first (TDD)
2. Implement driver to pass test
3. Test with real device using CLI tools
4. Use characterization tools to discover device limits

### Required Exports

- `createDriver(config)` - Factory function

### Recommended Exports

- `DEFAULT_CONFIG` - Factory defaults (use `DefaultSerialConfig` or `DefaultTCPConfig`)
- `SUPPORTED_CONFIG` - Device constraints (use `SupportedSerialConfig` or `SupportedTCPConfig`)
- `DEVICES` - Device registry for multi-device drivers (use `DeviceRegistry`)

If exporting both DEFAULT_CONFIG and SUPPORTED_CONFIG, add cross-validation tests ensuring defaults are within supported ranges.

## Testing

- Emulator for fast iteration (`@ya-modbus/driver-dev-tools`)
- Real device testing via `npx ya-modbus` commands
- Test both explicit device type and auto-detection

## Package Structure

- `src/index.ts` - Export `createDriver` function
- `src/device.ts` - Driver implementation
- `src/device.test.ts` - Tests
- `package.json` - Must include `"ya-modbus-driver"` in keywords

See: `docs/DRIVER-DEVELOPMENT.md` for complete guide
See: `packages/devices/` for reference implementations
