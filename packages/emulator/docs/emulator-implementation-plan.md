# Device Emulator Implementation Plan

## Overview

Implement `@ya-modbus/emulator` package - a software Modbus device emulator that simulates realistic device behaviors for testing device drivers without physical hardware.

## Goals

1. **Realistic device simulation**: Mimic actual device constraints and timing characteristics
2. **Test acceleration**: Enable fast, deterministic testing without hardware
3. **Edge case coverage**: Simulate error conditions and edge cases
4. **Driver development**: Provide essential tool for driver developers

## Architecture

### Package Structure

```
packages/emulator/
├── src/
│   ├── index.ts                    # Public API exports
│   ├── emulator.ts                 # Main ModbusEmulator class
│   ├── device.ts                   # EmulatedDevice class
│   ├── cli.ts                      # CLI interface
│   ├── transports/
│   │   ├── base.ts                 # BaseTransport abstract class
│   │   ├── rtu.ts                  # RTU transport (using modbus-serial)
│   │   ├── tcp.ts                  # TCP transport (using modbus-serial)
│   │   └── memory.ts               # In-memory transport (for unit tests)
│   ├── behaviors/
│   │   ├── timing.ts               # Timing behavior simulation
│   │   ├── constraints.ts          # Register constraints
│   │   ├── errors.ts               # Error injection
│   │   └── function-codes.ts       # Function code handlers
│   ├── types/
│   │   ├── config.ts               # Configuration types
│   │   ├── device.ts               # Device types
│   │   └── behavior.ts             # Behavior types
│   └── utils/
│       ├── config-loader.ts        # Load device config from file
│       └── buffer-helpers.ts       # Buffer manipulation
├── tests/
│   ├── emulator.test.ts
│   ├── device.test.ts
│   ├── timing.test.ts
│   ├── constraints.test.ts
│   ├── function-codes.test.ts
│   └── cli.test.ts
├── bin/
│   └── ya-modbus-emulator.js       # CLI entry point
├── package.json
├── tsconfig.json
└── README.md
```

### Dependencies

**Production**:

- `modbus-serial`: Modbus protocol implementation and transport layer
- `commander`: CLI argument parsing
- `js-yaml`: YAML config file support

**Development**:

- `@types/node`: TypeScript types
- `@types/js-yaml`: YAML types
- `jest`: Testing framework
- `@ya-modbus/driver-types`: Type definitions (dev-only)

**Architecture Decision**: Use `modbus-serial` library for:

- Protocol handling (CRC, framing, function codes)
- TCP and RTU transport implementations
- Well-tested, production-ready Modbus stack

The emulator wraps `modbus-serial` to provide:

- Realistic device simulation (timing, constraints)
- Error injection capabilities
- Multiple simultaneous device simulation
- Programmatic and CLI interfaces

## Core Features

### 1. Realistic Timing Behaviors

Real devices have internal polling loops and processing delays. Emulator must simulate:

#### 1.1 Command Detection Delay (Internal Polling)

**Concept**: Real devices don't respond instantly - they poll for incoming commands at intervals.

**Configuration**:

```typescript
interface TimingBehavior {
  /** Time device takes to notice incoming command (ms) */
  commandDetectionDelay?: number | [min: number, max: number]

  /** Internal polling interval (ms) - realistic: 1-100ms */
  pollingInterval?: number
}
```

**Implementation**:

- When command received, delay response by `pollingInterval / 2` (average case)
- Use random value in range for variable polling
- Default: 5ms (typical microcontroller polling rate)

**Example**:

```typescript
emulator.addDevice({
  slaveId: 1,
  timing: {
    pollingInterval: 10, // Device checks for commands every 10ms
  },
})
// Response delayed by ~5ms average
```

#### 1.2 Processing Speed

**Concept**: Devices take time to process commands (read registers, perform calculations).

**Configuration**:

```typescript
interface TimingBehavior {
  /** Base processing time per command (ms) */
  processingDelay?: number | [min: number, max: number]

  /** Additional delay per register read/written (ms) */
  perRegisterDelay?: number

  /** Total response time = detection + processing + transmission */
}
```

**Implementation**:

- Calculate total delay: `commandDetectionDelay + processingDelay + (registerCount * perRegisterDelay)`
- Support random ranges for realistic variation
- Different delays for different function codes

**Example**:

```typescript
emulator.addDevice({
  slaveId: 1,
  timing: {
    commandDetectionDelay: [3, 8], // 3-8ms detection
    processingDelay: [2, 5], // 2-5ms base processing
    perRegisterDelay: 0.1, // 0.1ms per register
  },
})
// Reading 10 registers: ~5.5ms detection + ~3.5ms processing + 1ms (10*0.1) = ~10ms total
```

#### 1.3 Transmission Delays

**Concept**: Serial communication has inherent transmission time based on baud rate.

**Configuration**:

```typescript
interface SerialTimingBehavior extends TimingBehavior {
  /** Baud rate (affects transmission time) */
  baudRate?: number

  /** Auto-calculate transmission delay based on frame size */
  autoCalculateTransmissionDelay?: boolean
}
```

**Implementation**:

- Calculate frame transmission time: `(frameBytes * 11) / (baudRate / 1000)` ms
- Frame = request/response size including CRC
- Default baud rates: 9600, 19200, 38400, 115200

**Example**:

```typescript
emulator.addDevice({
  slaveId: 1,
  timing: {
    baudRate: 9600,
    autoCalculateTransmissionDelay: true,
  },
})
// 12-byte frame @ 9600 baud = ~13.75ms transmission time
```

