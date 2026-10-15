# @ya-modbus/emulator

Software Modbus device emulator for testing device drivers without physical hardware.

## Features

- **Realistic device simulation**: Mimic the timing characteristics of actual devices
- **Test acceleration**: Enable fast, deterministic testing without hardware
- **Edge case coverage**: Exception responses for unsupported function codes and, except on RTU, unknown slave IDs
- **Multiple transports**: TCP, RTU (virtual/real serial ports), and in-memory
- **Function codes**: Read and write holding registers and coils, read input registers and discrete inputs (see [Supported Function Codes](#supported-function-codes))

## Installation

```bash
npm install @ya-modbus/emulator
```

Or run the CLI without installing:

```bash
npx ya-modbus-emulator --help
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
  -V, --version            output the version number
  -h, --help               display help for command
```

### Verbose Logging

Enable verbose logging to see detailed Modbus operations for debugging and testing:

**CLI:**

```bash
# With config file
ya-modbus-emulator --config config.yaml --verbose

# Or directly
ya-modbus-emulator --transport rtu --port /dev/ttyUSB0 --slave-id 1 --verbose
```

**Programmatic:**

```typescript
const emulator = new ModbusEmulator({
  transport: 'memory',
  verbose: true,
})
```

**Output Format:**

```
[VERBOSE] READ slave=1 func=0x03 addr=0x0000 count=2 values=[0x1234, 0x5678]
[VERBOSE] WRITE slave=1 func=0x06 addr=0x0005 count=1 values=[0x9ABC]
[VERBOSE] WRITE slave=2 func=0x10 addr=0x0010 count=3 values=[0xAABB, 0xCCDD, 0xEEFF]
```

On the TCP transport, a client connection that fails, for example because the client resets it, is logged as `[VERBOSE] ERROR TCP socket: read ECONNRESET`. The emulator keeps serving.

Each log entry includes:

- **Operation type**: READ or WRITE
- **Slave ID**: Which device handled the request
- **Function code**: Modbus function (0x01=Read Coils, 0x02=Read Discrete Inputs, 0x03=Read Holding, 0x04=Read Input, 0x05=Write Single Coil, 0x06=Write Single, 0x0F=Write Multiple Coils, 0x10=Write Multiple)
- **Starting address**: Register or coil address in hexadecimal
- **Register count**: Number of registers or coils accessed
- **Values**: Register values in hexadecimal. A coil or discrete input is 0x0001 (on) or 0x0000 (off)

Verbose logging is useful for:

- **E2E testing**: Verify exact data flow in integration tests
- **Driver development**: Debug communication with emulated devices
- **Protocol validation**: Ensure correct Modbus message formatting

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

## Supported Function Codes

The emulator answers these function codes on every transport (memory, TCP and RTU):

| Code | Function                 | Reads or writes                           |
| ---- | ------------------------ | ----------------------------------------- |
| 0x01 | Read Coils               | `coils` (up to 2000 per request)          |
| 0x02 | Read Discrete Inputs     | `discreteInputs` (up to 2000 per request) |
| 0x03 | Read Holding Registers   | `holding`                                 |
| 0x04 | Read Input Registers     | `input`                                   |
| 0x05 | Write Single Coil        | `coils`                                   |
| 0x06 | Write Single Register    | `holding`                                 |
| 0x0F | Write Multiple Coils     | `coils` (up to 1968 per request)          |
| 0x10 | Write Multiple Registers | `holding`                                 |

A coil or discrete input that is not configured reads as off. Discrete inputs are read-only. All other function codes are not supported, for example Read Device Identification (0x2B).

Only the memory transport checks the limits of the coil requests (see the exception codes below). On the TCP and RTU transports `modbus-serial` splits the request into single-coil requests (see [Known Limitations](#known-limitations)) and does not check them. For example, a Write Single Coil with a value other than 0xFF00 switches the coil off.

The emulator cannot serve some requests. The response depends on the transport:

| Request                                                | Memory transport | TCP transport  | RTU transport                     |
| ------------------------------------------------------ | ---------------- | -------------- | --------------------------------- |
| Any other function code, for example 0x2B              | Exception 0x01   | Exception 0x01 | Exception 0x01                    |
| Read or write request to a slave ID that has no device | Exception 0x0B   | Exception 0x0B | No response, the client times out |

The RTU transport behaves like a slave on a serial line, which ignores a request for an address that is not its own. The TCP transport behaves like a Modbus TCP gateway, which answers with exception 0x0B when the target device does not respond.

On the TCP and RTU transports, `modbus-serial` answers some requests itself, for every slave ID, also for one that has no device: a function code that it does not handle gets exception 0x01, and a read with a quantity of 0 gets exception 0x02.

### Exception Codes

| Code | Name                                    | Returned when                                                                                                                                                                   |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0x01 | Illegal Function                        | The function code is not supported                                                                                                                                              |
| 0x02 | Illegal Data Address                    | TCP and RTU: modbus-serial rejects a read request with a quantity of 0. Memory transport: a coil request goes past address 65535                                                |
| 0x03 | Illegal Data Value                      | All transports: a register write goes past address 65535. Memory transport: the request is too short for its function code, or the write data is shorter than its quantity says |
| 0x04 | Slave Device Failure                    | TCP and RTU: a read of more than 125 registers, or a coil request that goes past address 65535                                                                                  |
| 0x0B | Gateway Target Device Failed to Respond | Memory and TCP transports: the request is for a slave ID that has no device                                                                                                     |

The memory transport also answers with exception 0x03 for a coil request outside the limits in the table of function codes, and for a Write Single Coil with a value other than 0xFF00 or 0x0000.

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

#### Pause after another slave

Some meters on a shared RS-485 bus do not answer a request that comes too soon after another meter answered. With `minGapAfterOtherSlave` an emulated device behaves like this:

```typescript
emulator.addDevice({
  slaveId: 2,
  timing: {
    minGapAfterOtherSlave: 50, // ignore a request that comes less than 50 ms after another slave answered
  },
})
```

The pause is counted from the moment the emulator answered another slave on the same emulator. The device does not answer a request that comes sooner, and the client runs into its timeout. A request right after the device's own answer, or the first request, is answered as usual. On the memory transport, `sendRequest()` never resolves for an ignored request.

### Register Constraints

- Register addresses and register values are 16-bit unsigned numbers (0-65535). A device configuration with a holding or input register outside this range throws an error when the device is added.
- A register that is not configured reads as 0.
- A write to an address in range sets the register, also when it was not configured.

### Error Simulation

The emulator has no option to inject CRC errors or exceptions. Exceptions are the responses to requests that it cannot serve (see [Supported Function Codes](#supported-function-codes)). A client times out on a request that the device ignores (see [Pause after another slave](#pause-after-another-slave)), and on RTU on a request to a slave ID that has no device.

## Known Limitations

### modbus-serial read callbacks

The TCP and RTU transports use `ServerTCP` and `ServerSerial` from `modbus-serial` (`^8.0.25`). Its types allow the multi-register read functions of the service vector (`getMultipleHoldingRegisters`, `getMultipleInputRegisters`) to return a Promise. At run time `modbus-serial` uses the return value of such a function as an array. It does not await a Promise, so the client receives exception 0x04 (Slave Device Failure).

For this reason all read functions of the service vector in `src/transports/service-vector.ts`, which the TCP and RTU transports share, use the callback style (a `cb` parameter), not Promises. `src/transports/tcp.async-compat.test.ts` and `src/transports/rtu.async-compat.test.ts` check this.

**Impact:** This is an internal detail. It does not change the public API. Keep the callback style when you change these read functions.

See also: [#303](https://github.com/groupsky/ya-modbus/issues/303) and the related upstream report [yaacov/node-modbus-serial#548](https://github.com/yaacov/node-modbus-serial/issues/548).

### modbus-serial reads and writes coils one by one

`modbus-serial` handles a request for several coils or discrete inputs bit by bit. For Read Coils, Read Discrete Inputs and Write Multiple Coils it calls the service vector once per coil, and the service vector sends one single-coil request to the emulator for each of them. Write Multiple Coils is a series of Write Single Coil requests.

**Impact:** On the TCP and RTU transports a request for N coils is handled as N requests. Each of them gets the timing delays of a device (see [Timing Behaviors](#timing-behaviors)), but they start together, so the delay of the whole request is about the delay of one request. `perRegisterDelay` is charged once for each coil request, not N times for the whole request as on the memory transport. Verbose logging prints one line for each coil. A Write Multiple Coils request that fails for some of its coils, for example one that goes past address 65535, still writes the other coils.

## License

GPL-3.0-or-later
