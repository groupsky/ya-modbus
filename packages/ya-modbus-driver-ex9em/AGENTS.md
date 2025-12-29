# ya-modbus-driver-ex9em

Read root AGENTS.md for project-wide conventions.

## Package-Specific Guidelines

### Device Characteristics

- Single-phase energy meter
- All data points read-only
- Single register block (0x0000-0x000A)
- Batch reading in single transaction

### Register Layout

All measurements in holding registers 0x0000-0x000A:

- Registers 0x0000-0x0006: Single 16-bit values
- Registers 0x0007-0x000A: Two 32-bit values (energy counters)

**Note:** Registers 0x0002 (frequency) and 0x0006 (power_factor) are not documented in the official PDF but are present in working device implementation.

### Documentation

- Official register map: `docs/ex9em-1p-1m-80a-mo-mt-register-map.pdf`
- Implementation based on verified working code
- PDF shows different layout with tariff-specific energy registers

### Scaling Factors

- Voltage, current, frequency: ×10
- Power factor: ×1000
- Energy values: ×100 (32-bit)

### Testing Notes

- Mock complete 22-byte buffer for all tests
- Verify 32-bit energy counter encoding
- Test zero values and boundary cases
