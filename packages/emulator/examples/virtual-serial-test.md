# Testing Emulator with Virtual Serial Ports

This example demonstrates how to test the Modbus emulator using virtual serial ports, connecting it with a driver for integration testing.

## Prerequisites

### Linux/macOS - Install socat

```bash
# Ubuntu/Debian
sudo apt-get install socat

# macOS
brew install socat
```

### Windows - Install com0com

Download and install from: https://sourceforge.net/projects/com0com/

## Setup: Create Virtual Serial Port Pair

### Linux/macOS

```bash
# Create virtual serial port pair
socat -d -d pty,raw,echo=0,link=/tmp/vserial0 pty,raw,echo=0,link=/tmp/vserial1

# Output will show something like:
# PTY is /tmp/vserial0
# PTY is /tmp/vserial1
```

Keep this terminal open - it needs to stay running.

### Windows

Configure in com0com setup:

- CNCA0 → COM3
- CNCB0 → COM4

## Example: Emulator + Driver Test

### Terminal 1: Start Emulator

```typescript
// emulator-test.ts
import { ModbusEmulator } from '@ya-modbus/emulator'

const emulator = new ModbusEmulator({
  transport: 'rtu',
  port: '/tmp/vserial0', // Linux/macOS, use COM3 on Windows
  baudRate: 9600,
  parity: 'none',
  lock: false, // Disable locking for virtual ports (socat PTYs)
})

// Add a simulated power meter device
emulator.addDevice({
  slaveId: 1,
  registers: {
    holding: {
      0: 230, // Voltage * 10 = 23.0V
      1: 52, // Current * 10 = 5.2A
      2: 1196, // Power = 119.6W
      10: 12345, // Serial number
    },
    input: {
      0: 500, // Temperature * 10 = 50.0°C
      1: 60, // Humidity = 60%
    },
  },
  timing: {
    pollingInterval: 10, // Device polls every 10ms
    processingDelay: [2, 5], // 2-5ms processing time
    perRegisterDelay: 0.1, // 0.1ms per register
  },
})

await emulator.start()
console.log('Emulator running on /tmp/vserial0')
console.log('Press Ctrl+C to stop')

process.on('SIGINT', async () => {
  await emulator.stop()
  process.exit(0)
})
```

Run with:

```bash
npx tsx emulator-test.ts
```

### Terminal 2: Test with Driver

```typescript
// driver-test.ts
import ModbusRTU from 'modbus-serial'

const client = new ModbusRTU()

async function testDriver(): Promise<void> {
  // Connect to the other end of the virtual serial port
  await client.connectRTU('/tmp/vserial1', {
    baudRate: 9600,
    parity: 'none',
  })

  client.setID(1)

  // Read voltage, current, power
  const result = await client.readHoldingRegisters(0, 3)
  console.log('Holding registers 0-2:')
  console.log('  Voltage:', result.data[0] / 10, 'V')
  console.log('  Current:', result.data[1] / 10, 'A')
  console.log('  Power:', result.data[2] / 10, 'W')

  // Read temperature and humidity
  const inputResult = await client.readInputRegisters(0, 2)
  console.log('Input registers 0-1:')
  console.log('  Temperature:', inputResult.data[0] / 10, '°C')
  console.log('  Humidity:', inputResult.data[1], '%')

  // Read serial number
  const serialResult = await client.readHoldingRegisters(10, 1)
  console.log('Serial number:', serialResult.data[0])

  client.close(() => {
    console.log('Connection closed')
  })
}

testDriver().catch(console.error)
```

Run with:

```bash
npx tsx driver-test.ts
```

### Expected Output

```
Holding registers 0-2:
  Voltage: 23 V
  Current: 5.2 A
  Power: 119.6 W
Input registers 0-1:
  Temperature: 50 °C
  Humidity: 60 %
Serial number: 12345
Connection closed
```

## Using with @ya-modbus Drivers

### Example: Testing with an existing driver

```typescript
// test-with-driver.ts
import { ModbusEmulator } from '@ya-modbus/emulator'
import { SomeDeviceDriver } from '@ya-modbus/driver-somedevice'

// Start emulator
const emulator = new ModbusEmulator({
  transport: 'rtu',
  port: '/tmp/vserial0',
  baudRate: 9600,
})

// Configure device to match driver expectations
emulator.addDevice({
  slaveId: 1,
  registers: {
    // Set up registers according to driver's data point map
    holding: {
      0: 230, // Match driver's expected register layout
      1: 52,
    },
  },
})

await emulator.start()

// Initialize driver on paired port
const driver = new SomeDeviceDriver({
  transport: 'rtu',
  port: '/tmp/vserial1',
  baudRate: 9600,
  slaveId: 1,
})

// Run driver tests
const data = await driver.read(['voltage', 'current'])
console.log('Driver read:', data)

expect(data.voltage).toBe(23.0)
expect(data.current).toBe(5.2)

await driver.close()
await emulator.stop()
```

