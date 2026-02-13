# @ya-modbus/device-profiler

Device profiler for discovering Modbus register maps through automated scanning.

## Features

- Scans holding registers (FC03) and input registers (FC04)
- Batch reading with automatic fallback on errors
- Real-time progress display
- Timing measurement for each read operation
- Error classification (timeout, CRC, Modbus exceptions)
- Summary table of discovered registers
- **JSON output format** for automation and integration

## Installation

```bash
npm install @ya-modbus/device-profiler
```

## Usage

### CLI

```bash
# Table output (default)
ya-modbus-profile --port /dev/ttyUSB0 --slave-id 1 --baud 9600

# JSON output for automation
ya-modbus-profile --port /dev/ttyUSB0 --slave-id 1 --format json
```

Options:

- `--port` - Serial port (e.g., `/dev/ttyUSB0`) or TCP host:port (e.g., `localhost:502`)
- `--slave-id` - Modbus slave ID (1-247)
- `--type` - Register type: `holding` or `input` (default: `holding`)
- `--start` - Start register address (default: `0`)
- `--end` - End register address (default: `100`)
- `--batch` - Batch size for reads (default: `10`)
- `--baud` - Baud rate for RTU (default: `9600`)
- `--parity` - Parity for RTU: `none`, `even`, `odd` (default: `none`)
- `--data-bits` - Data bits for RTU (default: `8`)
- `--stop-bits` - Stop bits for RTU (default: `1`)
- `--timeout` - Response timeout in milliseconds (default: `1000`)
- `-f, --format` - Output format: `table` or `json` (default: `table`)

### Programmatic

```typescript
import { scanRegisters, RegisterType } from '@ya-modbus/device-profiler'

await scanRegisters({
  transport,
  type: RegisterType.Holding,
  startAddress: 0,
  endAddress: 100,
  batchSize: 10,
  onProgress: (current, total) => {
    console.log(`${current}/${total}`)
  },
  onResult: (result) => {
    console.log(result)
  },
})
```

## Output

### Table Format (Default)

The scanner produces a summary table showing:

- Register address
- Register type (holding/input)
- Read success/failure
- Register value (hex-encoded)
- Response time (milliseconds)
- Error details (if any)

Example:

```
Scanning holding registers from 0 to 10...

Progress: 11/11 (100%)

Scan complete!

┌─────────┬─────────┬─────────┬───────┬────────┬───────┐
│ Address │ Type    │ Status  │ Value │ Timing │ Error │
├─────────┼─────────┼─────────┼───────┼────────┼───────┤
│ 0       │ holding │ ✓       │ 1234  │ 15ms   │       │
│ 1       │ holding │ ✗       │       │ 1000ms │ Timeout waiting for response │
│ 2       │ holding │ ✓       │ 5678  │ 12ms   │       │
└─────────┴─────────┴─────────┴───────┴────────┴───────┘
```

### JSON Format

For automation and integration with other tools, use `--format json` to output machine-readable JSON:

```bash
ya-modbus-profile --port /dev/ttyUSB0 --slave-id 1 --format json
```

#### JSON Structure

The JSON output includes:

- **`timestamp`** (string): ISO 8601 timestamp when the scan completed
- **`scan`** (object): Scan configuration
  - `type` (string): Register type (`"holding"` or `"input"`)
  - `startAddress` (number): Starting register address
  - `endAddress` (number): Ending register address (inclusive)
  - `batchSize` (number): Batch size used for reading
- **`connection`** (object): Connection details
  - `port` (string): Serial port path or TCP host:port
- **`results`** (array): Array of scan results, one per register
  - `address` (number): Register address
  - `type` (string): Register type (`"holding"` or `"input"`)
  - `success` (boolean): Whether the read succeeded
  - `value` (number | null): 16-bit register value (0-65535) or `null` if failed
  - `timing` (number): Read operation duration in milliseconds
  - `error` (string, optional): Error message (only present when `success=false`)
  - `errorType` (string, optional): Error classification (only present when `success=false`)
    - `"timeout"`: Device did not respond within timeout period
    - `"crc"`: CRC check failed (data corruption)
    - `"modbus_exception"`: Device returned a Modbus exception
    - `"unknown"`: Other errors
- **`summary`** (object): Scan statistics
  - `total` (number): Total registers scanned
  - `successful` (number): Number of successful reads
  - `failed` (number): Number of failed reads
  - `totalTimeMs` (number): Total scan duration in milliseconds
  - `averageTimeMs` (number): Average read time per register in milliseconds

#### JSON Example

```json
{
  "timestamp": "2026-02-13T18:17:41.367Z",
  "scan": {
    "type": "holding",
    "startAddress": 0,
    "endAddress": 10,
    "batchSize": 10
  },
  "connection": {
    "port": "/dev/ttyUSB0"
  },
  "results": [
    {
      "address": 0,
      "type": "holding",
      "success": true,
      "value": 4660,
      "timing": 15
    },
    {
      "address": 1,
      "type": "holding",
      "success": false,
      "value": null,
      "timing": 1000,
      "error": "Timeout waiting for response",
      "errorType": "timeout"
    },
    {
      "address": 2,
      "type": "holding",
      "success": true,
      "value": 22136,
      "timing": 12
    }
  ],
  "summary": {
    "total": 3,
    "successful": 2,
    "failed": 1,
    "totalTimeMs": 1027,
    "averageTimeMs": 342.33
  }
}
```

#### JSON Output Notes

- **Progress messages** are suppressed in JSON mode for clean output
- **Register values** are 16-bit unsigned integers (0-65535) in big-endian format
  - Direct numeric access, no parsing needed
  - Example: bytes `[0x12, 0x34]` = 4660 decimal (0x1234 hex)
  - Format as hex if needed: `value.toString(16).padStart(4, '0')`
- **Error fields** (`error`, `errorType`) are only included when `success=false`
- **Timing precision** is milliseconds with up to 2 decimal places
- **Output is formatted** with 2-space indentation for readability

## License

GPL-3.0-or-later
