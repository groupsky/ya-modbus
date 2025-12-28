# @ya-modbus/cli

CLI tool for testing and developing Modbus device drivers.

## Requirements

- Node.js >= 18.0.0

## Features

- **Discover devices** automatically by scanning serial ports for Modbus RTU devices
- **Read data points** from Modbus devices (RTU/TCP)
- **Write data points** to Modbus devices with confirmation
- **Auto-detect drivers** from current package during development
- **Multiple output formats** (table, JSON)
- **Performance metrics** (response time, operation count)
- **Value verification** after writes

## Installation

### Global Installation (Production)

```bash
npm install -g @ya-modbus/cli
```

### Local Development

```bash
npm install --save-dev @ya-modbus/cli
```

## Usage

### Read Data Points

**Read single data point:**

```bash
# RTU (serial) - uses driver defaults for baud rate, parity, etc.
ya-modbus read \
  --driver ya-modbus-driver-xymd1 \
  --port /dev/ttyUSB0 \
  --data-point temperature

# TCP
ya-modbus read \
  --host 192.168.1.100 \
  --slave-id 1 \
  --data-point temperature
```

**Read multiple data points:**

```bash
# Uses driver defaults
ya-modbus read \
  --driver ya-modbus-driver-xymd1 \
  --port /dev/ttyUSB0 \
  --data-point temperature humidity
```

**Read all readable data points:**

```bash
# Uses driver defaults
ya-modbus read \
  --driver ya-modbus-driver-xymd1 \
  --port /dev/ttyUSB0 \
  --all
```

**JSON output:**

```bash
# Uses driver defaults
ya-modbus read \
  --driver ya-modbus-driver-xymd1 \
  --port /dev/ttyUSB0 \
  --data-point temperature \
  --format json
```

### Write Data Points

**Write with confirmation:**

```bash
# Uses driver defaults
ya-modbus write \
  --driver ya-modbus-driver-xymd1 \
  --port /dev/ttyUSB0 \
  --data-point setpoint \
  --value 25.5
```

**Write without confirmation:**

```bash
# Uses driver defaults
ya-modbus write \
  --driver ya-modbus-driver-xymd1 \
  --port /dev/ttyUSB0 \
  --data-point setpoint \
  --value 25.5 \
  --yes
```

**Write with verification:**

```bash
# Uses driver defaults
ya-modbus write \
  --driver ya-modbus-driver-xymd1 \
  --port /dev/ttyUSB0 \
  --data-point setpoint \
  --value 25.5 \
  --yes \
  --verify
```

### Discover Devices

**Automatic device discovery** scans a serial port to find Modbus RTU devices by testing different slave IDs and connection parameters.

**Quick discovery (uses driver configuration):**

```bash
# Discover using driver SUPPORTED_CONFIG to limit parameter combinations
ya-modbus discover \
  --port /dev/ttyUSB0 \
  --driver ya-modbus-driver-xymd1
```

**Discovery without driver (tests common parameters):**

```bash
# Tests standard baud rates (9600, 19200) and common parameters
ya-modbus discover --port /dev/ttyUSB0
```

**Thorough discovery (tests all parameters):**

```bash
# Tests all standard Modbus parameters (slower but comprehensive)
ya-modbus discover \
  --port /dev/ttyUSB0 \
  --strategy thorough
```

**Control number of devices to find:**

```bash
# Stop after finding one device (default behavior)
ya-modbus discover \
  --port /dev/ttyUSB0 \
  --driver ya-modbus-driver-xymd1 \
  --max-devices 1

# Find unlimited devices
ya-modbus discover \
  --port /dev/ttyUSB0 \
  --max-devices 0
```

**Silent mode (for scripts):**

```bash
# Suppress all progress messages, output only results
ya-modbus discover \
  --port /dev/ttyUSB0 \
  --silent \
  --format json

# Example: Extract slave IDs with jq
devices=$(ya-modbus discover -p /dev/ttyUSB0 --silent -f json | jq '.[].slaveId')
```

**Verbose progress:**

```bash
# Show each parameter combination being tested
ya-modbus discover \
  --port /dev/ttyUSB0 \
  --verbose
```

**Custom timing:**

```bash
# Adjust timeout and delay for specific bus conditions
ya-modbus discover \
  --port /dev/ttyUSB0 \
  --timeout 100 \
  --delay 50
```

**Discovery Options:**

- `--strategy <type>` - Discovery strategy: `quick` (default) or `thorough`
  - **Quick**: Tests SUPPORTED_CONFIG params or common Modbus parameters
  - **Thorough**: Tests all standard Modbus parameters (8 baud rates, 3 parity modes, 247 addresses)
