# @ya-modbus/driver-spm01r

Bituo SPM01R FLEX single-phase energy meter driver for ya-modbus.

> **Not yet confirmed on hardware.** The register list comes from the vendor user guide. No real meter has been tested yet. In particular, the scale of active and apparent power (the guide says kW and kVA) is not confirmed.

## Device Information

- **Manufacturer**: Bituo Technik
- **Model**: SPM01R FLEX, order code SPM01-D2M1
- **Type**: Single-phase + N energy meter, 63 A, built-in current sensor, RS-485 (isolated). Measures energy in both directions.
- **Communication**: Modbus RTU. Function codes 03 and 04 return the same data. Floats are 32-bit, big-endian (ABCD), 2 registers each.
- **Default Settings**:
  - Address: 247
  - Baud rate: 9600
  - Parity: None
  - Stop bits: 1
  - Data bits: 8

A press of 5 seconds on the reset button restores address, baud rate and format to these defaults.

The same user guide also covers the 3-phase SPM02R. It is not supported by this driver.

## Installation

```bash
npm install @ya-modbus/driver-spm01r
```

## Usage

```typescript
import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-spm01r'
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

### Measurements

Read-only, polled on every poll. All 12 come from one request: 24 holding registers from 20000.

| ID                                  | Register    | Type, scale                | Unit |
| ----------------------------------- | ----------- | -------------------------- | ---- |
| `voltage`                           | 20000-20001 | float32                    | V    |
| `current`                           | 20002-20003 | float32                    | A    |
| `active_power`                      | 20004-20005 | float32, x1000 (kW to W)   | W    |
| `power_factor`                      | 20006-20007 | float32                    | -    |
| `frequency`                         | 20008-20009 | float32                    | Hz   |
| `import_active_energy`              | 20010-20011 | float32                    | kWh  |
| `export_active_energy`              | 20012-20013 | float32                    | kWh  |
| `total_active_energy`               | 20014-20015 | float32                    | kWh  |
| `total_import_active_energy`        | 20016-20017 | float32                    | kWh  |
| `total_export_active_energy`        | 20018-20019 | float32                    | kWh  |
| `total_active_energy_nonresettable` | 20020-20021 | float32                    | kWh  |
| `apparent_power`                    | 20022-20023 | float32, x1000 (kVA to VA) | VA   |

The first three energy values can be reset on the meter. The last three (`total_import_active_energy`, `total_export_active_energy`, `total_active_energy_nonresettable`) cannot.

### Settings

Read/write, `pollType: 'on-demand'`. A new value may only apply after the meter restarts.

| ID               | Register | Values                                          |
| ---------------- | -------- | ----------------------------------------------- |
| `device_address` | 6000     | 1-247                                           |
| `baud_rate`      | 6001     | 2400, 4800, 9600, 19200, 38400                  |
| `parity`         | 6002     | `none`, `even`, `odd` (8 data bits, 1 stop bit) |

Notes on the codes:

- Baud rate: the guide lists codes 0 and 3 both as 9600. Reading accepts both. Writing 9600 sends code 3.
- Parity: code 3 is "no parity, 2 stop bits". It reads as `none` (stop bits are not a data point) and cannot be written.

### Not exposed

Register 10000 (LED blink), 10001 (energy reset) and 30000 (broadcast address change) are commands, not data points. The driver never writes them.

## Sources

- User guide V1.2, page "Modbus Register List": https://downloads.bituo-technik.com/User-Guide/SPM01R02R-All-in-One_User-Guide_ENCN.pdf
- Product docs: https://docs.bituo-technik.com/product-document/spm-series/spm01r-flex
- Datasheet: https://downloads.bituo-technik.com/Datasheet/SPM01R-FLEX-All_Datasheet_EN.pdf

## License

GPL-3.0-or-later