### 2. Register Constraints

Real devices have forbidden ranges and batch size limits.

#### 2.1 Forbidden Register Ranges

**Concept**: Some registers cannot be read/written, even within multi-register operations.

**Configuration**:

```typescript
interface RegisterConstraints {
  /** Ranges that cannot be read */
  forbiddenReadRanges?: Array<{
    type: 'holding' | 'input' | 'coil' | 'discrete'
    start: number
    end: number
    reason?: string
  }>

  /** Ranges that cannot be written */
  forbiddenWriteRanges?: Array<{
    type: 'holding' | 'coil'
    start: number
    end: number
    reason?: string
  }>
}
```

**Implementation**:

- Check every read/write operation against forbidden ranges
- If operation spans forbidden range, return Modbus exception 0x02 (ILLEGAL_DATA_ADDRESS)
- Even if only one register in batch is forbidden, entire operation fails

**Example**:

```typescript
emulator.addDevice({
  slaveId: 1,
  constraints: {
    forbiddenReadRanges: [
      { type: 'holding', start: 100, end: 199, reason: 'Protected configuration' },
    ],
    forbiddenWriteRanges: [
      { type: 'holding', start: 0, end: 9, reason: 'Read-only identification' },
      { type: 'holding', start: 100, end: 199, reason: 'Protected configuration' },
    ],
  },
})

// Reading registers 95-105 → ILLEGAL_DATA_ADDRESS (spans 100-105 forbidden range)
// Reading registers 0-50 → SUCCESS (doesn't touch forbidden range)
```

#### 2.2 Batch Size Limits

**Concept**: Devices have max registers that can be read/written in single operation.

**Configuration**:

```typescript
interface RegisterConstraints {
  /** Max registers per read operation (Modbus standard: 125) */
  maxReadRegisters?: number

  /** Max registers per write operation (Modbus standard: 123) */
  maxWriteRegisters?: number

  /** Max coils per read operation (Modbus standard: 2000) */
  maxReadCoils?: number

  /** Max coils per write operation (Modbus standard: 1968) */
  maxWriteCoils?: number

  /** Device-specific limits (may be lower than standard) */
  customLimits?: {
    maxReadHolding?: number
    maxReadInput?: number
    maxWriteHolding?: number
    // etc.
  }
}
```

**Implementation**:

- Validate operation count against limits before processing
- Return Modbus exception 0x03 (ILLEGAL_DATA_VALUE) if exceeded
- Support per-function-code limits

**Example**:

```typescript
emulator.addDevice({
  slaveId: 1,
  constraints: {
    maxReadRegisters: 80, // Device limit lower than standard 125
    maxWriteRegisters: 50, // Device limit lower than standard 123
  },
})

// Reading 90 registers → ILLEGAL_DATA_VALUE (exceeds 80 limit)
// Reading 80 registers → SUCCESS
```

### 3. Custom Function Codes

Real devices may support non-standard function codes or vendor-specific extensions.

#### 3.1 Standard Function Codes

**Required support**:

- 0x01: Read Coils
- 0x02: Read Discrete Inputs
- 0x03: Read Holding Registers
- 0x04: Read Input Registers
- 0x05: Write Single Coil
- 0x06: Write Single Register
- 0x0F: Write Multiple Coils
- 0x10: Write Multiple Registers

#### 3.2 Custom Function Codes

**Configuration**:

```typescript
interface CustomFunctionCode {
  code: number
  name: string
  handler: (request: Buffer, device: EmulatedDevice) => Buffer | ModbusException
}

interface DeviceConfig {
  customFunctionCodes?: CustomFunctionCode[]
}
```

**Implementation**:

- Allow registration of custom handlers for any function code
- Handler receives raw request buffer, returns response buffer or exception
- Support for vendor-specific codes (0x41-0x72 per Modbus spec)

**Example**:

```typescript
emulator.addDevice({
  slaveId: 1,
  customFunctionCodes: [
    {
      code: 0x43,
      name: 'Read Device Identification',
      handler: (request, device) => {
        // Parse request
        const objectId = request[2]

        // Build response
        const response = Buffer.alloc(20)
        response[0] = device.slaveId
        response[1] = 0x43
        // ... encode device info
        return response
      },
    },
  ],
})
```

### 4. Error Simulation

**Configuration**:

```typescript
interface ErrorBehavior {
  /** Probability of timeout (0-1) */
  timeoutProbability?: number

  /** Probability of CRC error (0-1) */
  crcErrorProbability?: number

  /** Probability of random exception (0-1) */
  exceptionProbability?: number

  /** Specific exceptions to return */
  forcedException?: ModbusExceptionCode

  /** Simulate device disconnection */
  disconnected?: boolean
}
```

**Implementation**:

- Inject errors based on probability
- Support forced errors for specific test scenarios
- Simulate timeouts by not responding
- Simulate CRC errors by corrupting response

**Example**:

```typescript
emulator.addDevice({
  slaveId: 1,
  errors: {
    timeoutProbability: 0.05, // 5% of requests timeout
    crcErrorProbability: 0.01, // 1% of responses have bad CRC
  },
})
```

### 5. Register Storage

**Configuration**:

```typescript
interface RegisterStorage {
  /** Holding registers (read/write) */
  holdingRegisters?: Map<number, number>

  /** Input registers (read-only) */
  inputRegisters?: Map<number, number>

  /** Coils (read/write bits) */
  coils?: Map<number, boolean>

  /** Discrete inputs (read-only bits) */
  discreteInputs?: Map<number, boolean>
}
```

**Implementation**:

