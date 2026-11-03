# @ya-modbus/driver-or-we-526

ORNO OR-WE-526 single-phase multi-tariff energy meter driver for ya-modbus.

## Device Information

- **Manufacturer**: ORNO
- **Model**: OR-WE-526, a single-phase MID meter, DIN rail (1 module), RS-485. Rated 5 A base, 100 A maximum. Tariffs T1-T4 and a clock with a battery. The OR-WE-525 is the same meter without tariffs and clock.
- **Communication**: Modbus RTU, holding registers (function code 03), big-endian, high word first for 32-bit values
- **Default Settings** (from the manual):
  - Address: 1
  - Baud rate: 9600
  - Parity: None
  - Stop bits: 1
  - Data bits: 8
- **Supported Settings**: baud rate 9600, 19200, 38400 or 115200; no, odd or even parity; 1 or 2 stop bits; address 1 to 247

The register list is in [docs/register-map.md](https://github.com/groupsky/ya-modbus/blob/main/packages/driver-or-we-526/docs/register-map.md). It is written from ORNO's register list (PDF made 2023-05-31), see [Sources](#sources).

## Installation

```bash
npm install @ya-modbus/driver-or-we-526
```

## Usage

```typescript
import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-or-we-526'
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

const values = await driver.readDataPoints(['voltage', 'active_power', 'active_energy_forward'])
console.log(values)
```

## Data Points

All data points are read-only. The driver writes nothing to the meter.

"Poll" says when the bridge reads the value: `dynamic` on every poll, `static` once at the start (restart the bridge to see a setting that was changed on the meter's buttons).

### Measurements

| ID               | Register    | Type, scale  | Unit | Poll    |
| ---------------- | ----------- | ------------ | ---- | ------- |
| `voltage`        | 0x100-0x101 | INT32, 0.001 | V    | dynamic |
| `current`        | 0x102-0x103 | INT32, 0.001 | A    | dynamic |
| `active_power`   | 0x104-0x105 | INT32, 1     | W    | dynamic |
| `apparent_power` | 0x106-0x107 | INT32, 1     | VA   | dynamic |
| `reactive_power` | 0x108-0x109 | INT32, 1     | VAr  | dynamic |
| `frequency`      | 0x10A       | INT16, 0.1   | Hz   | dynamic |
| `power_factor`   | 0x10B       | INT16, 0.001 | -    | dynamic |

### Energy

All are INT32, 0.01, read on every poll. Each id without a suffix is the sum of all tariffs; `_t1` to `_t4` are the tariffs (for example `active_energy_forward_t2`). On a meter without tariffs, T1 equals the total and T2-T4 are 0.

| ID (+ `_t1` ... `_t4`)    | Registers   | Unit  | Meaning                                               |
| ------------------------- | ----------- | ----- | ----------------------------------------------------- |
| `active_energy_forward`   | 0x10E-0x117 | kWh   | Forward (taken from the grid) active energy           |
| `active_energy_reverse`   | 0x118-0x121 | kWh   | Reverse (given to the grid) active energy             |
| `active_energy_total`     | 0x122-0x12B | kWh   | Total active energy, made as the `combined_code` says |
| `reactive_energy_forward` | 0x12C-0x135 | kVArh | Forward reactive energy                               |
| `reactive_energy_reverse` | 0x136-0x13F | kVArh | Reverse reactive energy                               |
| `reactive_energy_total`   | 0x140-0x149 | kVArh | Total reactive energy                                 |
| `reactive_energy_q1`      | 0x14A-0x153 | kVArh | Reactive energy in quadrant 1                         |
| `reactive_energy_q2`      | 0x154-0x15D | kVArh | Reactive energy in quadrant 2                         |
| `reactive_energy_q3`      | 0x15E-0x167 | kVArh | Reactive energy in quadrant 3                         |
| `reactive_energy_q4`      | 0x168-0x171 | kVArh | Reactive energy in quadrant 4                         |

| ID                           | Register    | Unit  | Meaning                              |
| ---------------------------- | ----------- | ----- | ------------------------------------ |
| `active_energy_resettable`   | 0x172-0x173 | kWh   | Active energy since the last reset   |
| `reactive_energy_resettable` | 0x174-0x175 | kVArh | Reactive energy since the last reset |

### Demand

All are INT32, 0.1, read on every poll.

| ID                                  | Register    | Unit |
| ----------------------------------- | ----------- | ---- |
| `active_power_demand_forward`       | 0x176-0x177 | W    |
| `active_power_demand_forward_max`   | 0x178-0x179 | W    |
| `active_power_demand_reverse`       | 0x17A-0x17B | W    |
| `active_power_demand_reverse_max`   | 0x17C-0x17D | W    |
| `reactive_power_demand_forward`     | 0x180-0x181 | VAr  |
| `reactive_power_demand_forward_max` | 0x182-0x183 | VAr  |
| `reactive_power_demand_reverse`     | 0x184-0x185 | VAr  |
| `reactive_power_demand_reverse_max` | 0x186-0x187 | VAr  |

### Meter, clock and settings

| ID                  | Register      | Type      | Value                                                              | Poll    |
| ------------------- | ------------- | --------- | ------------------------------------------------------------------ | ------- |
| `serial_number`     | 0x1000-0x1002 | string    | 12 digits                                                          | static  |
| `device_address`    | 0x1003        | integer   | 1-247                                                              | static  |
| `software_version`  | 0x1004        | integer   |                                                                    | static  |
| `hardware_version`  | 0x1005        | integer   |                                                                    | static  |
| `firmware_checksum` | 0x1006        | integer   |                                                                    | static  |
| `clock`             | 0x1007-0x100A | timestamp | `2026-11-03T14:05:09`, local time without a time zone              | dynamic |
| `scroll_time`       | 0x100B        | integer   | seconds, 0-99                                                      | static  |
| `baud_rate`         | 0x100C        | enum      | 9600, 19200, 38400, 115200                                         | static  |
| `parity`            | 0x100D        | enum      | `none`, `odd`, `even`                                              | static  |
| `stop_bits`         | 0x100E        | integer   | 1 or 2                                                             | static  |
| `combined_code`     | 0x100F        | enum      | `forward`, `reverse`, `forward+reverse`, `forward-reverse`         | static  |
| `demand_mode`       | 0x1010        | enum      | `interval`, `slip`                                                 | static  |
| `demand_cycle`      | 0x1011        | integer   | minutes, 1-30                                                      | static  |
| `display_mode`      | 0x1012-0x1015 | string    | 16 hex digits, one bit per screen shown in turn                    | static  |
| `password`          | 0x1016        | string    | 4 digits, the password of the meter's buttons                      | static  |
| `running_time`      | 0x1018-0x1019 | integer   | counts while the current is above `startup_current`; no unit given | dynamic |
| `startup_current`   | 0x101A-0x101B | float     | A (the meter gives mA)                                             | static  |

An enum code that is not in the list reads as `null`. Only the multi-tariff version has the clock and the running time.

### Requests

A full read takes 8 requests: 0x100 (12 registers), 0x10E (60), 0x14A (44), 0x176 (18), 0x1000 (7), 0x1007 (5), 0x100C (11) and 0x1018 (4). A block is read only when one of its data points is asked for. The first two are the same requests as the old reader. The demand block also reads 0x17E-0x17F, which are not in the list; the old reader read them too. The bridge reads the `static` blocks only at the start, so a normal poll takes 6 requests.

## Old field to data point id

The old homy reader (`or-we-526.js`) published these fields. Each one has a data point here.

| Old field                                            | Data point id                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `v`                                                  | `voltage`                                                                |
| `c`                                                  | `current`                                                                |
| `ap`                                                 | `active_power`                                                           |
| `app`                                                | `apparent_power`                                                         |
| `rp`                                                 | `reactive_power`                                                         |
| `freq`                                               | `frequency`                                                              |
| `pow`                                                | `power_factor`                                                           |
| `tot_act`, `tot_act_t1` ... `tot_act_t4`             | `active_energy_forward`, `active_energy_forward_t1` ... `_t4`            |
| `tot_act_rev`, `tot_act_rev_t1` ... `tot_act_rev_t4` | `active_energy_reverse`, `active_energy_reverse_t1` ... `_t4`            |
| `act`, `act_t1` ... `act_t4`                         | `active_energy_total`, `active_energy_total_t1` ... `_t4`                |
| `tot_react`, `tot_react_t1` ... `tot_react_t4`       | `reactive_energy_forward`, `reactive_energy_forward_t1` ... `_t4`        |
| `tot_react_rev`, `tot_react_rev_t1` ... `_t4`        | `reactive_energy_reverse`, `reactive_energy_reverse_t1` ... `_t4`        |
| `react`, `react_t1` ... `react_t4`                   | `reactive_energy_total`, `reactive_energy_total_t1` ... `_t4`            |
| `react_1` ... `react_4`, each with `_t1` ... `_t4`   | `reactive_energy_q1` ... `reactive_energy_q4`, each with `_t1` ... `_t4` |
| `act_reset`                                          | `active_energy_resettable`                                               |
| `react_reset`                                        | `reactive_energy_resettable`                                             |
| `act_demand`                                         | `active_power_demand_forward`                                            |
| `act_demand_max`                                     | `active_power_demand_forward_max`                                        |
| `act_demand_rev`                                     | `active_power_demand_reverse`                                            |
| `act_demand_max_rev`                                 | `active_power_demand_reverse_max`                                        |
| `react_demand`                                       | `reactive_power_demand_forward` (other register, see below)              |
| `react_demand_max`                                   | `reactive_power_demand_forward_max` (other register, see below)          |
| `react_demand_rev`                                   | `reactive_power_demand_reverse` (other register, see below)              |
| `react_demand_max_rev`                               | `reactive_power_demand_reverse_max` (other register, see below)          |
| `serial`                                             | `serial_number`                                                          |
| `id`                                                 | `device_address`                                                         |
| `fw`                                                 | `software_version`                                                       |
| `hw`                                                 | `hardware_version`                                                       |
| `fw_checksum`                                        | `firmware_checksum`                                                      |
| `time`                                               | `clock` (other format, see below)                                        |
| `scroll_time`                                        | `scroll_time`                                                            |
| `baud_rate`                                          | `baud_rate`                                                              |
| `parity`                                             | `parity`                                                                 |
| `stop_bits`                                          | `stop_bits`                                                              |
| `combined_code`                                      | `combined_code`                                                          |
| `demand_mode`                                        | `demand_mode`                                                            |
| `demand_cycle`                                       | `demand_cycle`                                                           |
| `display_mode`                                       | `display_mode`                                                           |
| `password`                                           | `password`                                                               |
| `running_time`                                       | `running_time` (other register, see below)                               |
| `startup_current`                                    | `startup_current` (other register, in A, see below)                      |

The old reader could also read the tariff tables (`timePeriod_1` ... `timePeriod_8`, `timeZone`, `holidays`), but only with `tariffs: true`. That option is off by default and the homy configuration does not set it, so these were never published. The driver does not read them.

## Differences from the old reader

The old reader and ORNO's register list disagree on these points. The driver follows the list.

- **Reactive demand.** The old reader reads the four reactive demand values 2 registers too early: 0x17E, 0x180, 0x182, 0x184. The list has them at 0x180, 0x182, 0x184, 0x186; 0x17E is not in the list. So the old `react_demand` came from an unlisted register, `react_demand_max` was in fact the forward reactive demand, `react_demand_rev` the forward maximum, and `react_demand_max_rev` the reverse reactive demand.
- **Running time and timing current.** The old reader reads them from 0x1017-0x1018 and 0x1019-0x101A, low word first. The list has them at 0x1018-0x1019 and 0x101A-0x101B. The driver reads the listed registers, high word first like all other values. The list does not give the word order for these two; see "Open questions".
- **Timing current unit.** The old `startup_current` was in mA. `startup_current` here is in A (the unit list has no mA).
- **Power factor and frequency are signed.** The list says INT16. The old reader read them unsigned, so a negative power factor (power given to the grid) came out as about 64.5 instead of -1.0.
- **Clock.** The old `time` was a number: milliseconds since 1970, made from the meter's local time in the time zone of the reader. `clock` is the meter's local time as text, `YYYY-MM-DDTHH:MM:SS`, without a time zone. Like the old reader, the driver does not report the week day.
- **Settings and identity are read once.** The old reader read them on every poll. The bridge reads the `static` data points once at the start.
- **No writes.** The old reader wrote the clock and the scrolling time, and could change the settings. Its scrolling time write went to 0x100C, which is the baud rate (the scrolling time is 0x100B). The driver writes nothing.

## Open questions

These need a check on the real meter:

- Word order of `running_time` and `startup_current`. The old reader wrote them low word first. If the old `startup_current` was a very large number (about 65536 times a small one), the timing current is stored low word first and the driver must swap the words.
- The demand block reads up to 0x187 and the settings block reads 0x1018-0x101B. The old reader never read 0x186-0x187 or 0x101B. Check that the meter answers these requests.
- The unit of `running_time` (the list gives none).
- The reactive demand registers. The list puts them at 0x180-0x186 and skips 0x17E; the old reader read 0x17E-0x184. If the list is wrong, all four reactive demand values are one slot off. Check: read 0x176-0x187 under a reactive load and see which registers follow the forward reactive demand.

## Sources

- ORNO register list "Rejestry OR-WE-524, OR-WE-525 i OR-WE-526" (PDF made 2023-05-31): https://files.orno.pl/support/Others/ORNO/ORWE526_5908254827853/OR-WE-526_rejestry.pdf
- ORNO manual for OR-WE-524, OR-WE-525, OR-WE-526 (PL/EN/DE, 07/2025; ratings, default serial settings, which model has which value): https://files.orno.pl/support/ManualsUserPDF/ORNO/PL-EN-DE/OR-WE-524,525,526_manual_PL_EN_DE.pdf

Both seen on 2026-11-03.

## License

GPL-3.0-or-later
