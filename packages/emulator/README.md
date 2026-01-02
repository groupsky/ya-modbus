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

```typescript
import { ModbusEmulator } from '@ya-modbus/emulator'

// Create emulator with TCP transport
const emulator = new ModbusEmulator({
  transport: 'tcp',
  port: 5502,
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

Define forbidden ranges and batch size limits:

```typescript
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

Inject errors for testing error handling:

```typescript
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
