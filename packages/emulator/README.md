# @ya-modbus/emulator

Software Modbus device emulator for testing device drivers without physical hardware.

## Features

- **Realistic device simulation**: Mimic actual device constraints and timing characteristics
- **Test acceleration**: Enable fast, deterministic testing without hardware
- **Edge case coverage**: Simulate error conditions and edge cases
- **Multiple transports**: TCP, RTU (virtual/real serial ports), and in-memory
- **Custom function codes**: Support vendor-specific Modbus extensions

## Installation

```bash
npm install @ya-modbus/emulator
```

## Quick Start

### Memory Transport (fastest for unit tests)

```typescript
import { ModbusEmulator } from '@ya-modbus/emulator'

// Create emulator with in-memory transport
const emulator = new ModbusEmulator({
  transport: 'memory',
})

// Add a device
emulator.addDevice({
  slaveId: 1,
  registers: {
    holding: {
      0: 230, // Voltage * 10 = 23.0V
      1: 52, // Current * 10 = 5.2A
    },
  },
})

// Start emulator
await emulator.start()

// Use with your driver tests
// ...

// Stop emulator
await emulator.stop()
```

### TCP Transport (network)

```typescript
import { ModbusEmulator } from '@ya-modbus/emulator'

// Create emulator with TCP transport
const emulator = new ModbusEmulator({
  transport: 'tcp',
  host: '0.0.0.0', // Listen on all interfaces
  port: 502, // Standard Modbus TCP port
})

// Add devices
emulator.addDevice({
  slaveId: 1,
  registers: {
    holding: { 0: 230, 1: 52 },
  },
})

emulator.addDevice({
  slaveId: 2,
  registers: {
    holding: { 0: 500, 1: 100 },
  },
})

// Start emulator
await emulator.start()

// Use with your driver tests (clients connect to localhost:502)
// ...

// Stop emulator
await emulator.stop()
```

### RTU Transport (serial port)

```typescript
import { ModbusEmulator } from '@ya-modbus/emulator'

// Create emulator with RTU transport
const emulator = new ModbusEmulator({
  transport: 'rtu',
  port: '/dev/ttyUSB0', // or 'COM3' on Windows
  baudRate: 9600,
  parity: 'none',
  dataBits: 8,
  stopBits: 1,
  // lock: true, // Enable exclusive port locking (default)
})

// Add devices
emulator.addDevice({
  slaveId: 1,
  registers: {
    holding: { 0: 230, 1: 52 },
  },
})

emulator.addDevice({
  slaveId: 2,
  registers: {
    holding: { 0: 500, 1: 100 },
  },
})

// Start emulator
await emulator.start()

// Use with your driver tests
// ...

// Stop emulator
await emulator.stop()
```

## CLI Usage

The emulator can be used from the command line for quick testing:

### Basic Usage

```bash
# Start with config file
ya-modbus-emulator --config config.yaml

# Or specify parameters directly
ya-modbus-emulator --transport rtu --port /dev/ttyUSB0 --slave-id 1
```

### Command Line Options

```
Options:
  -c, --config <file>      Configuration file (YAML or JSON)
  -t, --transport <type>   Transport type: tcp|rtu|memory
  -p, --port <port>        TCP port number or serial port path
  -H, --host <host>        TCP host address (default: 0.0.0.0)
  -b, --baud-rate <rate>   Serial baud rate (default: 9600)
  --parity <type>          Serial parity: none|even|odd (default: none)
  --no-lock                Disable serial port locking (enabled by default)
  -s, --slave-id <id>      Slave ID (required if no config file)
  -v, --verbose            Enable verbose logging
  -q, --quiet              Suppress all output except errors
  --log-requests           Log all Modbus requests/responses
  -V, --version            output the version number
  -h, --help               display help for command
```

### Configuration Files

Create a YAML or JSON configuration file to define devices and behaviors:

**Basic TCP Example** (`basic-tcp.yaml`):

```yaml
transport:
  type: tcp
  host: 0.0.0.0
  port: 502

devices:
  - slaveId: 1
    registers:
      holding:
        0: 230 # Voltage * 10 = 23.0V
        1: 52 # Current * 10 = 5.2A
```