- `--driver <package>` - Driver package to use for parameter prioritization
- `--local` - Load driver from local package (cwd)
- `--timeout <ms>` - Response timeout in milliseconds (default: 1000)
- `--delay <ms>` - Delay between attempts in milliseconds (default: 100)
- `--max-devices <count>` - Maximum number of devices to find (default: 1, use 0 for unlimited)
- `--verbose` - Show detailed progress with current parameters being tested
- `--silent` - Suppress all output except final result (useful for scripts)
- `--format <type>` - Output format: `table` (default) or `json`

**Output Example:**

```
Starting Modbus device discovery on /dev/ttyUSB0...
Strategy: quick
Timeout: 1000ms, Delay: 100ms

Using driver: ya-modbus-driver-xymd1
Using driver SUPPORTED_CONFIG to limit parameter combinations

Testing 1482 parameter combinations...

✓ Found device: Slave ID 52 @ 9600,N,8,1

Discovery complete! Found 1 device(s).

┌──────────┬───────────┬────────┬──────────┬──────────┬────────────┬──────────────┐
│ Slave ID │ Baud Rate │ Parity │ Data Bits│ Stop Bits│ Response   │ Supports     │
│          │           │        │          │          │ Time (ms)  │              │
├──────────┼───────────┼────────┼──────────┼──────────┼────────────┼──────────────┤
│ 52       │ 9600      │ none   │ 8        │ 1        │ 45.67      │ FC04         │
└──────────┴───────────┴────────┴──────────┴──────────┴────────────┴──────────────┘
```

**Discovery Time Estimates:**

Based on real-world testing with default settings (timeout=1000ms, delay=100ms):

- **Quick with driver**: ~25 minutes (1,482 combinations typical, ~1.0s per combination)
- **Quick without driver**: ~50 minutes (2,964 combinations, ~1.0s per combination)
- **Thorough**: ~6.5 hours (23,712 combinations, ~1.0s per combination)

**Performance Tips:**

- **Reduce timeout** for faster scans: `--timeout 500` achieves ~0.5s per combination (2x faster)
- Use `--driver` to prioritize likely parameters and reduce search space
- Use `--max-devices 1` (default) to stop after finding first device
- Further reduce `--timeout` if your devices respond quickly (e.g., `--timeout 100` for local devices)
- Increase `--delay` if you experience bus contention

### Connection Options

**RTU (Serial):**

- `--port <path>` - Serial port (e.g., `/dev/ttyUSB0`, `COM3`)
- `--baud-rate <rate>` - Baud rate (default: 9600)
- `--parity <type>` - Parity: none, even, odd (default: even)
- `--data-bits <bits>` - Data bits: 7 or 8 (default: 8)
- `--stop-bits <bits>` - Stop bits: 1 or 2 (default: 1)

**TCP:**

- `--host <host>` - TCP host (IP or hostname)
- `--tcp-port <port>` - TCP port (default: 502)

**Common:**

- `--slave-id <id>` - Modbus slave ID (1-247) **(required)**
- `--timeout <ms>` - Response timeout in milliseconds (default: 1000)
- `--driver <package>` - Explicit driver package name

### Driver Loading

**Auto-detect (development mode):**

When running from a driver package directory, the CLI auto-detects the driver:

```bash
cd packages/ya-modbus-driver-xymd1
npx ya-modbus read --port /dev/ttyUSB0 --slave-id 1 --data-point temperature
```

**Explicit driver (production mode):**

```bash
ya-modbus read \
  --driver ya-modbus-driver-xymd1 \
  --port /dev/ttyUSB0 \
  --slave-id 1 \
  --data-point temperature
```

### Driver Defaults and Validation

The CLI automatically uses configuration defaults from driver packages, reducing the number of required options.

**Driver-provided defaults:**

Drivers export `DEFAULT_CONFIG` and `SUPPORTED_CONFIG` constants that the CLI uses to:

- Apply sensible defaults for connection parameters (baud rate, parity, data bits, stop bits, slave ID)
- Validate user input against device-specific constraints
- Show helpful error messages with valid values and defaults

**Before (manual configuration):**

```bash
ya-modbus read \
  --driver ya-modbus-driver-xymd1 \
  --port /dev/ttyUSB0 \
  --baud-rate 9600 \
  --parity even \
  --data-bits 8 \
  --stop-bits 1 \
  --slave-id 1 \
  --data-point temperature
```

**After (using driver defaults):**

```bash
# CLI uses driver defaults - just specify port and data point
ya-modbus read \
  --driver ya-modbus-driver-xymd1 \
  --port /dev/ttyUSB0 \
  --data-point temperature
```

**Overriding defaults:**

User-specified values always take precedence over driver defaults:

```bash
# Use driver defaults but override baud rate and slave ID
ya-modbus read \
  --driver ya-modbus-driver-xymd1 \
  --port /dev/ttyUSB0 \
  --baud-rate 19200 \
  --slave-id 5 \
  --data-point temperature
```

**Validation:**

The CLI validates user input against driver constraints. Invalid values trigger helpful error messages:

