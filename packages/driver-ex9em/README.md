# @ya-modbus/driver-ex9em

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
npm install @ya-modbus/driver-ex9em
```

## Usage

<!-- embedme examples/example-rtu.ts -->

```ts
#!/usr/bin/env tsx
import { createRTUTransport } from '@ya-modbus/transport'

import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-ex9em'

const port = process.argv[2] ?? '/dev/ttyUSB0'
const slaveId = parseInt(process.argv[3] ?? String(DEFAULT_CONFIG.defaultAddress), 10)

// Create transport with factory default settings
const transport = await createRTUTransport({
  port,
  baudRate: DEFAULT_CONFIG.baudRate,
  parity: DEFAULT_CONFIG.parity,
  dataBits: DEFAULT_CONFIG.dataBits,
  stopBits: DEFAULT_CONFIG.stopBits,
  slaveId,
  timeout: 1000,
})

try {
  // Create driver
  const driver = await createDriver({ transport })

  // Read single data point
  const voltage = await driver.readDataPoint('voltage')
  console.log(`Voltage: ${String(voltage)}V`)

  // Read multiple data points (single transaction)
  const values = await driver.readDataPoints([
    'voltage',
    'current',
    'active_power',
    'total_active_energy',
  ])
  console.log(values)

  // Change device address (requires device restart)
  await driver.writeDataPoint('device_address', 5)
  console.log('Device address changed to 5')

  // Change baud rate (requires device restart)
  await driver.writeDataPoint('baud_rate', 4800)
  console.log('Baud rate changed to 4800')
} finally {
  await transport.close()
}
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

## Factory Default Configuration

```json
{
  "baudRate": 9600,
  "parity": "even",
  "dataBits": 8,
  "stopBits": 1,
  "defaultAddress": 1
}
```

## Supported Configuration

- **Baud rates**: 1200, 2400, 4800, 9600 bps
- **Parity**: even, none
- **Data bits**: 8
- **Stop bits**: 1
- **Slave address**: 1-247 (standard Modbus range)

## Configuration Changes

<!-- embedme examples/example-rtu.ts#L36-L42 -->

```ts
// Change device address (requires device restart)
await driver.writeDataPoint('device_address', 5)
console.log('Device address changed to 5')

// Change baud rate (requires device restart)
await driver.writeDataPoint('baud_rate', 4800)
```

**Important:** According to the device documentation, configuration changes may require a password unlock mechanism using vendor-specific Modbus function code 0x28. This mechanism is not implemented in the driver. Configuration changes may work without it on some firmware versions, but YMMV. Consult the official register map PDF in `docs/` for details.

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
