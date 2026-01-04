# @ya-modbus/driver-or-we-516

ORNO OR-WE-516 3-Phase Energy Meter driver for ya-modbus.

## Device Information

- **Manufacturer**: ORNO
- **Model**: OR-WE-516
- **Type**: 3-Phase Energy Meter with RS-485, 80A, MID
- **Communication**: Modbus RTU
- **Default Settings**:
  - Address: 1
  - Baud rate: 9600
  - Parity: Odd
  - Stop bits: 1
  - Data bits: 8

## Installation

```bash
npm install @ya-modbus/driver-or-we-516
```

## Usage

```typescript
import { createDriver } from '@ya-modbus/driver-or-we-516'
import { ModbusRTU } from '@ya-modbus/transport-rtu'

// Create transport
const transport = new ModbusRTU({
  path: '/dev/ttyUSB0',
  baudRate: 9600,
  parity: 'odd',
})

// Create driver
const driver = await createDriver({
  transport,
  slaveId: 1,
})

// Read voltages and frequency
const values = await driver.readDataPoints(['voltage_l1', 'voltage_l2', 'voltage_l3', 'frequency'])
console.log(values)
// { voltage_l1: 230.5, voltage_l2: 231.2, voltage_l3: 229.8, frequency: 50.01 }

// Read total active energy
const energy = await driver.readDataPoint('active_energy_total')
console.log(`Total energy: ${energy} kWh`)

// Read all power values
const power = await driver.readDataPoints([
  'active_power_total',
  'reactive_power_total',
  'apparent_power_total',
  'power_factor_total',
])
console.log(power)
```

### Using Default Configuration

The driver exports a `DEFAULT_CONFIG` constant with factory-default device settings:

```typescript
import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-or-we-516'
import { ModbusRTU } from '@ya-modbus/transport-rtu'

// Use default configuration for connecting to factory-default device
const transport = new ModbusRTU({
  path: '/dev/ttyUSB0',
  baudRate: DEFAULT_CONFIG.baudRate, // 9600
  parity: DEFAULT_CONFIG.parity, // 'odd'
  dataBits: DEFAULT_CONFIG.dataBits, // 8
  stopBits: DEFAULT_CONFIG.stopBits, // 1
})

const driver = await createDriver({
  transport,
  slaveId: DEFAULT_CONFIG.defaultAddress, // 1
})
```

## Data Points

### Device Information

| ID                 | Name             | Type    | Access     | Description                        |
| ------------------ | ---------------- | ------- | ---------- | ---------------------------------- |
| `serial_number`    | Serial Number    | integer | Read-only  | Device serial number               |
| `device_address`   | Device Address   | integer | Read-write | Modbus address (1-247)             |
| `baud_rate`        | Baud Rate        | enum    | Read-write | Baud rate (1200, 2400, 4800, 9600) |
| `software_version` | Software Version | float   | Read-only  | Firmware version                   |
| `hardware_version` | Hardware Version | float   | Read-only  | Hardware revision                  |
| `ct_rate`          | CT Rate          | integer | Read-only  | Current transformer ratio          |
| `s0_output_rate`   | S0 Output Rate   | float   | Read-write | S0 pulse output rate (imp/kWh)     |
| `cycle_time`       | Cycle Time       | integer | Read-write | Measurement cycle time (0-65535)   |

### Real-time Measurements

| ID                     | Name                 | Type  | Unit | Access    | Description                  |
| ---------------------- | -------------------- | ----- | ---- | --------- | ---------------------------- |
| `voltage_l1`           | L1 Voltage           | float | V    | Read-only | Phase L1 voltage             |
| `voltage_l2`           | L2 Voltage           | float | V    | Read-only | Phase L2 voltage             |
| `voltage_l3`           | L3 Voltage           | float | V    | Read-only | Phase L3 voltage             |
| `frequency`            | Grid Frequency       | float | Hz   | Read-only | Grid frequency               |
| `current_l1`           | L1 Current           | float | A    | Read-only | Phase L1 current             |
| `current_l2`           | L2 Current           | float | A    | Read-only | Phase L2 current             |
| `current_l3`           | L3 Current           | float | A    | Read-only | Phase L3 current             |
| `active_power_total`   | Total Active Power   | float | W    | Read-only | Total active power           |
| `active_power_l1`      | L1 Active Power      | float | W    | Read-only | Phase L1 active power        |
| `active_power_l2`      | L2 Active Power      | float | W    | Read-only | Phase L2 active power        |
| `active_power_l3`      | L3 Active Power      | float | W    | Read-only | Phase L3 active power        |
| `reactive_power_total` | Total Reactive Power | float | VAr  | Read-only | Total reactive power         |
| `reactive_power_l1`    | L1 Reactive Power    | float | VAr  | Read-only | Phase L1 reactive power      |
| `reactive_power_l2`    | L2 Reactive Power    | float | VAr  | Read-only | Phase L2 reactive power      |
| `reactive_power_l3`    | L3 Reactive Power    | float | VAr  | Read-only | Phase L3 reactive power      |
| `apparent_power_total` | Total Apparent Power | float | VA   | Read-only | Total apparent power         |
| `apparent_power_l1`    | L1 Apparent Power    | float | VA   | Read-only | Phase L1 apparent power      |
| `apparent_power_l2`    | L2 Apparent Power    | float | VA   | Read-only | Phase L2 apparent power      |
| `apparent_power_l3`    | L3 Apparent Power    | float | VA   | Read-only | Phase L3 apparent power      |
| `power_factor_total`   | Total Power Factor   | float | -    | Read-only | Total power factor (-1 to 1) |
| `power_factor_l1`      | L1 Power Factor      | float | -    | Read-only | Phase L1 power factor        |
| `power_factor_l2`      | L2 Power Factor      | float | -    | Read-only | Phase L2 power factor        |
| `power_factor_l3`      | L3 Power Factor      | float | -    | Read-only | Phase L3 power factor        |