```bash
$ ya-modbus read --driver ya-modbus-driver-xymd1 --port /dev/ttyUSB0 --baud-rate 115200
Error: Invalid baud rate 115200. This driver supports: 9600, 14400, 19200 (default: 9600)
```

**Backward compatibility:**

- Drivers without `DEFAULT_CONFIG` work as before (all parameters required)
- User-specified values always override defaults
- TCP connections ignore serial-specific defaults

### Working with Third-Party and Development Drivers

**⚠️ Important Safety Notes:**

The CLI supports loading drivers from:

- **First-party drivers** (official `ya-modbus-driver-*` packages)
- **Third-party drivers** (community/vendor packages)
- **Development drivers** (local packages under development)

When using third-party or development drivers, be aware:

1. **Runtime Validation**: The CLI validates driver exports at load time and provides helpful error messages:

   ```bash
   $ ya-modbus read --driver broken-driver --port /dev/ttyUSB0
   Error: Invalid DEFAULT_CONFIG: baudRate must be a number, got string.
   Fix: export const DEFAULT_CONFIG = { baudRate: 9600, ... } // number, not string
   ```

2. **Development Mode Hints**: When loading local drivers with `--local` or auto-detection, invalid configurations trigger detailed fix instructions to help driver developers.

3. **Configuration Safety**: Both `DEFAULT_CONFIG` and `SUPPORTED_CONFIG` are validated:
   - Type checking (baudRate must be number, not string)
   - Array validation (validBaudRates must be an array)
   - Range validation (validAddressRange must be [min, max])

4. **Merged Validation**: After applying defaults, the CLI validates that `DEFAULT_CONFIG` values comply with `SUPPORTED_CONFIG` constraints. This catches broken third-party driver defaults:
   ```bash
   Error: Invalid baud rate 38400. This driver supports: 9600, 14400, 19200 (default: 9600)
   ```

**Show Driver Defaults:**

Use the `show-defaults` command to inspect driver configuration before use:

```bash
# Show defaults from installed driver
ya-modbus show-defaults --driver ya-modbus-driver-xymd1

# Show defaults from local development driver
cd packages/my-driver
ya-modbus show-defaults --local

# JSON output for tooling
ya-modbus show-defaults --driver ya-modbus-driver-xymd1 --format json
```

Output:

```
Driver Defaults
===============

DEFAULT_CONFIG:
  baudRate: 9600
  parity: "even"
  dataBits: 8
  stopBits: 1
  defaultAddress: 1

SUPPORTED_CONFIG:
  validBaudRates: [9600,14400,19200]
  validParity: ["even","none"]
  validDataBits: [8]
  validStopBits: [1]
  validAddressRange: [1,247]
```

**Best Practices:**

1. **Test with `show-defaults`**: Before using a third-party driver, inspect its configuration
2. **Validate in development**: Run `ya-modbus show-defaults --local` when developing drivers
3. **Read error messages**: The CLI provides specific fix instructions for configuration errors
4. **Use first-party drivers**: Official drivers undergo rigorous validation

## Examples

### Read temperature from XY-MD1 sensor

```bash
# Auto-detect driver (from driver package directory) - uses driver defaults
cd packages/ya-modbus-driver-xymd1
npx ya-modbus read \
  --port /dev/ttyUSB0 \
  --data-point temperature humidity \
  --format table
```

Output:

```
Data Point       Value      Unit
────────────────────────────────
Temperature      24.5       °C
Humidity         65.2       %

Performance:
  Response time: 45ms
  Operations: 2
  Errors: 0
```

### Write and verify setpoint

```bash
# Uses driver defaults for baud rate, parity, etc.
ya-modbus write \
  --driver ya-modbus-driver-xymd1 \
  --port /dev/ttyUSB0 \
  --data-point device_address \
  --value 5 \
  --yes \
  --verify
```

### Test TCP connection

```bash
ya-modbus read \
  --host 192.168.1.100 \
  --tcp-port 502 \
  --slave-id 1 \
  --driver ya-modbus-driver-xymd1 \
  --all \
  --format json
```

## Development

### Running Tests

```bash
npm test
```

### Building

```bash
npm run build
```

### Watch Mode

```bash
npm run dev
```

## Troubleshooting

### Permission Denied (Linux)

Add your user to the `dialout` group:

```bash
sudo usermod -a -G dialout $USER
# Log out and log back in
```

### Driver Not Found

Ensure the driver package is installed:

```bash
npm install ya-modbus-driver-xymd1
```

Or use auto-detect mode from the driver package directory.

### Timeout Errors

- Check physical connection (RS-485 termination, wiring)
- Verify slave ID is correct
- Try slower baud rate (e.g., 4800)
- Increase timeout: `--timeout 2000`

## See Also

- [Driver Development Guide](../../docs/DRIVER-DEVELOPMENT.md)
- [Architecture Documentation](../../docs/ARCHITECTURE.md)
- [XYMD1 Driver](../ya-modbus-driver-xymd1/README.md)