- Sparse storage (Map) - only store defined registers
- Reading undefined register returns 0
- Writing to undefined register stores value
- Support for initial register values

**Example**:

```typescript
emulator.addDevice({
  slaveId: 1,
  registers: {
    holding: {
      0: 230, // Voltage * 10 = 23.0V
      1: 52, // Current * 10 = 5.2A
      100: 12345, // Serial number
    },
    input: {
      0: 500, // Temperature * 10 = 50.0°C
    },
  },
})
```

### 6. Transport Support

#### 6.1 TCP Transport

**Features**:

- Listen on configurable port (default: 502)
- Support multiple concurrent connections
- Per-connection state management

**Configuration**:

```typescript
interface TcpTransportConfig {
  port?: number
  host?: string
  maxConnections?: number
}
```

#### 6.2 RTU Transport

**Features**:

- **Virtual serial port support** - For local testing without hardware (using `socat`, `com0com`, etc.)
- **Real serial port support** - Connect to actual RS-485/RS-232 adapters for hardware testing
- Baud rate configuration
- Parity and stop bits
- CRC validation
- Automatic transmission delay calculation based on baud rate

**Use Cases**:

1. **Local testing** - Virtual serial port pair (`socat -d -d pty,raw,echo=0 pty,raw,echo=0`)
   - Emulator on one end, driver under test on the other
   - No hardware required
   - Fast iteration

2. **Hardware validation** - Real serial port (`/dev/ttyUSB0`, `COM3`)
   - Emulator acts as slave device
   - Connect real Modbus master for integration testing
   - Validate protocol compatibility with real hardware

**Configuration**:

```typescript
interface RtuTransportConfig {
  port: string // Serial port path (/dev/ttyUSB0, /dev/pts/10, COM3)
  baudRate?: number // Default: 9600
  parity?: 'none' | 'even' | 'odd' // Default: 'none'
  stopBits?: 1 | 2 // Default: 1
  dataBits?: 7 | 8 // Default: 8
  isVirtual?: boolean // Hint for optimizations (optional)
}

// Example: Virtual serial port for local testing
const emulator = new ModbusEmulator({
  transport: 'rtu',
  port: '/dev/pts/10', // Virtual port (from socat)
  baudRate: 9600,
})

// Example: Real serial port for hardware testing
const emulator = new ModbusEmulator({
  transport: 'rtu',
  port: '/dev/ttyUSB0', // Real RS-485 adapter
  baudRate: 19200,
  parity: 'even',
})
```

#### 6.3 Memory Transport

**Features**:

- In-memory communication (no network/serial)
- Instant responses (no transmission delay)
- For unit testing only

**Configuration**:

```typescript
interface MemoryTransportConfig {
  // No configuration needed
}
```

## Implementation Phases

### Phase 1: Core Infrastructure (TDD)

**Tests first, then implementation:**

1. **Test**: Basic emulator lifecycle
   - Start/stop emulator
   - Add/remove devices
   - Basic configuration

2. **Implement**: `ModbusEmulator` class
   - Device registry
   - Transport management
   - Lifecycle methods

3. **Test**: Register storage
   - Read/write holding registers
   - Read input registers
   - Coil operations
   - Sparse storage behavior

4. **Implement**: `EmulatedDevice` class
   - Register storage (Map-based)
   - Basic read/write operations

5. **Test**: Standard function codes
   - Read Holding Registers (0x03)
   - Read Input Registers (0x04)
   - Write Single Register (0x06)
   - Write Multiple Registers (0x10)

6. **Implement**: Function code handlers
   - Request parsing
   - Response building
   - Exception handling

### Phase 2: Timing Behaviors (TDD)

**Tests first:**

1. **Test**: Command detection delay
   - Fixed delay
   - Random delay range
   - Polling interval simulation

2. **Implement**: `TimingBehavior` class
   - Delay calculation
   - Random range support
   - Integration with device

3. **Test**: Processing delays
   - Base processing time
   - Per-register delays
   - Total delay calculation

4. **Implement**: Processing delay logic
   - Multi-component delay calculation
   - Per-function-code delays

5. **Test**: Transmission delays (RTU)
   - Baud rate-based calculation
   - Frame size impact
   - Auto-calculation

6. **Implement**: Transmission delay calculation
   - Baud rate formula
   - Frame size detection

### Phase 3: TCP and RTU Transports (TDD)

**Status: NEXT - Critical for v0.1.0 release**

**Enables real network/serial communication**

**Tests first:**

1. **Test**: TCP transport (using modbus-serial)
   - Server listen
   - Client connect
   - Multiple connections
   - Connection close
   - Request/response handling

2. **Implement**: `TcpTransport` class
   - Wrap modbus-serial TCP server
   - Bridge modbus-serial to emulator device layer
   - Connection management
   - Request routing to correct device

3. **Test**: RTU transport (using modbus-serial)
   - **Unit tests**: Integration with modbus-serial
   - **Integration tests with virtual serial ports**:
     - Serial port communication
     - Request/response handling
     - Multiple device routing
   - **Manual testing with real serial ports** (optional, for hardware validation)

4. **Implement**: `RtuTransport` class
   - Wrap modbus-serial RTU server
   - Bridge modbus-serial to emulator device layer
   - Serial port configuration
   - Support both virtual and real serial ports transparently

**Note**: Using `modbus-serial` eliminates need for custom CRC, framing, and protocol implementation. Focus on bridging modbus-serial's request/response model to emulator's device simulation layer.

### Phase 4: CLI Implementation (TDD)

**Status: Critical for v0.1.0 release**

