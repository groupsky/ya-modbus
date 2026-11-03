# @ya-modbus/driver-autonics-tf3

Autonics TF3 temperature controller driver for ya-modbus.

## Device Information

- **Manufacturer**: Autonics
- **Model**: TF3 series (the RS-485 models, for example `TF3x-xxA-T`/`-A`)
- **Vendor page**: https://www.autonics.com/series/3000394
- **Communication**: Modbus RTU. Measured values are input registers (function code 04), setup values are holding registers (03/06), the two outputs are coils (01/05).
- **Default Settings** (the target bus):
  - Baud rate: 9600
  - Parity: Odd
  - Data bits: 8
  - Stop bits: 1
  - Address: 1 (an assumption: the address is a setting of the device)

## Source of the register list

The vendor "TF3 communication manual" could not be downloaded when this driver was written (2026-11-03): the vendor site loads its download list with a script. The registers come from the reader this driver replaces (homy `autonics-tf3`), which ran against a real controller. Nothing here is checked against the manual. Units of the time values (delays, cycles) are not known, so they carry no unit.

## Installation

```bash
npm install @ya-modbus/driver-autonics-tf3
```

## Usage

```typescript
import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-autonics-tf3'
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
console.log(await driver.readDataPoint('current_temp'))
await driver.writeDataPoint('target_temp', 45)
```

## Temperatures and the decimal point

Temperatures are numbers in the unit the controller is set to (`temperature_unit`: 0 = Celsius, 1 = Fahrenheit). The data points carry no fixed unit for this reason.

The controller has a decimal-point register (`temp_divisor`: 1 or 10). The driver reads it on every read or write of a temperature and never assumes a scale. A read of any temperature reads the status register group (13 registers) as well, so the scale and the value come from the same moment. Nothing is cached, because the setting can be changed on the controller.

Signed values (temperatures, corrections, limits) are read as signed 16 bit numbers. `hysteresis` and `offset` are unsigned.

## Response delay

The controller has a setting (holding register 0x0134) for how long it waits before it answers. The driver does not use it: a pause before our request does not help. The transport timeout covers the answer, and the bridge has `connection.interDeviceDelay` for spacing on the bus.

## Data points

Enums are read and written as the number; the labels are in `enumValues` of the data point. The old reader published the labels as text.

| id                                             | type    | access     | values                                                                                 |
| ---------------------------------------------- | ------- | ---------- | -------------------------------------------------------------------------------------- |
| `current_temp`                                 | float   | read       |                                                                                        |
| `target_temp`                                  | float   | read/write |                                                                                        |
| `temperature_unit`                             | enum    | read       | 0 = celsius, 1 = fahrenheit                                                            |
| `inputs`                                       | integer | read       | raw bit word of the inputs                                                             |
| `s1_temp`                                      | float   | read       |                                                                                        |
| `s2_temp`                                      | float   | read       |                                                                                        |
| `s3_temp`                                      | float   | read       |                                                                                        |
| `virtual_temp`                                 | float   | read       |                                                                                        |
| `temp_divisor`                                 | integer | read       | 1 or 10                                                                                |
| `aux_enabled`                                  | boolean | read/write |                                                                                        |
| `comp_enabled`                                 | boolean | read/write |                                                                                        |
| `product_number`                               | integer | read       |                                                                                        |
| `hardware_version`                             | integer | read       |                                                                                        |
| `software_version`                             | integer | read       |                                                                                        |
| `model`                                        | string  | read       |                                                                                        |
| `input_type`                                   | enum    | read       | 0 = ntc5k-1, 1 = ntc5k-0.1, 2 = ntc10k-1, 3 = ntc10k-0.1, 4 = dpt100-1, 5 = dpt100-0.1 |
| `input2_enabled`                               | boolean | read       |                                                                                        |
| `input3_type`                                  | enum    | read       | 0 = di, 1 = temp                                                                       |
| `virtual_temp_rate`                            | integer | read/write |                                                                                        |
| `temperature_unit_setting`                     | enum    | read       | 0 = celsius, 1 = fahrenheit                                                            |
| `input1_correction`                            | float   | read/write |                                                                                        |
| `input2_correction`                            | float   | read/write |                                                                                        |
| `input3_correction`                            | float   | read/write |                                                                                        |
| `display_delay`                                | float   | read       |                                                                                        |
| `def_aux_output`                               | enum    | read       | 0 = def, 1 = aux                                                                       |
| `aux_output`                                   | enum    | read       | 0 = off, 1 = fan, 2 = alarm                                                            |
| `buzzer`                                       | boolean | read       |                                                                                        |
| `mode`                                         | enum    | read/write | 0 = cooling, 1 = heating                                                               |
| `hysteresis`                                   | float   | read/write |                                                                                        |
| `offset`                                       | float   | read/write |                                                                                        |
| `high_temp_limit`                              | float   | read/write |                                                                                        |
| `low_temp_limit`                               | float   | read/write |                                                                                        |
| `compressor_startup_delay`                     | integer | read/write |                                                                                        |
| `compressor_min_cycle_time`                    | integer | read/write |                                                                                        |
| `compressor_restart_delay`                     | integer | read/write |                                                                                        |
| `compressor_min_run_time`                      | integer | read/write |                                                                                        |
| `compressor_continuous_operation`              | integer | read/write |                                                                                        |
| `alarm_delay_after_continuous_operation`       | integer | read       |                                                                                        |
| `compressor_operation_cycle_when_sensor_break` | integer | read       |                                                                                        |
| `compressor_duty_rate_when_sensor_break`       | integer | read       |                                                                                        |
| `defrost_method`                               | enum    | read/write | 0 = heater_time, 1 = hotgas_time, 2 = heater_temperature, 3 = hotgas_temperature       |
| `defrost_cycle`                                | integer | read/write |                                                                                        |