**Basic RTU Example** (`basic-rtu.yaml`):

```yaml
transport:
  type: rtu
  port: /dev/ttyUSB0
  baudRate: 9600
  parity: none

devices:
  - slaveId: 1
    registers:
      holding:
        0: 230 # Voltage * 10 = 23.0V
        1: 52 # Current * 10 = 5.2A
```

**Power Meter with Timing** (`power-meter.yaml`):

```yaml
transport:
  type: rtu
  port: /dev/ttyUSB0

devices:
  - slaveId: 1
    registers:
      holding:
        0: 2300 # Voltage * 10 = 230.0V
        1: 52 # Current * 10 = 5.2A
        2: 11960 # Power = 1196W
    timing:
      pollingInterval: 10
      commandDetectionDelay: [3, 8]
      processingDelay: [2, 5]
      perRegisterDelay: 0.1
```

**Multiple Devices** (`multi-device.yaml`):

```yaml
transport:
  type: rtu
  port: /dev/ttyUSB0

devices:
  - slaveId: 1
    registers:
      holding: { 0: 100, 1: 200 }
  - slaveId: 2
    registers:
      holding: { 0: 300, 1: 400 }
  - slaveId: 3
    registers:
      holding: { 0: 500, 1: 600 }
```

See `examples/config-files/` for more examples.

### Testing with Virtual Serial Ports

For testing without physical hardware, create virtual serial port pairs:

**Linux/macOS** (using socat):

```bash
# Terminal 1: Create virtual serial port pair
socat -d -d pty,raw,echo=0 pty,raw,echo=0
# Note the output: /dev/pts/3 <-> /dev/pts/4

# Terminal 2: Start emulator on first port (disable locking for virtual ports)
ya-modbus-emulator --transport rtu --port /dev/pts/3 --slave-id 1 --no-lock

# Terminal 3: Run your driver tests against second port
node test-driver.js --port /dev/pts/4
```

> **Note:** Virtual serial ports created by `socat` don't properly support exclusive locking.
> Use `--no-lock` flag or set `lock: false` in config files when using virtual ports.

**Windows** (using com0com):

1. Install [com0com](https://sourceforge.net/projects/com0com/)
2. Create a pair: COM10 <-> COM11
3. Start emulator: `ya-modbus-emulator --transport rtu --port COM10 --slave-id 1 --no-lock`
4. Run tests: `node test-driver.js --port COM11`

**Troubleshooting:**

If you encounter `Error: Resource temporarily unavailable Cannot lock port`:

- Add `--no-lock` flag to the CLI command, OR
- Set `lock: false` in your config file's transport section

This error occurs with virtual serial ports (socat PTYs, com0com) that don't properly reset
exclusive locks. For production use with real serial hardware, keep locking enabled (default).

See `examples/virtual-serial-test.md` for detailed virtual serial port testing guide.

## Configuration

### Timing Behaviors

Simulate realistic device response times:

```typescript
emulator.addDevice({
  slaveId: 1,
  timing: {
    pollingInterval: 10, // Device checks for commands every 10ms
    commandDetectionDelay: [3, 8], // 3-8ms to notice command
    processingDelay: [2, 5], // 2-5ms to process
    perRegisterDelay: 0.1, // 0.1ms per register
  },
})
```

### Register Constraints

> **🚧 Planned for v0.2.0**: Define forbidden ranges and batch size limits

```typescript
// Coming in v0.2.0
emulator.addDevice({
  slaveId: 1,
  constraints: {
    maxReadRegisters: 80,
    maxWriteRegisters: 50,
    forbiddenReadRanges: [{ type: 'holding', start: 100, end: 199, reason: 'Protected' }],
  },
})
```

### Error Simulation

> **🚧 Planned for v0.2.0**: Inject errors for testing error handling

```typescript
// Coming in v0.2.0
emulator.addDevice({
  slaveId: 1,
  errors: {
    timeoutProbability: 0.05, // 5% timeout rate
    crcErrorProbability: 0.01, // 1% CRC error rate
  },
})
```

## License

GPL-3.0-or-later