**Tests first:**

1. **Test**: CLI argument parsing
   - Transport options
   - Device configuration
   - Behavior flags
   - Config file loading

2. **Implement**: CLI interface
   - Command definition (using commander)
   - Argument parsing and validation
   - Help text generation

3. **Test**: Config file loading
   - YAML parsing
   - JSON parsing
   - Validation
   - Error handling

4. **Implement**: Config loader utility
   - File reading
   - Format detection
   - Schema validation

5. **Test**: CLI-to-API bridge
   - Convert CLI args to emulator config
   - Device creation from config
   - Logging and output

6. **Implement**: Main CLI entry point
   - Config conversion
   - Emulator lifecycle
   - Signal handling (Ctrl+C)
   - Logging (verbose, quiet, request logging)

7. **Test**: CLI integration tests
   - Start/stop with config file
   - Multiple devices
   - Request logging
   - Error scenarios

### Phase 5: Basic Documentation & v0.1.0 Release

**Status: First usable release**

1. **README.md**:
   - Installation instructions
   - Quick start example (CLI)
   - Basic configuration (YAML/JSON)
   - Command-line options reference

2. **Basic examples**:
   - `examples/basic-tcp.yaml` - Simple TCP emulator
   - `examples/basic-rtu.yaml` - Simple RTU emulator
   - `examples/power-meter.yaml` - Realistic power meter

3. **Package.json**:
   - Add `bin` entry for CLI
   - Update version to 0.1.0
   - Verify dependencies

4. **Release checklist**:
   - All tests passing
   - Linting clean
   - README complete
   - Examples working
   - Package installable globally

### Phase 6: Register Constraints (TDD)

**Status: Enhancement for v0.2.0**

**Tests first:**

1. **Test**: Forbidden read ranges
   - Single register in forbidden range
   - Multi-register spanning forbidden range
   - Multi-register not touching forbidden range
   - Exception codes

2. **Implement**: `ForbiddenRangeChecker` class
   - Range overlap detection
   - Exception generation

3. **Test**: Forbidden write ranges
   - Same test cases as read
   - Different ranges for read vs write

4. **Implement**: Write range checking
   - Integration with write operations

5. **Test**: Batch size limits
   - Exact limit (should pass)
   - Over limit (should fail)
   - Different limits per operation type

6. **Implement**: Batch size validation
   - Pre-operation checks
   - Configurable limits

### Phase 7: Custom Function Codes (TDD)

**Status: Enhancement for v0.2.0**

**Tests first:**

1. **Test**: Custom handler registration
   - Add custom handler
   - Replace standard handler
   - Invalid code rejection

2. **Implement**: Function code registry
   - Handler storage
   - Dispatch logic

3. **Test**: Custom handler execution
   - Request parsing
   - Response building
   - Exception handling

4. **Implement**: Handler execution
   - Buffer passing
   - Response validation

### Phase 8: Error Simulation (TDD)

**Status: Enhancement for v0.2.0**

**Tests first:**

1. **Test**: Timeout simulation
   - Probability-based
   - Forced timeout
   - No response sent

2. **Implement**: Timeout behavior
   - Random check
   - Response suppression

3. **Test**: CRC error simulation
   - Corrupted response
   - Probability-based
   - Forced CRC error

4. **Implement**: CRC corruption
   - Response modification
   - CRC recalculation (incorrect)

5. **Test**: Exception injection
   - Random exceptions
   - Forced exceptions
   - Correct exception codes

6. **Implement**: Exception injection
   - Probability check
   - Exception response building

### Phase 9: Advanced Documentation & Examples

**Status: v1.0.0 production ready**

1. **Integration tests**:
   - End-to-end workflows
   - Multiple devices
   - Mixed behaviors
   - CLI + programmatic API

2. **Documentation**:
   - README with usage examples (both API and CLI)
   - API reference (JSDoc)
   - CLI reference (help text + docs)
   - Configuration guide (YAML/JSON schemas)
   - Common test patterns

3. **Examples**:
   - Basic emulator usage (API)
   - CLI usage examples
   - Realistic device simulation
   - Error scenario testing
   - Driver development workflow
   - RTU testing setup (virtual serial ports)
   - CI/CD integration examples

4. **RTU Testing Setup Guide**:
   - Virtual serial port creation (Linux, macOS, Windows)
   - Connecting emulator to driver tests
   - Real serial port testing procedures
   - Troubleshooting common issues

5. **Package publishing**:
   - Update package.json with bin entry
   - Test global installation
   - Verify CLI works from PATH

## API Design

### Main API

```typescript
import { ModbusEmulator } from '@ya-modbus/emulator'

// Create emulator
const emulator = new ModbusEmulator({
  transport: 'tcp',
  port: 5502,
})

// Add device with realistic behaviors
emulator.addDevice({
  slaveId: 1,

  // Timing behavior
  timing: {
    pollingInterval: 10, // Check for commands every 10ms
    commandDetectionDelay: [3, 8], // 3-8ms to notice command
    processingDelay: [2, 5], // 2-5ms to process
    perRegisterDelay: 0.1, // 0.1ms per register
  },

  // Register constraints
  constraints: {
    maxReadRegisters: 80, // Device limit
    maxWriteRegisters: 50, // Device limit
    forbiddenReadRanges: [{ type: 'holding', start: 100, end: 199, reason: 'Protected' }],
    forbiddenWriteRanges: [{ type: 'holding', start: 0, end: 9, reason: 'Read-only' }],
  },

  // Initial register values
  registers: {
    holding: {
      0: 230, // Voltage
      1: 52, // Current
      100: 12345, // Serial (in protected range)
    },
  },

  // Custom function codes
  customFunctionCodes: [
    {
      code: 0x43,
      name: 'Read Device ID',
      handler: (request, device) => {
        const response = Buffer.alloc(10)
        response[0] = device.slaveId
        response[1] = 0x43
        response.write('ACME-1000', 2)
        return response
      },
    },
  ],

  // Error simulation
  errors: {
    timeoutProbability: 0.05, // 5% timeout rate
    crcErrorProbability: 0.01, // 1% CRC error rate
  },
})

// Start emulator
await emulator.start()

// Use with driver tests
const driver = new MyDriver({
  transport: emulator.getTransport(),
  slaveId: 1,
})

const data = await driver.read(['voltage'])
expect(data.voltage).toBe(23.0)

// Stop emulator
await emulator.stop()
```

