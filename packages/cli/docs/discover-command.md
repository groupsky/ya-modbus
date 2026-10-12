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
  - `quick`: Tests common parameters, or the driver's supported parameters (~25 minutes without a driver, with default settings)
  - `thorough`: Tests all standard Modbus parameters (~6.6 hours without a driver, with default settings)

- `--timeout <ms>` - Response timeout in milliseconds (default: `1000`)
  - Lower values scan faster but may miss slow devices
  - Higher values accommodate slow-responding devices
  - Recommended: 1000ms for most devices

- `--delay <ms>` - Delay between attempts in milliseconds (default: `100`)
  - Prevents bus contention on RS-485
  - After an attempt that does not find a device, the scanner waits `delay - timeout` ms, and only when `--delay` is larger than `--timeout`. The timeout already used that time.
  - So a `--delay` at or below `--timeout` adds no wait after such attempts. A larger `--delay` makes each attempt that times out take about `--delay` ms.
  - After a device is found, the scanner waits the full `--delay`, unless `--max-devices` is reached and the scan stops

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
- Parity: None, Even, Odd
- Data bits: 8
- Stop bits: 1

**Combinations:** 247 × 2 × 3 × 1 × 1 = 1,482

**Time estimate:** ~25 minutes for a full scan (1,482 × 1 second timeout)

**With driver:** Tests only the SUPPORTED_CONFIG parameters, starting with DEFAULT_CONFIG. The scan is shorter than the default quick scan only when the driver supports fewer parameter combinations.

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

**Combinations:** 247 × 8 × 3 × 2 × 2 = 23,712

**Time estimate:** ~6.6 hours for a full scan (23,712 × 1 second timeout)

**With driver:** Tests only the SUPPORTED_CONFIG parameters (see [Using with Drivers](#using-with-drivers))

## Using with Drivers

Specifying a driver package limits the scan to the parameters the device supports and tests its factory defaults first:

```bash
ya-modbus discover --port /dev/ttyUSB0 --driver @ya-modbus/driver-xymd1
```

**Benefits:**

1. **Smaller scans** - Only tests parameters from SUPPORTED_CONFIG (with `--strategy thorough`, the XYMD1 driver reduces 23,712 combinations to 1,482)
2. **Prioritized defaults** - Tests DEFAULT_CONFIG first
3. **Guaranteed compatibility** - Only tests parameters the device supports

**Example with XYMD1 driver:**

XYMD1 supports baud rates 9600, 14400, 19200, parity even and none, 8 data bits and 1 stop bit.

Without driver (quick strategy):

- Tests 1,482 combinations (2 baud rates × 3 parities × 247 addresses)
- Time: ~25 minutes worst case

With driver (quick strategy):

- Tests 1,482 combinations (3 baud rates × 2 parities × 247 addresses)
- Tries DEFAULT_CONFIG first (finds device in <10 seconds if using defaults)
- Time: ~25 minutes worst case

Without driver (thorough strategy):

- Tests 23,712 combinations (8 baud rates × 3 parities × 2 data bits × 2 stop bits × 247 addresses)
- Time: ~6.6 hours worst case

With driver (thorough strategy):

- Tests 1,482 combinations (only supported params)
- Time: ~25 minutes worst case

## Output Formats

### Table Format (Default)

```
Discovery complete! Found 2 device(s).

┌──────────┬───────────┬────────┬───────────┬──────────┬────────────┬───────────────────────┐
│ Slave ID │ Baud Rate │ Parity │ Data/Stop │ Response │ Vendor     │ Model                 │
├──────────┼───────────┼────────┼───────────┼──────────┼────────────┼───────────────────────┤
│ 1        │ 9600      │ E      │ 8E1       │ 12ms     │ XY-MD1     │ AC-100                │
│ 3        │ 14400     │ N      │ 8N1       │ 19ms     │ -          │ -                     │
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
      "revision": "v1.2.3",
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

**Formula:** `Time ≈ (combinations × timeout) / 1000` seconds (use `--delay` instead of `--timeout` when `--delay` is larger)

**Combinations:** `slave IDs × baud rates × parities × data bits × stop bits`

**Examples** (driver rows use the XYMD1 driver):

| Strategy | Driver | ID Filter | Combinations | Timeout | Est. Time  |
| -------- | ------ | --------- | ------------ | ------- | ---------- |
| Quick    | No     | None      | 1,482        | 1000ms  | ~25 min    |
| Quick    | No     | 1-5       | 30           | 1000ms  | ~30 sec    |
| Quick    | Yes    | None      | 1,482        | 1000ms  | ~25 min    |
| Quick    | Yes    | 1-5       | 30           | 1000ms  | ~30 sec    |
| Thorough | No     | None      | 23,712       | 1000ms  | ~6.6 hours |
| Thorough | Yes    | None      | 1,482        | 1000ms  | ~25 min    |

**Note:** Actual time is usually much faster because:

- Device responses are typically <100ms (not full timeout)
- Devices are often found early in the scan (defaults tested first)

### Optimization Tips

1. **Filter slave IDs** - Use `--id` if you know which IDs to search (5 IDs instead of 247 reduces combinations by 98%)
2. **Use a driver** - Limits the scan to the driver's SUPPORTED_CONFIG (with `--strategy thorough`, the XYMD1 driver reduces combinations by 94%)
3. **Lower timeout** - Use 250-500ms if devices respond quickly
4. **Start with quick strategy** - Without a driver or filters, it tests 1,482 combinations and the thorough strategy tests 23,712
5. **Stop after first device** - Default `--max-devices 1` stops after finding one device

### Progress Monitoring

During discovery, you'll see real-time progress:

```
Testing 1482 parameter combinations...

✓ Found device: Slave ID 1 @ 9600,E,8,1

Progress: 35% (520/1482) | Devices found: 1 | Elapsed: 8m 40s | ETA: 16m 2s
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

3. **Keep `--delay` at or below `--timeout`**

   A larger `--delay` makes each attempt that times out take about `--delay` ms instead of `--timeout` ms. See [Command Options](#command-options).

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

- Discovery only sends FC43 (Read Device Identification). It does not read any registers, so a found device may still lack the registers your driver reads
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
ya-modbus discover --port /dev/ttyUSB0 --timeout 500
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

**Performance benefit:** With all three filters, scan time can be reduced from ~25 minutes (testing all combinations) to ~5 seconds (testing only specified combinations). Example: `--id 1-5 --parity none --baud-rate 9600` tests only 5 combinations instead of 1,482.

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

The discover command sends one Modbus function code to each parameter combination:

**FC43/14 - Read Device Identification**

- MEI (Modbus Encapsulated Interface)
- Reads vendor name, product code, revision
- Not supported by all devices. A device that answers with an exception is still reported as present.
- A device that does not answer at all (timeout) is reported as not found, even if it supports other function codes such as FC03

### Response Classification

The command distinguishes between:

- **Device present** - Received response or exception code
- **Device absent** - Timeout (no response)
- **Wrong parameters** - CRC error (indicates serial params mismatch)

**Exception codes indicate device presence** - Even if the function code isn't supported, receiving an exception means a device is there.

## See Also

- [`read` command](../README.md#read-data-points) - Read data points after discovery
- [`write` command](../README.md#write-data-points) - Write data points after discovery
- [`show-defaults` command](../README.md#working-with-third-party-and-development-drivers) - View driver defaults
- [Driver Development Guide](../../../docs/DRIVER-DEVELOPMENT.md) - Creating custom drivers
