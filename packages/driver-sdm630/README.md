# @ya-modbus/driver-sdm630

Eastron SDM630 3-phase energy meter driver for ya-modbus.

## Device Information

- **Manufacturer**: Eastron
- **Model**: SDM630 (3 phases + N, DIN rail, RS-485)
- **Communication**: Modbus RTU, input registers (function code 04), float32 big-endian, 2 registers per value
- **Default Settings**:
  - Address: 1
  - Baud rate: 9600
  - Parity: None
  - Stop bits: 1
  - Data bits: 8
- **Supported Settings**: baud rate 2400, 4800, 9600, 19200 or 38400; no parity with 1 or 2 stop bits, or even/odd parity with 1 stop bit; address 1 to 247

## Installation

```bash
npm install @ya-modbus/driver-sdm630
```

## Usage

```typescript
import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-sdm630'
import { createRTUTransport } from '@ya-modbus/transport'

const transport = await createRTUTransport({
  port: '/dev/ttyUSB0',
  baudRate: DEFAULT_CONFIG.baudRate,
  parity: DEFAULT_CONFIG.parity,
  dataBits: DEFAULT_CONFIG.dataBits,
  stopBits: DEFAULT_CONFIG.stopBits,
  slaveId: DEFAULT_CONFIG.defaultAddress,
})

const driver = await createDriver({ transport, slaveId: DEFAULT_CONFIG.defaultAddress })

const values = await driver.readDataPoints(['voltage_l1', 'active_power_total', 'frequency'])
console.log(values)
```

## Data Points

All data points are read-only and are read on every poll. Where the unit column has `-`, the value has no unit or `driver-types` has no unit for it: phase angles are in degrees and total apparent energy is in kVAh.