### Helper Methods

```typescript
// Update register values during test
emulator.setRegister(1, 'holding', 0, 250)

// Inject error for next operation
emulator.injectError(1, 'timeout')
emulator.injectError(1, 'exception', 0x02)

// Get device statistics
const stats = emulator.getDeviceStats(1)
// { requestCount: 10, errorCount: 1, avgResponseTime: 12.5 }

// Simulate disconnection
emulator.disconnectDevice(1)
emulator.reconnectDevice(1)
```

## CLI Interface

### Overview

Command-line interface for running emulator without writing code. Useful for:

- Quick device simulation during development
- Integration testing in CI/CD pipelines
- Manual testing with real Modbus clients
- Debugging driver implementations

### Installation

```bash
npm install -g @ya-modbus/emulator
```

### Basic Usage

```bash
# Start emulator with single device on TCP
ya-modbus-emulator --transport tcp --port 5502 --slave-id 1

# Start emulator with RTU transport
ya-modbus-emulator --transport rtu --port /dev/pts/10 --baud-rate 9600 --slave-id 1

# Load device configuration from file
ya-modbus-emulator --config device.yaml

# Start with multiple devices
ya-modbus-emulator --config devices.yaml --verbose
```

### Command-Line Options

```
Options:
  -V, --version                    Output version number
  -h, --help                       Display help

Transport:
  -t, --transport <type>           Transport type: tcp|rtu (required)
  -p, --port <port>                TCP port number or serial port path (required)
  -H, --host <host>                TCP host address (default: "0.0.0.0")
  --baud-rate <rate>               Serial baud rate (default: 9600)
  --parity <type>                  Serial parity: none|even|odd (default: "none")
  --data-bits <bits>               Serial data bits: 7|8 (default: 8)
  --stop-bits <bits>               Serial stop bits: 1|2 (default: 1)

Device:
  -s, --slave-id <id>              Slave ID (1-247, required if no config file)
  -c, --config <file>              Device configuration file (YAML/JSON)

Behavior:
  --timing-delay <ms>              Processing delay in ms
  --timeout-rate <rate>            Timeout probability 0-1 (e.g., 0.05 = 5%)
  --error-rate <rate>              CRC error probability 0-1

Other:
  -v, --verbose                    Enable verbose logging
  -q, --quiet                      Suppress all output except errors
  --log-requests                   Log all Modbus requests/responses
```

### Configuration File Format

**YAML format** (recommended):

```yaml
# device.yaml - Single device configuration
transport:
  type: tcp
  port: 5502
  host: 0.0.0.0

devices:
  - slaveId: 1
    name: 'Power Meter'

    # Initial register values
    registers:
      holding:
        0: 230 # Voltage * 10 = 23.0V
        1: 52 # Current * 10 = 5.2A
        2: 1196 # Power = 23.0V * 5.2A = 119.6W
        10: 12345 # Serial number
      input:
        0: 500 # Temperature * 10 = 50.0°C
        1: 60 # Humidity = 60%

    # Timing behavior
    timing:
      pollingInterval: 10
      commandDetectionDelay: [3, 8]
      processingDelay: [2, 5]
      perRegisterDelay: 0.1

    # Register constraints
    constraints:
      maxReadRegisters: 80
      maxWriteRegisters: 50
      forbiddenReadRanges:
        - type: holding
          start: 100
          end: 199
          reason: 'Protected configuration'
      forbiddenWriteRanges:
        - type: holding
          start: 0
          end: 9
          reason: 'Read-only identification'

    # Error simulation (optional)
    errors:
      timeoutProbability: 0.02 # 2% timeout rate
      crcErrorProbability: 0.01 # 1% CRC error rate
```

**Multiple devices**:

```yaml
# devices.yaml - Multiple device configuration
transport:
  type: tcp
  port: 5502

devices:
  - slaveId: 1
    name: 'Power Meter'
    registers:
      holding:
        0: 230
        1: 52

  - slaveId: 2
    name: 'Temperature Sensor'
    registers:
      input:
        0: 250
        1: 60
    timing:
      pollingInterval: 20

  - slaveId: 3
    name: 'Relay Controller'
    registers:
      coils:
        0: false
        1: false
        2: true
```

**JSON format** (alternative):

```json
{
  "transport": {
    "type": "tcp",
    "port": 5502
  },
  "devices": [
    {
      "slaveId": 1,
      "name": "Power Meter",
      "registers": {
        "holding": {
          "0": 230,
          "1": 52
        }
      }
    }
  ]
}
```

### CLI Examples

**Example 1: Simple TCP emulator**

```bash
ya-modbus-emulator \
  --transport tcp \
  --port 5502 \
  --slave-id 1 \
  --verbose
```

