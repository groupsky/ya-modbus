# ya-modbus-driver-ex9em

NOARK Ex9EM Energy Meter driver for ya-modbus

## Features

- Read voltage, current, and grid frequency
- Read active, reactive, and apparent power
- Read power factor
- Read total active and reactive energy consumption
- Single-transaction batch reading for optimal performance
- Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install ya-modbus-driver-ex9em
```

## Usage

```typescript
import { createDriver, DEFAULT_CONFIG } from 'ya-modbus-driver-ex9em'
import { createRTUTransport } from '@ya-modbus/transport-rtu'

// Create transport with factory default settings
const transport = await createRTUTransport({
  port: '/dev/ttyUSB0',
  baudRate: DEFAULT_CONFIG.baudRate,
  parity: DEFAULT_CONFIG.parity,
  dataBits: DEFAULT_CONFIG.dataBits,
  stopBits: DEFAULT_CONFIG.stopBits,
  slaveId: DEFAULT_CONFIG.defaultAddress,
})

// Create driver
const driver = await createDriver({ transport })

// Read single data point
const voltage = await driver.readDataPoint('voltage')
console.log(`Voltage: ${voltage}V`)

// Read multiple data points (single transaction)
const values = await driver.readDataPoints([
  'voltage',
  'current',
  'active_power',
  'total_active_energy',
])
console.log(values)
```

## Available Data Points

| ID                      | Name                  | Type    | Unit  | Access | Description                                           |
| ----------------------- | --------------------- | ------- | ----- | ------ | ----------------------------------------------------- |
| `voltage`               | Voltage               | float   | V     | r      | Line voltage in volts                                 |
| `current`               | Current               | float   | A     | r      | Line current in amperes                               |
| `frequency`             | Grid Frequency        | float   | Hz    | r      | Grid frequency in hertz                               |
| `active_power`          | Active Power          | integer | W     | r      | Active power in watts                                 |
| `reactive_power`        | Reactive Power        | integer | VAr   | r      | Reactive power in volt-amperes reactive               |
| `apparent_power`        | Apparent Power        | integer | VA    | r      | Apparent power in volt-amperes                        |
| `power_factor`          | Power Factor          | float   |       | r      | Power factor (0.000-1.000, dimensionless)             |
| `total_active_energy`   | Total Active Energy   | float   | kWh   | r      | Total active energy consumption                       |
| `total_reactive_energy` | Total Reactive Energy | float   | kVArh | r      | Total reactive energy                                 |
| `device_address`        | Device Address        | integer |       | rw     | Modbus address (1-247), changes after device restart  |
| `baud_rate`             | Baud Rate             | enum    |       | rw     | Communication baud rate, changes after device restart |
| `password`              | Password              | integer |       | w      | Device password (0-4294967295) for configuration      |

## Factory Default Configuration

```typescript
{
  baudRate: 9600,
  parity: 'even',
  dataBits: 8,
  stopBits: 1,
  defaultAddress: 1
}
```

## Supported Configuration

- **Baud rates**: 1200, 2400, 4800, 9600 bps
- **Parity**: even, none
- **Data bits**: 8
- **Stop bits**: 1
- **Slave address**: 1-247 (standard Modbus range)

## Configuration Changes and Password Protection

### Password Workflow

According to the device documentation, configuration changes (`device_address` and `baud_rate`) are protected by a password mechanism:

1. **Default password**: `0` (32-bit value at register 0x002C)
2. **Password reset procedure**:
   - Write password to register 0x002C using Modbus function code 0x28 (vendor-specific)
   - Within 10 seconds, write the new configuration value
   - Changes take effect after device restart

**Example workflow for changing device address:**

```
Step 1: Reset password (function code 0x28)
  Send: 00 28 FE 01 00 02 04 00 00 00 00 [CRC16]

Step 2: Within 10 seconds, write new device address (e.g., 100)
  Send: 01 10 002B 0001 02 0064 [CRC16]

Step 3: Restart device for changes to take effect
```

**Important Notes:**

- The password mechanism uses Modbus function code 0x28, which is not part of the standard Modbus specification
- This driver provides access to the password register via `writeDataPoint('password', value)` but does not implement the full vendor-specific password workflow
- Configuration changes may work without the password workflow on some devices or firmware versions
- Always verify configuration changes have been applied after device restart
- Consult the official register map PDF for detailed protocol information

### Making Configuration Changes

```typescript
// Change device address (may require password workflow depending on device firmware)
await driver.writeDataPoint('device_address', 5)

// Change baud rate (may require password workflow depending on device firmware)
await driver.writeDataPoint('baud_rate', 4800)

// Note: Restart the device for changes to take effect
```

## Device Information

- **Manufacturer**: NOARK Electric
- **Model**: Ex9EM
- **Type**: Single-phase energy meter
- **Protocol**: Modbus RTU

## Documentation

Official register map is available in `docs/ex9em-1p-1m-80a-mo-mt-register-map.pdf`.

**Note**: This implementation is based on verified working code with actual devices. Some registers (frequency at 0x0002 and power_factor at 0x0006) are not documented in the official PDF but are confirmed to work on physical devices.

## License

GPL-3.0-or-later
