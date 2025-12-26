# @ya-modbus/cli

CLI tool for testing and developing Modbus device drivers.

## Requirements

- Node.js >= 18.0.0

## Features

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