**Example 2: RTU emulator with virtual serial port**

```bash
# Terminal 1: Create virtual serial port
socat -d -d pty,raw,echo=0 pty,raw,echo=0
# Output: PTY is /dev/pts/10 and /dev/pts/11

# Terminal 2: Start emulator
ya-modbus-emulator \
  --transport rtu \
  --port /dev/pts/10 \
  --baud-rate 9600 \
  --slave-id 1 \
  --log-requests

# Terminal 3: Test with modpoll
modpoll -m rtu -b 9600 -p none -a 1 -r 0 -c 10 /dev/pts/11
```

**Example 3: Load complex device from config**

```bash
ya-modbus-emulator --config power-meter.yaml --verbose
```

**Example 4: CI/CD integration testing**

```bash
# Start emulator in background
ya-modbus-emulator --config test-device.yaml --quiet &
EMULATOR_PID=$!

# Run tests
npm test

# Stop emulator
kill $EMULATOR_PID
```

**Example 5: Error injection testing**

```bash
ya-modbus-emulator \
  --transport tcp \
  --port 5502 \
  --slave-id 1 \
  --timeout-rate 0.1 \
  --error-rate 0.05 \
  --log-requests
```

### CLI Output Examples

**Normal operation**:

```
[INFO] Starting Modbus emulator...
[INFO] Transport: TCP on 0.0.0.0:5502
[INFO] Devices: 1
[INFO]   - Slave ID 1: Power Meter
[INFO] Emulator started successfully
[INFO] Press Ctrl+C to stop
```

**With request logging**:

```
[INFO] Emulator started successfully
[REQUEST] 01 03 00 00 00 02 → Read holding registers 0-1 from slave 1
[RESPONSE] 01 03 04 00 E6 00 34 → [230, 52]
[REQUEST] 01 04 00 00 00 02 → Read input registers 0-1 from slave 1
[RESPONSE] 01 04 04 01 F4 00 3C → [500, 60]
```

**With errors**:

```
[WARN] Timeout injected for slave 1 (configured rate: 5%)
[REQUEST] 01 03 00 00 00 02 → Read holding registers 0-1 from slave 1
[TIMEOUT] No response sent
[REQUEST] 01 03 00 64 00 01 → Read holding register 100 from slave 1
[ERROR] Illegal data address (register 100 in forbidden range)
[RESPONSE] 01 83 02 → Exception 0x02 (ILLEGAL_DATA_ADDRESS)
```

### CLI Implementation Details

**Structure**:

```typescript
// src/cli.ts
import { Command } from 'commander'
import { ModbusEmulator } from './emulator.js'
import { loadConfig } from './utils/config-loader.js'

export async function main() {
  const program = new Command()

  program
    .name('ya-modbus-emulator')
    .description('Modbus device emulator for testing')
    .version('0.0.0')

  // Add options...

  program.parse()
  const options = program.opts()

  // Load config or build from CLI args
  const config = options.config ? await loadConfig(options.config) : buildConfigFromArgs(options)

  // Create and start emulator
  const emulator = new ModbusEmulator(config)

  // Add devices
  for (const deviceConfig of config.devices) {
    emulator.addDevice(deviceConfig)
  }

  await emulator.start()

  // Handle shutdown
  process.on('SIGINT', async () => {
    await emulator.stop()
    process.exit(0)
  })
}
```

**Config loader**:

```typescript
// src/utils/config-loader.ts
import { readFile } from 'fs/promises'
import yaml from 'js-yaml'

export async function loadConfig(path: string) {
  const content = await readFile(path, 'utf-8')

  if (path.endsWith('.yaml') || path.endsWith('.yml')) {
    return yaml.load(content)
  } else if (path.endsWith('.json')) {
    return JSON.parse(content)
  } else {
    throw new Error('Unsupported config format. Use .yaml, .yml, or .json')
  }
}
```

## Testing Strategy

### Unit Tests

**Coverage target: 100% for core logic**

- Register storage operations
- Timing calculations
- Constraint validation
- Function code handlers
- Error injection logic

### Integration Tests

**Coverage target: 90%**

- End-to-end device communication
- Multiple devices on same transport
- Realistic timing scenarios
- Complex constraint scenarios
- Custom function code execution

### Test Patterns

```typescript
describe('EmulatedDevice', () => {
  let emulator: ModbusEmulator
  let device: EmulatedDevice

  beforeEach(async () => {
    emulator = new ModbusEmulator({ transport: 'memory' })
    device = emulator.addDevice({
      slaveId: 1,
      registers: { holding: { 0: 100 } },
    })
    await emulator.start()
  })

  afterEach(async () => {
    await emulator.stop()
  })

  it('should read holding register', async () => {
    const client = emulator.getClient()
    const value = await client.readHoldingRegisters(0, 1)
    expect(value.data[0]).toBe(100)
  })

  it('should reject read from forbidden range', async () => {
    device.setConstraints({
      forbiddenReadRanges: [{ type: 'holding', start: 100, end: 199 }],
    })

    const client = emulator.getClient()
    await expect(client.readHoldingRegisters(100, 1)).rejects.toThrow('ILLEGAL_DATA_ADDRESS')
  })

  it('should apply realistic timing delays', async () => {
    device.setTiming({
      pollingInterval: 10,
      processingDelay: 5,
    })

    const client = emulator.getClient()
    const start = Date.now()
    await client.readHoldingRegisters(0, 1)
    const elapsed = Date.now() - start

    // Should take ~10ms (polling/2 + processing)
    expect(elapsed).toBeGreaterThanOrEqual(10)
    expect(elapsed).toBeLessThan(20)
  })
})
```