### Energy Counters

| ID                           | Name                       | Type  | Unit  | Access    | Description              |
| ---------------------------- | -------------------------- | ----- | ----- | --------- | ------------------------ |
| `active_energy_total`        | Total Active Energy        | float | kWh   | Read-only | Total active energy      |
| `active_energy_l1`           | L1 Total Active Energy     | float | kWh   | Read-only | Phase L1 active energy   |
| `active_energy_l2`           | L2 Total Active Energy     | float | kWh   | Read-only | Phase L2 active energy   |
| `active_energy_l3`           | L3 Total Active Energy     | float | kWh   | Read-only | Phase L3 active energy   |
| `active_energy_forward`      | Forward Active Energy      | float | kWh   | Read-only | Forward (import) active  |
| `active_energy_forward_l1`   | L1 Forward Active Energy   | float | kWh   | Read-only | L1 forward active        |
| `active_energy_forward_l2`   | L2 Forward Active Energy   | float | kWh   | Read-only | L2 forward active        |
| `active_energy_forward_l3`   | L3 Forward Active Energy   | float | kWh   | Read-only | L3 forward active        |
| `active_energy_reverse`      | Reverse Active Energy      | float | kWh   | Read-only | Reverse (export) active  |
| `active_energy_reverse_l1`   | L1 Reverse Active Energy   | float | kWh   | Read-only | L1 reverse active        |
| `active_energy_reverse_l2`   | L2 Reverse Active Energy   | float | kWh   | Read-only | L2 reverse active        |
| `active_energy_reverse_l3`   | L3 Reverse Active Energy   | float | kWh   | Read-only | L3 reverse active        |
| `reactive_energy_total`      | Total Reactive Energy      | float | kVArh | Read-only | Total reactive energy    |
| `reactive_energy_l1`         | L1 Reactive Energy         | float | kVArh | Read-only | Phase L1 reactive energy |
| `reactive_energy_l2`         | L2 Reactive Energy         | float | kVArh | Read-only | Phase L2 reactive energy |
| `reactive_energy_l3`         | L3 Reactive Energy         | float | kVArh | Read-only | Phase L3 reactive energy |
| `reactive_energy_forward`    | Forward Reactive Energy    | float | kVArh | Read-only | Forward reactive energy  |
| `reactive_energy_forward_l1` | L1 Forward Reactive Energy | float | kVArh | Read-only | L1 forward reactive      |
| `reactive_energy_forward_l2` | L2 Forward Reactive Energy | float | kVArh | Read-only | L2 forward reactive      |
| `reactive_energy_forward_l3` | L3 Forward Reactive Energy | float | kVArh | Read-only | L3 forward reactive      |
| `reactive_energy_reverse`    | Reverse Reactive Energy    | float | kVArh | Read-only | Reverse reactive energy  |
| `reactive_energy_reverse_l1` | L1 Reverse Reactive Energy | float | kVArh | Read-only | L1 reverse reactive      |
| `reactive_energy_reverse_l2` | L2 Reverse Reactive Energy | float | kVArh | Read-only | L2 reverse reactive      |
| `reactive_energy_reverse_l3` | L3 Reverse Reactive Energy | float | kVArh | Read-only | L3 reverse reactive      |

## Register Mapping

| Range         | Registers  | Type    | Description                    |
| ------------- | ---------- | ------- | ------------------------------ |
| 0x0000-0x003B | 60 (120 B) | Holding | Device info + real-time values |
| 0x0100-0x012E | 48 (96 B)  | Holding | Energy counters                |

All float values are IEEE 754 single-precision (32-bit) big-endian.

## Configuration

### Change Device Address

```typescript
// Change address from 1 to 5
await driver.writeDataPoint('device_address', 5)
```

### Change Baud Rate

```typescript
// Set baud rate to 4800
await driver.writeDataPoint('baud_rate', 4800)
```

### Configure S0 Pulse Output

```typescript
// Set S0 output rate (impulses per kWh)
await driver.writeDataPoint('s0_output_rate', 1000.0)
```

## License

GPL-3.0-or-later