| ID                           | Register | Unit  | Description                                                                    |
| ---------------------------- | -------- | ----- | ------------------------------------------------------------------------------ |
| `voltage_l1`                 | 0x00     | V     | L1 voltage                                                                     |
| `voltage_l2`                 | 0x02     | V     | L2 voltage                                                                     |
| `voltage_l3`                 | 0x04     | V     | L3 voltage                                                                     |
| `current_l1`                 | 0x06     | A     | L1 current                                                                     |
| `current_l2`                 | 0x08     | A     | L2 current                                                                     |
| `current_l3`                 | 0x0A     | A     | L3 current                                                                     |
| `active_power_l1`            | 0x0C     | W     | L1 active power                                                                |
| `active_power_l2`            | 0x0E     | W     | L2 active power                                                                |
| `active_power_l3`            | 0x10     | W     | L3 active power                                                                |
| `apparent_power_l1`          | 0x12     | VA    | L1 apparent power                                                              |
| `apparent_power_l2`          | 0x14     | VA    | L2 apparent power                                                              |
| `apparent_power_l3`          | 0x16     | VA    | L3 apparent power                                                              |
| `reactive_power_l1`          | 0x18     | VAr   | L1 reactive power                                                              |
| `reactive_power_l2`          | 0x1A     | VAr   | L2 reactive power                                                              |
| `reactive_power_l3`          | 0x1C     | VAr   | L3 reactive power                                                              |
| `power_factor_l1`            | 0x1E     | -     | L1 power factor                                                                |
| `power_factor_l2`            | 0x20     | -     | L2 power factor                                                                |
| `power_factor_l3`            | 0x22     | -     | L3 power factor                                                                |
| `phase_angle_l1`             | 0x24     | -     | L1 phase angle (degrees)                                                       |
| `phase_angle_l2`             | 0x26     | -     | L2 phase angle (degrees)                                                       |
| `phase_angle_l3`             | 0x28     | -     | L3 phase angle (degrees)                                                       |
| `voltage_ln_average`         | 0x2A     | V     | Average L-N Voltage                                                            |
| `current_average`            | 0x2E     | A     | Average Line Current                                                           |
| `current_sum`                | 0x30     | A     | Sum of Line Currents                                                           |
| `active_power_total`         | 0x34     | W     | Total Active Power                                                             |
| `apparent_power_total`       | 0x38     | VA    | Total Apparent Power                                                           |
| `reactive_power_total`       | 0x3C     | VAr   | Total Reactive Power                                                           |
| `power_factor_total`         | 0x3E     | -     | Total Power Factor                                                             |
| `phase_angle_total`          | 0x42     | -     | Total phase angle (degrees)                                                    |
| `frequency`                  | 0x46     | Hz    | Grid Frequency                                                                 |
| `active_energy_forward`      | 0x48     | kWh   | Import Active Energy                                                           |
| `active_energy_reverse`      | 0x4A     | kWh   | Export Active Energy                                                           |
| `reactive_energy_forward`    | 0x4C     | kVArh | Import Reactive Energy                                                         |
| `reactive_energy_reverse`    | 0x4E     | kVArh | Export Reactive Energy                                                         |
| `apparent_energy_total`      | 0x50     | -     | Total apparent energy (kVAh)                                                   |
| `charge_total`               | 0x52     | Ah    | Total Charge                                                                   |
| `active_power_demand`        | 0x54     | W     | Total Active Power Demand                                                      |
| `active_power_demand_max`    | 0x56     | W     | Maximum total active power demand (the manual says VA, the real meter gives W) |
| `apparent_power_demand`      | 0x64     | VA    | Total Apparent Power Demand                                                    |
| `apparent_power_demand_max`  | 0x66     | VA    | Maximum Apparent Power Demand                                                  |
| `voltage_l1_l2`              | 0xC8     | V     | L1-L2 voltage                                                                  |
| `voltage_l2_l3`              | 0xCA     | V     | L2-L3 voltage                                                                  |
| `voltage_l3_l1`              | 0xCC     | V     | L3-L1 voltage                                                                  |
| `voltage_ll_average`         | 0xCE     | V     | Average L-L Voltage                                                            |
| `current_neutral`            | 0xE0     | A     | Neutral Current                                                                |
| `voltage_thd_l1`             | 0xEA     | %     | L1 voltage thd                                                                 |
| `voltage_thd_l2`             | 0xEC     | %     | L2 voltage thd                                                                 |
| `voltage_thd_l3`             | 0xEE     | %     | L3 voltage thd                                                                 |
| `current_thd_l1`             | 0xF0     | %     | L1 current thd                                                                 |
| `current_thd_l2`             | 0xF2     | %     | L2 current thd                                                                 |
| `current_thd_l3`             | 0xF4     | %     | L3 current thd                                                                 |
| `voltage_thd_ln_average`     | 0xF8     | %     | Average L-N Voltage THD                                                        |
| `current_thd_average`        | 0xFA     | %     | Average Current THD                                                            |
| `current_demand_l1`          | 0x102    | A     | L1 current demand                                                              |
| `current_demand_l2`          | 0x104    | A     | L2 current demand                                                              |
| `current_demand_l3`          | 0x106    | A     | L3 current demand                                                              |
| `current_demand_max_l1`      | 0x108    | A     | L1 maximum current demand                                                      |
| `current_demand_max_l2`      | 0x10A    | A     | L2 maximum current demand                                                      |
| `current_demand_max_l3`      | 0x10C    | A     | L3 maximum current demand                                                      |
| `voltage_thd_l1_l2`          | 0x14E    | %     | L1-L2 voltage thd                                                              |
| `voltage_thd_l2_l3`          | 0x150    | %     | L2-L3 voltage thd                                                              |
| `voltage_thd_l3_l1`          | 0x152    | %     | L3-L1 voltage thd                                                              |
| `voltage_thd_ll_average`     | 0x154    | %     | Average L-L Voltage THD                                                        |
| `active_energy_total`        | 0x156    | kWh   | Total Active Energy                                                            |
| `reactive_energy_total`      | 0x158    | kVArh | Total Reactive Energy                                                          |
| `active_energy_forward_l1`   | 0x15A    | kWh   | L1 import active energy                                                        |
| `active_energy_forward_l2`   | 0x15C    | kWh   | L2 import active energy                                                        |
| `active_energy_forward_l3`   | 0x15E    | kWh   | L3 import active energy                                                        |
| `active_energy_reverse_l1`   | 0x160    | kWh   | L1 export active energy                                                        |
| `active_energy_reverse_l2`   | 0x162    | kWh   | L2 export active energy                                                        |
| `active_energy_reverse_l3`   | 0x164    | kWh   | L3 export active energy                                                        |
| `active_energy_l1`           | 0x166    | kWh   | L1 total active energy                                                         |
| `active_energy_l2`           | 0x168    | kWh   | L2 total active energy                                                         |
| `active_energy_l3`           | 0x16A    | kWh   | L3 total active energy                                                         |
| `reactive_energy_forward_l1` | 0x16C    | kVArh | L1 import reactive energy                                                      |
| `reactive_energy_forward_l2` | 0x16E    | kVArh | L2 import reactive energy                                                      |
| `reactive_energy_forward_l3` | 0x170    | kVArh | L3 import reactive energy                                                      |
| `reactive_energy_reverse_l1` | 0x172    | kVArh | L1 export reactive energy                                                      |
| `reactive_energy_reverse_l2` | 0x174    | kVArh | L2 export reactive energy                                                      |
| `reactive_energy_reverse_l3` | 0x176    | kVArh | L3 export reactive energy                                                      |
| `reactive_energy_l1`         | 0x178    | kVArh | L1 total reactive energy                                                       |
| `reactive_energy_l2`         | 0x17A    | kVArh | L2 total reactive energy                                                       |
| `reactive_energy_l3`         | 0x17C    | kVArh | L3 total reactive energy                                                       |

"Import" is the `forward` energy and "export" is the `reverse` energy. Ids follow `driver-or-we-516` where the meaning is the same.

The driver reads the registers in at most 6 requests per poll: 0x00 (80 registers), 0x50 (8), 0x64 (4), 0xC8 (8), 0xE0 (46) and 0x14E (48). The homy Modbus reader reads these same blocks from a real meter; the gaps inside them read without errors. The meter allows at most 80 registers per request. A block is read only when one of its data points is requested.

Not included: neutral current demand and its maximum (0x68, 0x6A) and the settings (holding registers: demand period, system type, baud rate, parity and stop bits, address).

## Notes

- **Average line current is at 0x2E.** Register 0x2C is not in the manual and returns 0 on a real meter.
- **Line-to-line voltage THD (0x14E to 0x154) returns 0** on the meter of the owner. The data points are kept so every value the homy Modbus reader publishes is also published here.
- **0x56 is the maximum of the power demand in W.** The manual table says VA, which is probably a mistake in the manual (checked on a real meter on 2026-10-14).

## Sources

- "SDM630 Modbus Protocol" V1.8: https://www.eastroneurope.com/images/uploads/products/protocol/SDM630_MODBUS_Protocol.pdf

## License

GPL-3.0-or-later
