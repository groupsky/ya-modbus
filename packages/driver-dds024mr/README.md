# @ya-modbus/driver-dds024mr

Sinotimer DDS024MR 3-phase energy meter driver for ya-modbus.

## Device Information

- **Manufacturer**: Sinotimer
- **Model**: DDS024MR
- **Type**: 3 phases + N energy meter, DIN rail, RS-485. Despite the "DDS" name (usually single-phase), it is a 3-phase meter.
- **Communication**: Modbus RTU, input registers (function code 04), float32 big-endian, 2 registers per value
- **Default Settings**:
  - Address: 1
  - Baud rate: 9600
  - Parity: Even
  - Stop bits: 1
  - Data bits: 8

The register document does not give the defaults. They come from the manual of the sibling model DDS661 and match a real DDS024MR.

## Installation

```bash
npm install @ya-modbus/driver-dds024mr
```

## Usage

```typescript
import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-dds024mr'
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

All data points are read-only and are read on every poll.

| ID                      | Register | Unit  |
| ----------------------- | -------- | ----- |
| `voltage_l1`            | 0x00     | V     |
| `voltage_l2`            | 0x02     | V     |
| `voltage_l3`            | 0x04     | V     |
| `current_l1`            | 0x08     | A     |
| `current_l2`            | 0x0A     | A     |
| `current_l3`            | 0x0C     | A     |
| `active_power_total`    | 0x10     | W     |
| `active_power_l1`       | 0x12     | W     |
| `active_power_l2`       | 0x14     | W     |
| `active_power_l3`       | 0x16     | W     |
| `reactive_power_total`  | 0x18     | VAr   |
| `reactive_power_l1`     | 0x1A     | VAr   |
| `reactive_power_l2`     | 0x1C     | VAr   |
| `reactive_power_l3`     | 0x1E     | VAr   |
| `power_factor_l1`       | 0x2A     | -     |
| `power_factor_l2`       | 0x2C     | -     |
| `power_factor_l3`       | 0x2E     | -     |
| `frequency`             | 0x36     | Hz    |
| `active_energy_total`   | 0x100    | kWh   |
| `reactive_energy_total` | 0x400    | kVArh |

Only these registers are verified on a real meter. Other registers in the vendor list (total current, apparent power, total power factor, phase angles, import/export energy, maximum demand) and the settings registers are not used.

The driver reads these registers in at most 3 requests per poll: 0x00 (56 registers), 0x100 (2 registers) and 0x400 (2 registers). A block is read only when one of its data points is requested.

## Notes

- **Power is in W and VAr, not kW.** The vendor register list says kW, but the real meter returns W. Check on 2026-10-14: 239.5 V x 0.419 A x power factor 0.673 = 67.5, and register 0x14 returned 67.54.
- **Low current.** At very low current (about 0.02 A) the meter reports active power 0 and power factor 0 for that phase.
- The unit of reactive energy (kVArh) is assumed. The vendor list only says "Reactive KVA".

## Sources

- Register list "MODBUS Address EN" (from Sinotimer): https://github.com/evcc-io/evcc/files/8552229/MODBUS.Address_EN.pdf
- Manual of the sibling model DDS661 (serial settings, defaults, function codes): https://community.jeedom.com/uploads/short-url/iBIDCMlIpNYtquKEiAh4z2a6i9a.pdf

## License

GPL-3.0-or-later