## Automated Testing with Virtual Ports

For automated tests, create and clean up virtual ports programmatically:

```typescript
// test/integration/emulator-driver.test.ts
import { spawn, ChildProcess } from 'child_process'
import { ModbusEmulator } from '@ya-modbus/emulator'

describe('Emulator with Driver Integration', () => {
  let emulator: ModbusEmulator
  let socat: ChildProcess

  beforeAll(async () => {
    // Create virtual serial port pair (Linux/macOS only)
    socat = spawn('socat', [
      '-d',
      '-d',
      'pty,raw,echo=0,link=/tmp/test-vserial0',
      'pty,raw,echo=0,link=/tmp/test-vserial1',
    ])

    // Wait for ports to be ready
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Start emulator
    emulator = new ModbusEmulator({
      transport: 'rtu',
      port: '/tmp/test-vserial0',
      baudRate: 9600,
    })

    emulator.addDevice({
      slaveId: 1,
      registers: { holding: { 0: 100 } },
    })

    await emulator.start()
  })

  afterAll(async () => {
    await emulator.stop()
    socat.kill()
  })

  it('should communicate with driver over virtual serial port', async () => {
    const ModbusRTU = (await import('modbus-serial')).default
    const client = new ModbusRTU()

    await client.connectRTU('/tmp/test-vserial1', { baudRate: 9600 })
    client.setID(1)

    const result = await client.readHoldingRegisters(0, 1)
    expect(result.data[0]).toBe(100)

    client.close(() => {
      /* done */
    })
  })
})
```

## Troubleshooting

### Port Not Found

```bash
# Check if socat is running
ps aux | grep socat

# Verify port exists
ls -l /tmp/vserial*
```

### Permission Denied

```bash
# Add user to dialout group (Linux)
sudo usermod -a -G dialout $USER

# Or set permissions on specific port
sudo chmod 666 /tmp/vserial0
```

### Cannot Lock Port Error

```
Error: Resource temporarily unavailable Cannot lock port
```

**Cause:** Virtual serial ports created by `socat` don't properly support exclusive locking (TIOCEXCL).

**Solution:** Disable port locking for virtual ports:

```typescript
// In code
const emulator = new ModbusEmulator({
  transport: 'rtu',
  port: '/tmp/vserial0',
  lock: false, // Add this
})
```

```bash
# Or via CLI
ya-modbus-emulator --transport rtu --port /tmp/vserial0 --slave-id 1 --no-lock
```

```yaml
# Or in config file
transport:
  type: rtu
  port: /tmp/vserial0
  lock: false
```

> **Important:** Only disable locking for virtual ports. Keep it enabled (default) for real serial hardware in production.

### CRC Errors

- Verify both ends use same baud rate
- Check parity settings match
- Ensure stop bits configuration matches

### Timeout Errors

- Increase client timeout setting
- Check emulator timing configuration
- Verify slave ID matches
- Monitor serial traffic with `interceptty` or `tio`

## Monitoring Serial Traffic

### Using interceptty (Linux)

```bash
# Install
sudo apt-get install interceptty

# Monitor traffic
interceptty /tmp/vserial0 /tmp/vserial-monitor

# Use /tmp/vserial-monitor in emulator instead
# Traffic will be logged to terminal
```

### Using tio

```bash
# Install
brew install tio  # macOS
sudo apt-get install tio  # Linux

# Monitor port
tio /tmp/vserial0 -b 9600 -p none
```

## Best Practices

1. **Use unique port names** for parallel tests to avoid conflicts
2. **Clean up ports** after tests (kill socat, remove symlinks)
3. **Add delays** after creating ports to ensure they're ready
4. **Handle timeouts** gracefully in tests
5. **Use realistic timing** in emulator to match actual devices
6. **Test error scenarios** (CRC errors, timeouts, exceptions)
7. **Verify register values** match driver expectations

## Next Steps

- See `examples/cli-usage.md` for CLI-based emulator usage
- See `examples/config-files/` for YAML configuration examples
- Read IMPLEMENTATION.md for complete feature documentation