## Documentation Requirements

### README.md

- Quick start example
- Configuration reference
- Common use cases
- Realistic device simulation guide

### API Reference

- JSDoc for all public methods
- Configuration type documentation
- Error types and codes
- Transport options

### Examples

- `examples/basic-emulator.ts` - Simple usage
- `examples/realistic-device.ts` - Full device simulation
- `examples/error-scenarios.ts` - Error injection
- `examples/driver-testing.ts` - Integration with driver tests
- `examples/rtu-virtual-serial.ts` - RTU with virtual serial ports
- `examples/rtu-real-serial.ts` - RTU with real serial ports

### RTU Testing Setup

**Detailed guide for setting up RTU mode testing:**

#### Virtual Serial Ports (Local Testing)

Virtual serial ports create a pair of connected pseudo-terminals for testing without hardware.

**Linux/macOS** (using `socat`):

```bash
# Install socat
sudo apt-get install socat  # Ubuntu/Debian
brew install socat          # macOS

# Create virtual serial port pair
socat -d -d pty,raw,echo=0 pty,raw,echo=0

# Output shows the created ports:
# 2025/01/02 10:30:45 socat[12345] N PTY is /dev/pts/10
# 2025/01/02 10:30:45 socat[12345] N PTY is /dev/pts/11
```

**Usage in tests**:

```typescript
// Terminal 1: Start emulator on /dev/pts/10
const emulator = new ModbusEmulator({
  transport: 'rtu',
  port: '/dev/pts/10',
  baudRate: 9600,
})

emulator.addDevice({
  slaveId: 1,
  registers: { holding: { 0: 230 } },
})

await emulator.start()

// Terminal 2: Connect driver to /dev/pts/11
const driver = new MyDriver({
  transport: 'rtu',
  port: '/dev/pts/11',
  baudRate: 9600,
  slaveId: 1,
})

const data = await driver.read(['voltage'])
```

**Automated test setup** (using `node-pty` or scripted `socat`):

```typescript
// In test setup, spawn socat process
import { spawn } from 'child_process'

beforeAll(async () => {
  // Create virtual serial port pair
  const socat = spawn('socat', [
    '-d',
    '-d',
    'pty,raw,echo=0,link=/tmp/vserial0',
    'pty,raw,echo=0,link=/tmp/vserial1',
  ])

  // Wait for ports to be ready
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Start emulator on one port
  emulator = new ModbusEmulator({
    transport: 'rtu',
    port: '/tmp/vserial0',
    baudRate: 9600,
  })

  await emulator.start()
})

it('should communicate via virtual serial port', async () => {
  // Driver connects to paired port
  const client = new ModbusRTU()
  await client.connectRTU('/tmp/vserial1', { baudRate: 9600 })

  const result = await client.readHoldingRegisters(0, 1)
  expect(result.data[0]).toBe(230)
})
```

**Windows** (using `com0com`):

```powershell
# Download and install com0com from sourceforge
# Creates virtual COM port pairs (COM3 <-> COM4)

# Configure in com0com setup:
# CNCA0 -> COM3
# CNCB0 -> COM4
```

```typescript
// Windows usage
const emulator = new ModbusEmulator({
  transport: 'rtu',
  port: 'COM3',
  baudRate: 9600,
})

// Driver connects to COM4
```

#### Real Serial Ports (Hardware Testing)

Test against actual RS-485/RS-232 hardware.

**Setup**:

1. **Connect RS-485 adapter** to computer (USB-to-RS485 converter)
2. **Identify port**:

   ```bash
   # Linux
   ls /dev/ttyUSB* /dev/ttyACM*

   # macOS
   ls /dev/cu.usbserial*

   # Windows
   # Check Device Manager -> Ports (COM & LPT)
   ```

3. **Configure emulator**:

   ```typescript
   const emulator = new ModbusEmulator({
     transport: 'rtu',
     port: '/dev/ttyUSB0', // Your actual serial port
     baudRate: 19200, // Match hardware settings
     parity: 'even',
   })
   ```

4. **Connect Modbus master** to same RS-485 bus
5. **Test communication**:
   - Master polls emulated device
   - Emulator responds as configured device
   - Validate protocol compatibility

**Common use cases**:

1. **Test driver against emulator via real serial port**:

   ```
   [Driver] <-> [USB-RS485] <-> [RS-485 Bus] <-> [USB-RS485] <-> [Emulator]
   ```

2. **Test real device driver integration**:
   ```
   [Real Device] <-> [RS-485 Bus] <-> [USB-RS485] <-> [Bridge with Driver]
   [Emulator]    <-> [RS-485 Bus] <-> [USB-RS485] <-> [Bridge with Driver]
   ```
   Swap real device with emulator to isolate driver behavior.

**Permissions** (Linux):

```bash
# Add user to dialout group for serial port access
sudo usermod -a -G dialout $USER

# Or set permissions for specific port
sudo chmod 666 /dev/ttyUSB0
```

#### Troubleshooting RTU Mode

**Common issues**:

1. **"Port not found" error**:
   - Check port exists: `ls -l /dev/ttyUSB0`
   - Check permissions: User must be in `dialout` group
   - Verify virtual port still active (socat running)

2. **CRC errors**:
   - Verify baud rate matches on both ends
   - Check parity settings match
   - Ensure stop bits configuration matches

3. **Timeout errors**:
   - Increase response timeout in client
   - Check timing configuration in emulator
   - Verify slave ID matches

