# Discovery Command

Auto-detection of Modbus RTU devices on serial ports.

## Usage

```bash
ya-modbus discover --port <path> [options]
```

## Architecture

```
src/
├── discovery/
│   ├── parameter-generator.ts  # Generate serial parameter combinations
│   ├── device-identifier.ts    # Try FC43 to identify devices
│   ├── scanner.ts              # Core scanning loop
│   ├── progress.ts             # Progress tracking with ETA
│   └── (tests for all above)
├── commands/
│   └── discover.ts             # Command implementation
└── formatters/
    └── discovery-results.ts    # Table/JSON output formatting
```

## Key Design Patterns

### Parameter Generator

- Generator function yields combinations in priority order
- Supports quick (common params) and thorough (all params) strategies
- Prioritizes DEFAULT_CONFIG from driver packages
- Respects SUPPORTED_CONFIG to limit scan space

### Device Identifier

- Uses FC43 (Read Device Identification) to probe for device presence and gather vendor/model info
- Distinguishes timeout (no device) vs exception (device present but unsupported function) vs CRC error (wrong serial params)
- Measures response time for each device

### Scanner

- Creates new ModbusRTU client for each parameter combination
- Configurable delay between attempts (default 100ms) to prevent bus contention
- Progress callbacks for real-time status updates
- Error handling: connection errors don't stop the scan

### Progress Tracking

- Calculates completion percentage and ETA
- Throttled updates (max 1/second) to avoid console spam
- Human-readable duration formatting

## Discovery Strategies

- **Quick** (default): Tests SUPPORTED_CONFIG params or common Modbus params (9600, 19200 baud, N/E parity)
- **Thorough**: Tests all standard Modbus parameters (8 baud rates, 3 parity, 2 data/stop bits, 247 addresses)

## Time Estimates

With default timeout=1000ms, delay=100ms:

- Quick with driver: ~25 minutes (1,482 combinations typical, ~1.0s per combination)
- Quick without driver: ~50 minutes (2,964 combinations, ~1.0s per combination)
- Thorough: ~6.5 hours (23,712 combinations, ~1.0s per combination)

**Note**: Reduce timeout (e.g., `--timeout 500`) for faster scans at ~0.5s per combination (2x speedup)

## Testing

- `parameter-generator.test.ts`: Verifies combination generation, prioritization, DEFAULT_CONFIG handling
- `device-identifier.test.ts`: Mocks ModbusRTU client, tests FC43 device identification, error classification

## Future Enhancements

- Checkpoint/resume for long scans
- `scan-registers` - Find readable/writable register ranges
- `test-limits` - Determine max batch size, timing requirements
