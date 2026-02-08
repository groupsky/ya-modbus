# Discover Command

The `discover` command automatically scans for Modbus RTU devices on a serial port by testing different slave IDs and communication parameters. This is useful when you receive a new device with unknown configuration or when you've forgotten the device settings.

## Table of Contents

- [Quick Start](#quick-start)
- [Command Options](#command-options)
- [Discovery Strategies](#discovery-strategies)
- [Using with Drivers](#using-with-drivers)
- [Output Formats](#output-formats)
- [Performance Considerations](#performance-considerations)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

## Quick Start

Basic discovery on a serial port:

```bash
ya-modbus discover --port /dev/ttyUSB0
```

This will:

- Test common Modbus parameters (quick strategy)
- Show progress with ETA
- Display discovered devices in a table

## Command Options

### Required Options

- `--port <path>` - Serial port path (e.g., `/dev/ttyUSB0`, `COM3`)

### Discovery Options

- `--driver <package>` - Driver package name (uses SUPPORTED_CONFIG to optimize scan)
  - Example: `--driver @ya-modbus/driver-xymd1`
  - Limits parameter combinations to those supported by the device
  - Prioritizes DEFAULT_CONFIG values

- `--strategy <type>` - Discovery strategy (default: `quick`)
  - `quick`: Tests only common parameters (5-10 minutes)
  - `thorough`: Tests all Modbus parameters (30-60 minutes)

- `--timeout <ms>` - Response timeout in milliseconds (default: `1000`)
  - Lower values scan faster but may miss slow devices
  - Higher values accommodate slow-responding devices
  - Recommended: 1000ms for most devices

- `--delay <ms>` - Delay between attempts in milliseconds (default: `100`)
  - Prevents bus contention on RS-485
  - Lower values scan faster but may cause errors
  - Recommended: 100ms minimum

- `--id <spec>` - Limit search to specific slave IDs (can be specified multiple times)
  - Format: Single IDs or ranges separated by commas (e.g., `1,2,3-5`)
  - Multiple `--id` flags are merged and deduplicated
  - Dramatically reduces scan time when you know which IDs to search
  - Examples:
    - `--id 1` - Search only slave ID 1
    - `--id 1,2,3` - Search IDs 1, 2, and 3
    - `--id 1-5` - Search IDs 1 through 5
    - `--id 1,3-5,10` - Search IDs 1, 3, 4, 5, and 10
    - `--id 1-3 --id 5-7` - Search IDs 1, 2, 3, 5, 6, and 7

- `--parity <spec>` - Limit search to specific parity modes (can be specified multiple times)
  - Format: Comma-separated parity values (e.g., `none,even,odd`)
  - Valid values: `none`, `even`, `odd`
  - Multiple `--parity` flags are merged and deduplicated
  - Reduces scan time when you know the device's parity setting
  - Examples:
    - `--parity none` - Test only no parity
    - `--parity none,even` - Test no parity and even parity
    - `--parity none --parity even` - Same as above (flags are merged)
    - `--parity "none,even,odd"` - Test all parity modes (quotes optional)

- `--baud-rate <spec>` - Limit search to specific baud rates (can be specified multiple times)
  - Format: Single rates, comma-separated rates, or ranges (e.g., `9600`, `9600,19200`, or `9600-38400`)
  - Supported rates: `2400`, `4800`, `9600`, `14400`, `19200`, `38400`, `57600`, `115200`
  - Multiple `--baud-rate` flags are merged and deduplicated
  - Range syntax expands to standard baud rates between min and max
  - Significantly reduces scan time when you know the device's baud rate
  - Examples:
    - `--baud-rate 9600` - Test only 9600 baud
    - `--baud-rate 9600,19200` - Test 9600 and 19200 baud
    - `--baud-rate 9600-19200` - Test 9600, 14400, and 19200 baud (expands to standard rates)
    - `--baud-rate 9600 --baud-rate 19200` - Same as `--baud-rate 9600,19200`
    - `--baud-rate "2400-9600,57600"` - Test low and high baud rates

- `--max-devices <count>` - Maximum devices to find (default: `1`, use `0` for unlimited)
  - Stops scanning after finding specified number of devices
  - Use `0` to find all devices on the bus
  - Speeds up discovery when you only need to find one device

### Output Options

- `--format <type>` - Output format (default: `table`)
  - `table`: Human-readable table format
  - `json`: Machine-readable JSON format

## Discovery Strategies

### Quick Strategy (Default)

**Use when:**

- You know the device type (use with `--driver`)
- You want fast results
- The device uses common parameters

**Parameters tested:**

- Slave IDs: 1-247 (all addresses)
- Baud rates: 9600, 19200 (most common)
- Parity: None, Even
- Data bits: 7, 8
- Stop bits: 1, 2

**Time estimate:** 5-10 minutes for full scan

**With driver:** Even faster - only tests SUPPORTED_CONFIG parameters

### Thorough Strategy

**Use when:**

- Quick strategy didn't find your device
- Device may use uncommon parameters
- You have time for a comprehensive scan

**Parameters tested:**

- Slave IDs: 1-247 (all addresses)
- Baud rates: 2400, 4800, 9600, 14400, 19200, 38400, 57600, 115200
- Parity: None, Even, Odd
- Data bits: 7, 8
- Stop bits: 1, 2

**Time estimate:** 30-60 minutes for full scan

## Using with Drivers

Specifying a driver package significantly improves discovery speed and accuracy:

```bash
ya-modbus discover --port /dev/ttyUSB0 --driver @ya-modbus/driver-xymd1
```

**Benefits:**

1. **Faster scans** - Only tests parameters from SUPPORTED_CONFIG
2. **Prioritized defaults** - Tests DEFAULT_CONFIG first
3. **Guaranteed compatibility** - Only tests parameters the device supports

**Example with XYMD1 driver:**

Without driver:

- Tests 2,964 combinations (9600, 19200 × 247 addresses × other params)
- Time: ~8 minutes

With driver:

- Tests 1,482 combinations (only supported params)
- Tries DEFAULT_CONFIG first (finds device in <10 seconds if using defaults)
- Time: ~4 minutes worst case

## Output Formats

### Table Format (Default)

```
Discovery complete! Found 2 device(s).

┌──────────┬───────────┬────────┬───────────┬──────────┬────────────┬───────────────────────┐
│ Slave ID │ Baud Rate │ Parity │ Data/Stop │ Response │ Vendor     │ Model                 │
├──────────┼───────────┼────────┼───────────┼──────────┼────────────┼───────────────────────┤
│ 1        │ 9600      │ E      │ 8E1       │ 12.3ms   │ XY-MD1     │ Temperature Sensor    │
│ 3        │ 14400     │ N      │ 8N1       │ 18.7ms   │ -          │ -                     │
└──────────┴───────────┴────────┴───────────┴──────────┴────────────┴───────────────────────┘
```

### JSON Format

```bash
ya-modbus discover --port /dev/ttyUSB0 --format json
```

Output:

```json
[
  {
    "slaveId": 1,
    "baudRate": 9600,
    "parity": "even",
    "dataBits": 8,
    "stopBits": 1,
    "responseTimeMs": 12.3,
    "identification": {
      "vendorName": "XY-MD1",
      "productCode": "AC-100",
      "modelName": "Temperature Sensor",
      "revision": "v1.2.3",
      "supportsFC03": true,
      "supportsFC43": true
    }
  }
]
```

**Use JSON format for:**

- Automation scripts
- Integration with other tools
- Programmatic processing
- Configuration file generation

## Performance Considerations

### Scan Time Estimation

Discovery time depends on several factors:

**Formula:** `Time ≈ (combinations × timeout) / 1000` seconds

**Examples:**

| Strategy | Driver | ID Filter | Combinations | Timeout | Est. Time  |
| -------- | ------ | --------- | ------------ | ------- | ---------- |
| Quick    | No     | None      | ~2,964       | 1000ms  | ~50 min    |
| Quick    | No     | 1-5       | ~60          | 1000ms  | ~1 min     |
| Quick    | Yes    | None      | ~1,482       | 1000ms  | ~25 min    |
| Quick    | Yes    | 1-5       | ~30          | 1000ms  | ~30 sec    |
| Thorough | No     | None      | ~23,712      | 1000ms  | ~6.5 hours |
| Thorough | Yes    | None      | ~1,482       | 1000ms  | ~25 min    |

**Note:** Actual time is usually much faster because:

- Device responses are typically <100ms (not full timeout)
- Devices are often found early in the scan (defaults tested first)

### Optimization Tips

1. **Filter slave IDs** - Use `--id` if you know which IDs to search (reduces combinations by up to 98%)
2. **Use a driver** - Reduces combinations by 50-90%
3. **Lower timeout** - Use 250-500ms if devices respond quickly
4. **Start with quick strategy** - Finds 90% of devices
5. **Stop after first device** - Default `--max-devices 1` stops after finding one device

### Progress Monitoring

During discovery, you'll see real-time progress:

```
Testing 1482 parameter combinations...

✓ Found device: Slave ID 1 @ 9600,E,8,1

Progress: 35% (520/1482) | Devices found: 1 | Elapsed: 2m 15s | ETA: 4m 10s
```

**Progress indicators:**

- Percentage complete
- Current/total combinations tested
- Devices found so far
- Elapsed time
- Estimated time remaining (ETA)

## Troubleshooting

### No Devices Found

**Possible causes:**

1. **Wrong serial port**

   ```bash
   # List available ports (Linux)
   ls /dev/tty*

   # List available ports (macOS)
   ls /dev/cu.*

   # Windows: Check Device Manager for COM ports
   ```

2. **Permission denied** (Linux/macOS)

   ```bash
   # Add user to dialout group
   sudo usermod -a -G dialout $USER
   # Log out and back in

   # Or run with sudo (not recommended)
   sudo ya-modbus discover --port /dev/ttyUSB0
   ```

3. **Device uses uncommon parameters**
   - Try `--strategy thorough`
   - Increase `--timeout 2000` for slow devices

4. **Hardware issues**
   - Check RS-485 wiring (A to A, B to B)
   - Verify 120Ω termination resistors at bus ends
   - Check for proper biasing (if required)
   - Test with known-working device first

### Scan Takes Too Long

**Solutions:**

1. **Use a driver package**

   ```bash
   ya-modbus discover --port /dev/ttyUSB0 --driver @ya-modbus/driver-xymd1
   ```

2. **Reduce timeout**

   ```bash
   ya-modbus discover --port /dev/ttyUSB0 --timeout 250
   ```

   **Warning:** May miss slow-responding devices

3. **Reduce delay** (risky)
   ```bash
   ya-modbus discover --port /dev/ttyUSB0 --delay 50
   ```
   **Warning:** May cause bus contention errors

### Found Wrong Device or Duplicate Entries

**Causes:**

- **Noise on RS-485 bus** - Check wiring and termination
- **Multiple devices responding** - Normal if multiple devices present
- **False positives** - Rare, usually indicates noise

**Solutions:**

- Ensure proper cable shielding
- Check termination resistors
- Disconnect other devices to isolate the target

### Device Found but Can't Read Data Points

**Causes:**

- Discovery uses basic function codes (FC03, FC43)
- Your driver may use different register ranges
- Device may have restricted register access

**Solutions:**

1. **Verify with read command**

   ```bash
   ya-modbus read --port /dev/ttyUSB0 --slave-id 1 --baud-rate 9600 \
     --parity even --driver @ya-modbus/driver-xymd1 --all
   ```

2. **Check driver compatibility**
   - Device may not match the driver you're using
   - Try reading individual data points

3. **Check device documentation**
   - Some devices require special initialization
   - Some registers may be protected or read-only

## Examples

### Example 1: Basic Discovery

Discover devices on `/dev/ttyUSB0` using default settings:

```bash
ya-modbus discover --port /dev/ttyUSB0
```

### Example 2: With Known Driver

Optimize discovery for XYMD1 temperature/humidity sensor:

```bash
ya-modbus discover --port /dev/ttyUSB0 --driver @ya-modbus/driver-xymd1
```

### Example 3: Fast Scan with Lower Timeout

Quick scan for fast-responding devices:

```bash
ya-modbus discover --port /dev/ttyUSB0 --timeout 500 --delay 50
```

### Example 4: Thorough Scan

Comprehensive scan when quick strategy fails:

```bash
ya-modbus discover --port /dev/ttyUSB0 --strategy thorough --timeout 2000
```

### Example 5: JSON Output for Automation

Generate JSON output for processing:

```bash
ya-modbus discover --port /dev/ttyUSB0 --driver @ya-modbus/driver-xymd1 \
  --format json > discovered-devices.json
```

### Example 6: Multiple Serial Ports

Scan multiple ports (use shell scripting):

```bash
for port in /dev/ttyUSB0 /dev/ttyUSB1 /dev/ttyUSB2; do
  echo "Scanning $port..."
  ya-modbus discover --port $port --timeout 500 || true
done
```

### Example 7: Windows COM Port

Discover on Windows COM port:

```bash
ya-modbus discover --port COM3
```

### Example 8: Search Specific Slave IDs

Search only specific slave IDs to dramatically reduce scan time:

```bash
# Search only ID 1
ya-modbus discover --port /dev/ttyUSB0 --id 1

# Search IDs 1-5
ya-modbus discover --port /dev/ttyUSB0 --id 1-5

# Search specific IDs: 1, 2, 3, 10, 11, 12
ya-modbus discover --port /dev/ttyUSB0 --id 1-3,10-12

# Search IDs from multiple specifications (merged and deduplicated)
ya-modbus discover --port /dev/ttyUSB0 --id 1,2 --id 3-5
```

**Performance benefit:** Searching only 5 IDs instead of all 247 reduces combinations by ~98%, completing in seconds instead of minutes.

### Example 9: Filter by Parity and Baud Rate

When you know the device configuration, combine filters for maximum speed:

```bash
# Search only even parity devices at 9600 baud
ya-modbus discover --port /dev/ttyUSB0 --parity even --baud-rate 9600

# Test multiple parities at a specific baud rate
ya-modbus discover --port /dev/ttyUSB0 --parity none,even --baud-rate 9600

# Test a range of baud rates with specific parity
ya-modbus discover --port /dev/ttyUSB0 --baud-rate 9600-38400 --parity none

# Combine all three filters for fastest possible scan
ya-modbus discover \
  --port /dev/ttyUSB0 \
  --id 1-5 \
  --parity none \
  --baud-rate 9600

# Search multiple configurations
ya-modbus discover \
  --port /dev/ttyUSB0 \
  --id 1,2,3 \
  --parity none --parity even \
  --baud-rate 9600,19200
```

**Performance benefit:** With all three filters, scan time can be reduced from ~25 minutes (testing all combinations) to ~30 seconds (testing only specified combinations). Example: `--id 1-5 --parity none --baud-rate 9600` tests only 5 combinations instead of 1,482.

## Advanced Usage

### Combining with Other Commands

After discovery, use results with read/write commands:

```bash
# 1. Discover device
ya-modbus discover --port /dev/ttyUSB0 --driver @ya-modbus/driver-xymd1

# Output shows: Slave ID 1 @ 9600,E,8,1

# 2. Read data from discovered device
ya-modbus read --port /dev/ttyUSB0 --slave-id 1 --baud-rate 9600 \
  --parity even --data-bits 8 --stop-bits 1 \
  --driver @ya-modbus/driver-xymd1 --all
```

### Integration with Configuration Management

Generate configuration files from discovery results:

```bash
# Discover and save to JSON
ya-modbus discover --port /dev/ttyUSB0 --format json > devices.json

# Process JSON with jq (example)
jq '.[] | {id: .slaveId, baud: .baudRate, parity: .parity}' devices.json
```

## Technical Details

### Detection Methods

The discover command uses multiple Modbus function codes:

1. **FC43/14 - Read Device Identification** (tries first)
   - MEI (Modbus Encapsulated Interface)
   - Returns vendor name, product code, model, revision
   - Not supported by all devices

2. **FC03 - Read Holding Registers** (fallback)
   - Universal fallback
   - Reads register 0, count 1
   - Supported by nearly all Modbus devices

### Response Classification

The command distinguishes between:

- **Device present** - Received response or exception code
- **Device absent** - Timeout (no response)
- **Wrong parameters** - CRC error (indicates serial params mismatch)

**Exception codes indicate device presence** - Even if the function code isn't supported, receiving an exception means a device is there.

## See Also

- [`read` command](../README.md#read-command) - Read data points after discovery
- [`write` command](../README.md#write-command) - Write data points after discovery
- [`show-defaults` command](../README.md#show-defaults-command) - View driver defaults
- [Driver Development Guide](../../../docs/DRIVER-DEVELOPMENT.md) - Creating custom drivers
