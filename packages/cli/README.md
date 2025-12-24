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
npm install -g @ya-modbus/cli ya-modbus-driver-xymd1
```

### Local Development

```bash
cd packages/ya-modbus-driver-xymd1
npm install
npm run build
```

## Usage

### Read Data Points

**Read single data point:**

```bash
# RTU (serial)
ya-modbus read \
  --port /dev/ttyUSB0 \
  --slave-id 1 \
  --data-point temperature

# TCP
ya-modbus read \
  --host 192.168.1.100 \
  --slave-id 1 \
  --data-point temperature
```

**Read multiple data points:**

```bash
ya-modbus read \
  --port /dev/ttyUSB0 \
  --slave-id 1 \
  --data-point temperature humidity
```

**Read all readable data points:**

```bash
ya-modbus read \
  --port /dev/ttyUSB0 \
  --slave-id 1 \
  --all
```

**JSON output:**

```bash
ya-modbus read \
  --port /dev/ttyUSB0 \
  --slave-id 1 \
  --data-point temperature \
  --format json
```

### Write Data Points

**Write with confirmation:**

```bash
ya-modbus write \
  --port /dev/ttyUSB0 \
  --slave-id 1 \
  --data-point setpoint \
  --value 25.5
```

**Write without confirmation:**

```bash
ya-modbus write \
  --port /dev/ttyUSB0 \
  --slave-id 1 \
  --data-point setpoint \
  --value 25.5 \
  --yes
```

**Write with verification:**

```bash
ya-modbus write \
  --port /dev/ttyUSB0 \
  --slave-id 1 \
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

## Examples

### Read temperature from XY-MD1 sensor

```bash
# Auto-detect driver (from driver package directory)
cd packages/ya-modbus-driver-xymd1
npx ya-modbus read \
  --port /dev/ttyUSB0 \
  --slave-id 1 \
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
ya-modbus write \
  --port /dev/ttyUSB0 \
  --slave-id 1 \
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
