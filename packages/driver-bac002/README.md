# @ya-modbus/driver-bac002

Driver for the BAC-002 room thermostat (fan coil thermostat with RS-485), for ya-modbus.

The register list comes from an older reader of this device and from the
[Wiren Board page for the BAC-002ALN](https://wiki.wirenboard.com/wiki/BAC-002ALN).
There is no vendor register document.

## Device Information

- **Model**: BAC-002
- **Type**: Room thermostat for fan coil units, with RS-485
- **Communication**: Modbus RTU
- **Default settings**:
  - Address: 1
  - Baud rate: 9600
  - Parity: none
  - Data bits: 8
  - Stop bits: 1

## Installation

```bash
npm install @ya-modbus/driver-bac002
```

## Usage

```typescript
import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-bac002'
import { createRTUTransport } from '@ya-modbus/transport'

const transport = await createRTUTransport({
  port: '/dev/ttyUSB0',
  baudRate: DEFAULT_CONFIG.baudRate,
  parity: DEFAULT_CONFIG.parity,
  dataBits: DEFAULT_CONFIG.dataBits,
  stopBits: DEFAULT_CONFIG.stopBits,
  slaveId: DEFAULT_CONFIG.defaultAddress,
})

const driver = await createDriver({ transport })

// One read of the device returns every data point you ask for
const values = await driver.readDataPoints(['power', 'mode', 'target_temperature'])
console.log(values)
// { power: 'on', mode: 'heating', target_temperature: 21.5 }

// Change settings
await driver.writeDataPoint('mode', 'cooling')
await driver.writeDataPoint('target_temperature', 24)
await driver.writeDataPoint('fan_setting', 'auto')
```

## Data points

Enum data points read and write text values. Writing any other value fails with a message that
lists the valid ones, and nothing is sent to the device.

| Data point            | Type    | Unit | Access | Values                                          |
| --------------------- | ------- | ---- | ------ | ----------------------------------------------- |
| `power`               | enum    |      | rw     | `off`, `on`                                     |
| `fan_setting`         | enum    |      | rw     | `auto`, `high`, `mid`, `low`                    |
| `mode`                | enum    |      | rw     | `cooling`, `heating`, `ventilation`             |
| `target_temperature`  | float   | °C   | rw     | 0 to 100, rounded to steps of 0.5               |
| `lock`                | enum    |      | rw     | `unlock`, `lock`                                |
| `clock_minutes`       | integer | min  | rw     | 0 to 59                                         |
| `clock_hours`         | integer | h    | rw     | 0 to 23                                         |
| `week_day`            | enum    |      | rw     | `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun` |
| `current_temperature` | float   | °C   | r      | Room temperature, one decimal                   |
| `valve`               | integer |      | r      | Raw valve number from the device                |
| `valve_status`        | enum    |      | r      | `off`, `on`                                     |
| `fan`                 | integer |      | r      | Raw fan number from the device                  |
| `fan_status`          | enum    |      | r      | `off`, `high`, `mid`, `low`                     |

A register value that has no meaning (for example mode 9) reads as `unknown`, for every enum data
point. `unknown` is listed so you can read it, but you cannot write it. `valve_status` is `on`
for any raw valve value above 0. A week day that is not set (0) also reads `unknown`.

## Old field to data point

These are the fields the old reader published and the data points that replace them.

| Old field     | Data point            |
| ------------- | --------------------- |
| `power`       | `power`               |
| `fanSetting`  | `fan_setting`         |
| `fanStatus`   | `fan_status`          |
| `mode`        | `mode`                |
| `valveStatus` | `valve_status`        |
| `targetTemp`  | `target_temperature`  |
| `currentTemp` | `current_temperature` |
| `lock`        | `lock`                |
| `fan`         | `fan`                 |
| `valve`       | `valve`               |
| `weekDay`     | `week_day`            |
| `minutes`     | `clock_minutes`       |
| `hours`       | `clock_hours`         |

The text values (`off`, `high`, `heating`, `mon`, and so on) are the same as before.

## Differences from the old reader

- Names are in snake_case, and the clock fields are `clock_minutes` and `clock_hours`.
- Writes go through `writeDataPoint`, one data point at a time. The old writer's raw register
  writes and its register scan are not part of the driver.
- A week day that is not set reads as `unknown`. The old reader showed `??`.
- A register value with no meaning reads as `unknown`. The old reader passed the raw number
  through. Use `valve` and `fan` for the raw numbers.
- `valve_status` is `on` for any raw valve value above 0. The old reader passed values above 1
  through.
- Temperatures are signed, so a room below 0 °C reads as `-1`, not `6552.6`.
- The clock fields accept whole numbers only. The old writer rounded `12.4` to `12`.
- The target temperature must be from 0 to 100 before rounding. The old writer rounded first, so
  it also accepted values up to 100.2.

## Target temperature step

The driver rounds the target temperature to 0.5 °C and writes it in tenths of a degree, as the
old writer did. A value like `21.3` is written as `21.5`. The register itself holds tenths of a
degree. If the device accepts finer steps, the rounding can be removed.

## Testing

Tests run against the Modbus emulator over TCP, so every read and write uses the real protocol.

```bash
npm test -w @ya-modbus/driver-bac002
```

## License

GPL-3.0-or-later
