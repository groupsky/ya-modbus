# @ya-modbus/driver-or-we-514

ORNO OR-WE-514 single-phase energy meter driver for ya-modbus.

## Device Information

- **Manufacturer**: ORNO
- **Model**: OR-WE-514
- **Type**: Single-phase energy meter, DIN rail (1 module), RS-485. Rated 5 A base, 100 A maximum. No multi-tariff function.
- **Communication**: Modbus RTU, holding registers (function code 03), big-endian, high word first for 32-bit values
- **Default Settings**:
  - Address: 1
  - Baud rate: 9600
  - Parity: Even
  - Stop bits: 1
  - Data bits: 8

The defaults come from section 8.1 of the official manual. The page headers of the register list say "N81" (no parity); the manual says even, and a real meter runs 8E1.

## Installation

```bash
npm install @ya-modbus/driver-or-we-514
```

## Usage

```typescript
import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-or-we-514'
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

const values = await driver.readDataPoints(['voltage', 'active_power', 'total_active_energy'])
console.log(values)
```

## Data Points

All data points are read-only and are read on every poll.

| ID                      | Register      | Type, scale   | Unit  |
| ----------------------- | ------------- | ------------- | ----- |
| `frequency`             | 0x130         | UINT16, 0.01  | Hz    |
| `voltage`               | 0x131         | UINT16, 0.01  | V     |
| `current`               | 0x139-0x13A   | UINT32, 0.001 | A     |
| `active_power`          | 0x140-0x141   | INT32, 1      | W     |
| `reactive_power`        | 0x148-0x149   | INT32, 1      | VAr   |
| `apparent_power`        | 0x150-0x151   | INT32, 1      | VA    |
| `power_factor`          | 0x158         | INT16, 0.001  | -     |
| `total_active_energy`   | 0xA000-0xA001 | UINT32, 0.01  | kWh   |
| `total_reactive_energy` | 0xA01E-0xA01F | UINT32, 0.01  | kVArh |

The driver reads these registers in at most 8 requests per poll: 0x130 (2 registers), 0x139 (2), 0x140 (2), 0x148 (2), 0x150 (2), 0x158 (1), 0xA000 (2) and 0xA01E (2). A block is read only when one of its data points is requested. Wider reads are not tried on the meter.

Only these registers are verified on a real meter. Other registers in the list (system power values, multi-rate energy, demand, meter type) are not used.

Settings (0x110 address, 0x111 baud rate) are not exposed and the driver writes nothing to the meter.

## Notes

- **Power is in W, VAr and VA.** The list gives 0.001 kW (kvar, kva) per count, which is 1 W (VAr, VA) per count. Checked on a real meter on 2026-10-13: 229.4 V x 7.571 A x power factor 0.999 = 1735, and register 0x140 returned 1736 W. Over the day the energy counter rose by 0.340 kWh, and the sum of the power values gave 0.340 kWh.
- **Power factor is read signed.** The list says INT. No negative value was seen on the real meter, so the sign handling is not checked on hardware.
- **Values are not from one instant.** The 8 requests are sent one after another, so a quickly changing load can make apparent power differ from the value calculated from active and reactive power.

## Sources

- Register list "MODBUS Registers List" (PDF created 2019-03-22, no version; not found on the ORNO site, copy hosted by TapHome under the OR-WE-515 name): https://taphome.com/compatibility/devices/orno-or-we-515/manufacturer/register-description.pdf
- Official manual for OR-WE-512 / 514 / 515 (serial settings and defaults in section 8.1, no registers): https://www.partner.orno.pl/manuals/OR-WE-512,514,515_manual_EN.pdf

## License

GPL-3.0-or-later
