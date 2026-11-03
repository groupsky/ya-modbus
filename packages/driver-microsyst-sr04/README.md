# @ya-modbus/driver-microsyst-sr04

Microsyst SR04 solar heating systems controller driver for ya-modbus.

## Device Information

- **Manufacturer**: Microsyst
- **Model**: SR04, a controller for solar heating with one or two collectors, boiler, storage tank, pool and stove. 8 sensors, 8 relay outputs, a clock with a battery.
- **Communication**: Modbus RTU over RS-485 (an option of the device). Function codes 01 (read coils), 03 (read holding registers), 05 and 06 (write one coil or one register). There is no function code 16.
- **Default Settings** (the manual's factory value of the RS485 setting):
  - Address: 1
  - Baud rate: 9600 (or 19200)
  - Parity: None (or even)
  - Stop bits: 1 (or 2)
  - Data bits: 8

The register list is in [docs/register-map.md](docs/register-map.md). It comes from the maker's manual, revision 2020-10-30, pages 15-16: https://www.microsyst.net/wp-content/uploads/2020/11/SR04_2020-10-30_EN-1.pdf

## Installation

```bash
npm install @ya-modbus/driver-microsyst-sr04
```

## Usage

```typescript
import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-microsyst-sr04'
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

console.log(await driver.readDataPoints(['t1_temperature', 't3_temperature', 'clock']))
await driver.writeDataPoint('clock', '2026-10-20T14:28:12')
```

## Data points

Temperatures are in °C. Settings (poll "static") are read once when the bridge starts, because they rarely change. All other values are read on every poll.

| id                                            | register        | type      | unit | poll    |
| --------------------------------------------- | --------------- | --------- | ---- | ------- |
| `boiler_low_enabled`                          | coil 296        | boolean   |      | dynamic |
| `solar2_enabled`                              | coil 297        | boolean   |      | dynamic |
| `storage_tank_enabled`                        | coil 298        | boolean   |      | dynamic |
| `heating_enabled`                             | coil 299        | boolean   |      | dynamic |
| `pool_enabled`                                | coil 300        | boolean   |      | dynamic |
| `stove_enabled`                               | coil 301        | boolean   |      | dynamic |
| `sensor_type`                                 | coil 302        | boolean   |      | dynamic |
| `trial`                                       | coil 303        | boolean   |      | dynamic |
| `priority`                                    | coil 352        | boolean   |      | dynamic |
| `summer_winter`                               | coil 353        | boolean   |      | dynamic |
| `sensor_error`                                | 557, low byte   | integer   |      | dynamic |
| `adc2`, `adc3`                                | 558, 559        | integer   |      | dynamic |
| `t1_temperature` ... `t8_temperature`         | 560-567         | float     | °C   | dynamic |
| `calibration_ntc_53_41k`                      | 0               | integer   |      | static  |
| `calibration_ntc_2_588k`                      | 2               | integer   |      | static  |
| `calibration_pt_1_000k`                       | 4               | integer   |      | static  |
| `calibration_pt_1_385k`                       | 6               | integer   |      | static  |
| `filter`                                      | 12              | integer   |      | static  |
| `adc_jump`                                    | 13              | integer   |      | static  |
| `jump_time`                                   | 14              | integer   |      | static  |
| `heater_on1`, `heater_off1` ... `heater_off3` | 15-20           | integer   |      | static  |
| `t1_setpoint`                                 | 21              | integer   | °C   | static  |
| `t2_max`                                      | 22              | integer   | °C   | static  |
| `t3_t4_max`                                   | 23              | integer   | °C   | static  |
| `t3_t4_min`                                   | 24              | integer   | °C   | static  |
| `freeze`                                      | 25              | integer   | °C   | static  |
| `delta`                                       | 26              | integer   | °C   | static  |
| `tolerance`                                   | 27              | integer   | °C   | static  |
| `hysteresis`, `hysteresis2`, `hysteresis3`    | 28-30           | float     | °C   | static  |
| `t5_setpoint`                                 | 31              | integer   | °C   | static  |
| `t7_setpoint`                                 | 32              | integer   | °C   | static  |
| `t8_min`                                      | 33              | integer   | °C   | static  |
| `t8_max`                                      | 34              | integer   | °C   | static  |
| `t8_freeze`                                   | 35              | integer   | °C   | static  |
| `scheme`                                      | 36              | integer   |      | static  |
| `kick_off`                                    | 38              | integer   |      | static  |
| `kick_on`                                     | 39              | integer   |      | static  |
| `kick_pause`                                  | 40              | integer   | min  | static  |
| `kick_time`                                   | 41              | integer   | s    | static  |
| `time_05c`                                    | 42              | integer   | s    | static  |
| `heater_setpoint`                             | 43              | integer   | °C   | static  |
| `trial_time`                                  | 45              | integer   |      | static  |
| `decimal_point`                               | 48              | integer   |      | static  |
| `stop_bits`                                   | coil 1000       | integer   |      | static  |
| `parity`                                      | coil 1001       | enum      |      | static  |
| `baud_rate`                                   | coil 1002       | integer   |      | static  |
| `broadcast`                                   | coil 1003       | boolean   |      | static  |
| `address`                                     | 127             | integer   |      | static  |
| `fast`                                        | coil 2865       | boolean   |      | dynamic |
| `output_p1` ... `output_p8`                   | coils 2896-2903 | boolean   |      | dynamic |
| `clock`                                       | 1024-1027       | timestamp |      | dynamic |
| `clock_week_day`                              | 1025, low byte  | integer   |      | dynamic |

Registers without "coil" are holding registers. Settings are whole numbers in the unit of the table, except the hysteresis values, which are in steps of 0.1 °C.

- `t1_temperature` ... `t8_temperature` are `null` when the register holds 2070 (207.0 °C, outside the measuring range of -10 to 200 °C). The old reader showed a missing sensor this way.
- `heater_on1` ... `heater_off3`, `kick_on` and `kick_off` are hours of the day, 0-23. The menu also has "---" (not used). The device seems to store "---" as 24.
- `stop_bits` is 1 or 2, `parity` is `none` or `even`, `baud_rate` is 9600 or 19200, `broadcast` is true when the device takes broadcast requests.
- `clock_week_day`: 0 = Sunday to 6 = Saturday.

A full poll makes 8 requests: coils 296 (64 coils), 1000 (4) and 2864 (40), holding registers 0 (35 registers), 35 (14), 127 (1), 557 (11) and 1024 (4). These are the requests of the old reader, which work on the real device. The device has an 80 byte buffer, so do not make the blocks larger. A block is read only when one of its data points is asked for.

## The clock

The clock is the only value that can be written. It has no time zone, so `clock` is a local date-time without an offset: `YYYY-MM-DDTHH:MM:SS`, year 2000-2099. Write the local time you want the controller to use: its heater and pump time windows follow this clock.

```typescript
await driver.writeDataPoint('clock', '2026-10-25T03:00:05')
```

A write:

1. checks the value and writes nothing if it is not a real date-time in this form,
2. reads register 1027, because the low byte of 1027 is not documented and is written back as it is,
3. writes 1024 (seconds, minutes), 1025 (hours, week day), 1026 (day, month), 1027 (year), each with function code 06.

The week day comes from the date. The clock keeps running between the four writes. Seconds and minutes go first, so a carry to the next minute, hour or day can only happen when the seconds you write are close to 59. Write a time with seconds well below 59, for example below 55.

All other data points are read-only. The settings, calibration and serial settings are not writable: a wrong value can stop the heating control or cut the device off the bus.

## Old field to data point id

The old reader (homy `microsyst-sr04`) published one nested object.

| old field                                      | data point id                                  |
| ---------------------------------------------- | ---------------------------------------------- |
| `boilerLowE1`                                  | `boiler_low_enabled`                           |
| `solar2E4`                                     | `solar2_enabled`                               |
| `accumulE5`                                    | `storage_tank_enabled`                         |
| `heatInstallationE6`                           | `heating_enabled`                              |
| `poolE7`                                       | `pool_enabled`                                 |
| `chimneyE8`                                    | `stove_enabled`                                |
| `typeSens`                                     | `sensor_type`                                  |
| `trial`                                        | `trial`                                        |
| `prior`                                        | `priority`                                     |
| `sumWin`                                       | `summer_winter`                                |
| `sensorError`                                  | `sensor_error`                                 |
| `adc2`, `adc3`                                 | `adc2`, `adc3`                                 |
| `t1` ... `t8`                                  | `t1_temperature` ... `t8_temperature`          |
| `configuration.calibrationNtc5341k`            | `calibration_ntc_53_41k`                       |
| `configuration.calibrationNtc2588k`            | `calibration_ntc_2_588k`                       |
| `configuration.calibrationPt1000k`             | `calibration_pt_1_000k`                        |
| `configuration.calibrationPt1385k`             | `calibration_pt_1_385k`                        |
| `configuration.filter`                         | `filter`                                       |
| `configuration.adcJump`                        | `adc_jump`                                     |
| `configuration.jumpTime`                       | `jump_time`                                    |
| `configuration.on1` ... `off3`                 | `heater_on1` ... `heater_off3`                 |
| `configuration.spT1`                           | `t1_setpoint`                                  |
| `configuration.maxT2`                          | `t2_max`                                       |
| `configuration.maxT3T4`                        | `t3_t4_max`                                    |
| `configuration.minT3T4`                        | `t3_t4_min`                                    |
| `configuration.freez`                          | `freeze`                                       |
| `configuration.delta`                          | `delta`                                        |
| `configuration.toler`                          | `tolerance`                                    |
| `configuration.h`, `h2`, `h3`                  | `hysteresis`, `hysteresis2`, `hysteresis3`     |
| `configuration.spT5`                           | `t5_setpoint`                                  |
| `configuration.spT7`                           | `t7_setpoint`                                  |
| `configuration.minT8`                          | `t8_min`                                       |
| `configuration.maxT8`                          | `t8_max`                                       |
| `configuration.freezT8`                        | `t8_freeze`                                    |
| `configuration.sheme`                          | `scheme`                                       |
| `configuration.kickOff`                        | `kick_off`                                     |
| `configuration.kickOn`                         | `kick_on`                                      |
| `configuration.kickPause`                      | `kick_pause`                                   |
| `configuration.kickTime`                       | `kick_time`                                    |
| `configuration.time05C`                        | `time_05c`                                     |
| `configuration.heatSp`                         | `heater_setpoint`                              |
| `configuration.trialTime`                      | `trial_time`                                   |
| `configuration.dPoint`                         | `decimal_point`                                |
| `communication.address`                        | `address`                                      |
| `communication.stopBits`                       | `stop_bits` (decoded the other way, see below) |
| `communication.parity`                         | `parity` (decoded the other way, see below)    |
| `communication.baudRate`                       | `baud_rate`                                    |
| `communication.broadcast`                      | `broadcast` (decoded the other way, see below) |
| `outputs.fast`                                 | `fast`                                         |
| `outputs.p1` ... `outputs.p8`                  | `output_p1` ... `output_p8`                    |
| `timer.year`, `month`, `day`, `hh`, `mm`, `ss` | `clock` (one value, year with 4 digits)        |
| `timer.dayWeek`                                | `clock_week_day`                               |

## Differences from the old reader

The old reader and the manual disagree on these points. The driver follows the manual.

- **Coil 1001, parity.** The old reader reads 1 as "no parity". The manual says 1 = even parity, 0 = no parity. The real device answers 0 on a bus with no parity, so the old reader reported `even` there. The driver reports `none`.
- **Coil 1003, broadcast.** The manual calls it "NO BROADCAST": 1 = the device does not take broadcast requests. The old reader published the coil as `broadcast`, so 1 showed as `true`. The driver reports `broadcast: false` for 1.
- **Coil 1000, stop bits.** The old reader reads it as stop bits, 1 = one stop bit, 0 = two. The manual labels it "1-TX 9 BIT 0-TX 8 BIT". The RS485 menu of the manual lists its 16 values in bit order (B9n1, B9n2, B9E1 ...), and there bit 0 changes 1 stop bit to 2 stop bits. So the driver reads 1 = two stop bits, 0 = one stop bit, the opposite of the old reader. This is read from the order of the menu, not printed as a rule; see "Open questions".
- **Register 564** is printed "T2" in the manual. It is T5 (storage tank): it sits between T4 and T6, and the old reader reads it as `t5`. The driver reads it as `t5_temperature`.
- **2070 means no sensor.** This rule is in the old reader, not in the manual. The driver keeps it for the temperatures T1-T8. The old reader also applied it to `h`, `h2` and `h3`; the driver does not, because hysteresis is 0-10.0 °C.
- **Clock.** The old reader published seven fields with a two digit year and took a week day from the caller on a write. The driver has one `clock` value with a four digit year, and a write takes the week day from the date. The write itself is the same: read 1027, then four single-register writes, seconds first, low byte of 1027 kept.
- **Pause between requests.** The old reader waited 25 ms before each request. The driver does not wait between the requests of one poll. The bridge waits `interDeviceDelay` only when the bus changes to another device.
- **Settings are read once.** The old reader also read the settings once and read them again after each write. With the bridge, the settings (poll "static") are read once at the start. Restart the bridge to see a setting that was changed on the front panel.

## Open questions

These need a check on the real device:

- Coil 1000: does 1 mean two stop bits? Compare the coil with the stop bits the bus uses.
- Is the 25 ms pause of the old reader needed between the requests of one poll?
- The meaning of coils 296-303, 352, 353 and 2865 and of registers 13, 14, 45 is not explained in the register list of the manual. The names here follow the labels and the menu of the manual.

## License

GPL-3.0-or-later
