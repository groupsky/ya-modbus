# @ya-modbus/driver-dds519mr

Sinotimer DDS519MR single-phase energy meter driver for ya-modbus.

## Device Information

- **Manufacturer**: Sinotimer
- **Model**: DDS519MR
- **Type**: single-phase energy meter, DIN rail, RS-485. A shop listing says 5(100) A, pulse output, not MID: https://domoticx.net/webshop/kwh-meter-100a-digitaal-lcd-display-puls-uitgang-modbus-rs485-rtu-din-rail-dds519mr (seen 2026-10-15)
- **Communication**: Modbus RTU, input registers (function code 04), float32 big-endian (high word first), 2 registers per value
- **Default Settings**:
  - Address: 1
  - Baud rate: 9600
  - Parity: Even
  - Stop bits: 1
  - Data bits: 8

No register document for the DDS519MR itself was found. The registers and the defaults come from the manual of the sibling model DDS661 and match real DDS519MR meters (9600 baud, 8 data bits, even parity, 1 stop bit). The manual does not state a default address; 1 is the value used in its examples.

## Installation

```bash
npm install @ya-modbus/driver-dds519mr
```

## Usage

```typescript
import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-dds519mr'
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

| ID                    | Register | Unit | Resolution seen |
| --------------------- | -------- | ---- | --------------- |
| `voltage`             | 0x00     | V    | 0.1             |
| `current`             | 0x08     | A    | 0.001           |
| `active_power`        | 0x12     | W    | 0.1             |
| `power_factor`        | 0x2A     | -    | 0.001           |
| `frequency`           | 0x36     | Hz   | -               |
| `total_active_energy` | 0x100    | kWh  | 0.01            |

These are all 6 reading registers of the manual. They are checked on real meters.

A full poll makes 3 requests: 0x00 (20 registers), 0x2A (14 registers) and 0x100 (2 registers). A block is read only when one of its data points is requested. Registers 0x14 to 0x29 are never read, and wider reads are not tried on the meter.

The settings (holding registers 0x00 baud rate, 0x02 parity, 0x08 address, per the DDS661 manual) are not exposed. The driver does not write to the meter.

## Notes

- **Power is in W, not kW.** The DDS661 manual and the third-party table say kW. Checked on the real meters on 2026-10-13: 233.3 V x 10.207 A x power factor 1 = 2381.3, and register 0x12 returned 2381.6. Over a whole day the sum of the power in W matched the energy counter in kWh within 0.02 kWh on all 5 meters.
- **Frequency is always exactly 50.** All readings of 5 meters on 2026-10-13 and 2026-10-14 were 50. The meter seems not to measure the frequency (a fixed value, or rounded to whole Hz). The data point is kept because the previous reader of these meters publishes it. Do not use it to watch the grid.
- **Low current.** At very low current (up to about 0.1 A) the meter reports active power 0 and power factor 1 in most records. The current register can show 0 for about 0.02 A while the power is still 4 to 5 W.
- **Load changes.** Current and power can be inconsistent for one reading when a load starts (for example current 0 and power above 400 W), because the meter seems to update them at different times.
- Power factor 0 appears in about 0.35 % of the records, also under a large load. The cause is not known.

## Sources

- Manual of the sibling model DDS661 (same register map, serial settings, defaults, function codes): https://community.jeedom.com/uploads/short-url/iBIDCMlIpNYtquKEiAh4z2a6i9a.pdf
- Third-party table for "Sinotimer (DDS519)" with the same offsets (no function codes, no byte order): https://www.aggsoft.com/modbus-data-logging/sinotimer.htm
- A "DDS519MR User Manual" is linked on https://domoticx.net/download/dds519mr-user-manual/. It was not readable (HTTP 403 to scripts) and is not used.

## License

GPL-3.0-or-later