4. **No response**:
   - Check slave ID configuration
   - Verify port paths are correct (paired ports for virtual)
   - Check if emulator is started and device added
   - Monitor serial traffic with `interceptty` or `tio`

**Monitoring serial traffic**:

```bash
# Install interceptty (Linux)
sudo apt-get install interceptty

# Monitor traffic between ports
interceptty /dev/pts/10 /dev/pts/12

# Now use /dev/pts/12 instead of /dev/pts/10
# Traffic will be logged to terminal
```

## Success Criteria

### Functionality

- ✅ All standard Modbus function codes supported
- ✅ Realistic timing simulation (polling, processing, transmission)
- ✅ Register constraints (forbidden ranges, batch limits)
- ✅ Custom function codes
- ✅ Error injection (timeout, CRC, exceptions)
- ✅ TCP and Memory transports working (using modbus-serial)
- ✅ RTU transport (both virtual and real serial ports, using modbus-serial)
- ✅ CLI interface with config file support
- ✅ Programmatic API for test integration

### Quality

- ✅ 100% unit test coverage for core logic
- ✅ 90% integration test coverage
- ✅ All tests pass consistently
- ✅ No TypeScript errors (strict mode)
- ✅ Documentation complete (API + CLI)
- ✅ Example code works (both API and CLI)
- ✅ CLI can be installed globally

### Performance

- ✅ Memory transport: <1ms response time
- ✅ TCP transport: <5ms response time (local)
- ✅ Support 10+ devices per emulator
- ✅ 1000+ operations/second throughput

## Future Enhancements

**Phase 9 (Future)**:

1. **Register change callbacks**: Notify on register write
2. **Dynamic behavior**: Change behavior during test
3. **Recording/playback**: Capture real device traffic, replay in emulator
4. **Device templates**: Pre-configured device profiles
5. **Web UI**: Visual device configuration and monitoring
6. **Performance profiling**: Track operation timing statistics
7. **Prometheus metrics**: Export emulator metrics for monitoring

## Dependencies on Other Packages

### Required First

None - emulator is standalone

### Enables

- `@ya-modbus/driver-dev-tools` - Uses emulator for testing
- `@ya-modbus/driver-*` - All drivers use emulator for tests
- `@ya-modbus/core` - Integration tests use emulator

## File Naming Convention

- Implementation: `feature-name.ts`
- Tests: `feature-name.test.ts` (next to implementation)
- Integration tests: `feature-name.integration.test.ts`
- Types: `types/feature-name.ts`

## Commit Strategy

- One commit per completed feature with tests
- Format: `feat(emulator): description`
- Include tests in same commit as implementation
- Follow TDD: test first, implement, commit

## Implementation Roadmap

**Status: Phase 2 Complete (2/9 phases)**

**Not providing timeline estimates per project guidelines - focus on deliverables:**

### Core Phases (Reordered for First Release)

- **Phase 1**: ✅ **COMPLETED** - Core infrastructure (emulator, devices, basic function codes, memory transport)
  - Commit: e8bd41b
  - 68 tests passing, 99%+ coverage
  - EmulatedDevice, ModbusEmulator, MemoryTransport
  - Function codes: 0x03, 0x04, 0x06, 0x10

- **Phase 2**: ✅ **COMPLETED** - Timing behaviors (all delay types)
  - Commit: 7c1c345
  - 116 tests passing, 99.5% statements, 98.8% branches
  - Command detection, processing, transmission delays
  - Functional programming, dependency injection

- **Phase 3**: TCP and RTU transports (using modbus-serial)
  - NEXT: Critical for first release
  - TCP transport for network communication
  - RTU transport for serial communication
  - Integration with modbus-serial library

- **Phase 4**: CLI implementation (commander, config loading, logging)
  - Critical for first release
  - Command-line interface
  - YAML/JSON config file support
  - Request/response logging

- **Phase 5**: Basic documentation & v0.1.0 release
  - First usable release
  - README with CLI usage
  - Basic examples
  - Installation instructions

- **Phase 6**: Register constraints (forbidden ranges, limits)
  - Enhancement: Realistic device limitations
  - Forbidden read/write ranges
  - Batch size limits

- **Phase 7**: Custom function codes
  - Enhancement: Vendor-specific extensions
  - Custom handler registration
  - Function code dispatch

- **Phase 8**: Error simulation
  - Enhancement: Fault injection testing
  - Timeout, CRC error simulation
  - Exception injection

- **Phase 9**: Advanced documentation & examples
  - Comprehensive examples
  - Integration patterns
  - Testing best practices

### Completion Criteria

Each phase completes when:

- ✅ All tests pass (100% coverage for unit tests, 90% for integration)
- ✅ No linting errors
- ✅ Documentation updated
- ✅ Code committed with meaningful message

### Key Milestones

1. **v0.1.0 - First Release** (Phases 1-5): Working CLI emulator with TCP/RTU support
   - ✅ Core infrastructure
   - ✅ Timing behaviors
   - 🔄 TCP/RTU transports
   - ⏳ CLI interface
   - ⏳ Basic documentation
   - **Goal**: Users can run `ya-modbus-emulator --config device.yaml` and test against it

2. **v0.2.0 - Enhanced Realism** (Phases 6-8): Advanced device simulation
   - Register constraints
   - Custom function codes
   - Error simulation
   - **Goal**: Comprehensive device behavior testing

3. **v1.0.0 - Production Ready** (Phase 9): Complete package
   - Advanced examples
   - Integration guides
   - Performance testing
   - **Goal**: Production-grade testing tool