The device information points (`product_number`, `hardware_version`, `software_version`, `model`) are static: read once. The versions are the raw register numbers.

A write checks the value first (a number, in the register range, one of the enum values, true/false for coils) and writes nothing when it is wrong. The factory reset (coil 0x0002) and the communication setup (address, baud rate, parity, stop bits) are not data points, because a wrong write can cut the device off the bus.

## Old field to data point id

The old reader (homy `autonics-tf3`) published one nested object. Each of its fields is one data point here.

| old field                                     | data point id                                        |
| --------------------------------------------- | ---------------------------------------------------- |
| `currentTemp`                                 | `current_temp`                                       |
| `targetTemp`                                  | `target_temp`                                        |
| `temperatureUnit`                             | `temperature_unit`                                   |
| `inputs`                                      | `inputs`                                             |
| `s1Temp`                                      | `s1_temp`                                            |
| `s2Temp`                                      | `s2_temp`                                            |
| `s3Temp`                                      | `s3_temp`                                            |
| `virtualTemp`                                 | `virtual_temp`                                       |
| `tempDivisor`                                 | `temp_divisor`                                       |
| `auxEnabled`                                  | `aux_enabled`                                        |
| `compEnabled`                                 | `comp_enabled`                                       |
| `mode`                                        | `mode`                                               |
| `device.model`                                | `model`                                              |
| `device.hardwareVersion`                      | `hardware_version`                                   |
| `device.softwareVersion`                      | `software_version`                                   |
| `device.productNumber`                        | `product_number`                                     |
| `pg1.inputType`                               | `input_type`                                         |
| `pg1.input2Enabled`                           | `input2_enabled`                                     |
| `pg1.input3Type`                              | `input3_type`                                        |
| `pg1.virtualTempRate`                         | `virtual_temp_rate`                                  |
| `pg1.temperatureUnit`                         | `temperature_unit_setting`                           |
| `pg1.input1Correction`                        | `input1_correction`                                  |
| `pg1.input2Correction`                        | `input2_correction`                                  |
| `pg1.input3Correction`                        | `input3_correction`                                  |
| `pg1.displayDelay`                            | `display_delay`                                      |
| `pg1.defAuxOutput`                            | `def_aux_output`                                     |
| `pg1.auxOutput`                               | `aux_output`                                         |
| `pg1.buzzer`                                  | `buzzer`                                             |
| `pg2.mode`                                    | `mode` (the same data point as the top-level `mode`) |
| `pg2.hysteresis`                              | `hysteresis`                                         |
| `pg2.offset`                                  | `offset`                                             |
| `pg2.highTempLimit`                           | `high_temp_limit`                                    |
| `pg2.lowTempLimit`                            | `low_temp_limit`                                     |
| `pg2.compressorStartupDelay`                  | `compressor_startup_delay`                           |
| `pg2.compressorMinCycleTime`                  | `compressor_min_cycle_time`                          |
| `pg2.compressorRestartDelay`                  | `compressor_restart_delay`                           |
| `pg2.compressorMinRunTime`                    | `compressor_min_run_time`                            |
| `pg2.compressorContinuousOperation`           | `compressor_continuous_operation`                    |
| `pg2.alarmDelayAfterContinuousOperation`      | `alarm_delay_after_continuous_operation`             |
| `pg2.compressorOperationCycleWhenSensorBreak` | `compressor_operation_cycle_when_sensor_break`       |
| `pg2.compressorDutyRateWhenSensorBreak`       | `compressor_duty_rate_when_sensor_break`             |
| `pg3.defrostMethod`                           | `defrost_method`                                     |
| `pg3.defrostCycle`                            | `defrost_cycle`                                      |

Differences from the old reader:

- Enums are numbers, not text (see the table above for the labels).
- `device.productNumber` is read unsigned. The old reader combined the two registers with a signed shift, which gives a negative number from 2^31 up.
- The old reader published only when something changed, with its own heartbeat. The MQTT bridge does that now.
- The old reader read the decimal-point register and then cached it. This driver reads it with every temperature.
- The old reader slept the response delay (0x0134) before every request. This driver does not (see Response delay).
- The old `setup()` could write `inputType`, `input2Enabled`, `input3Type` and the temperature unit setting. They are read-only here, because they change the scale or the meaning of the readings, so a stray write would make every value wrong.

## Testing

```bash
npm test
```

`src/emulator.test.ts` runs the driver against `@ya-modbus/emulator` over TCP: it reads every data point, and writes `target_temp` and reads it back.
