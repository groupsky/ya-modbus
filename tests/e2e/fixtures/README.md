# E2E Fixtures

Configuration files for the E2E tests in `tests/e2e/tests/`.

- `emulators/*.json` configure the emulator (`ya-modbus-emulator --config <file>`)
- `bridge-config.json` and `bridge-config-multi-device.json` configure `mqtt-bridge`
- `mosquitto.conf` configures the MQTT broker of `docker-compose.yml`

The register tables below copy the values of the JSON files. Update them when you change a fixture.

## Virtual Serial Ports

`setup/create-virtual-ports.sh` creates two port pairs with socat. Data written to one port of a pair arrives at the other port.

| Pair | Emulator port | Client port (CLI, bridge, profiler) | Fixtures that use the pair                                                       |
| ---- | ------------- | ----------------------------------- | -------------------------------------------------------------------------------- |
| 1    | `/tmp/ttyV0`  | `/tmp/ttyV1`                        | `port1-single-device.json`, `port1-single-device-alt.json`, `bridge-config.json` |
| 2    | `/tmp/ttyV2`  | `/tmp/ttyV3`                        | `port2-multi-device.json`, `bridge-config-multi-device.json`                     |

The `port1-*` and `port2-*` emulator fixtures use RTU at 9600 baud with even parity and `"lock": false`, because virtual ports do not support exclusive locking. The bridge fixtures use 8 data bits and 1 stop bit. The `tcp-*` emulator fixtures use Modbus TCP and no serial port (see "Modbus TCP Fixtures").

All devices use the same timing, except the device in `tcp-slow-device.json`: `pollingInterval` 10 ms, `commandDetectionDelay` 2-5 ms, `processingDelay` 1-3 ms, `perRegisterDelay` 0.1 ms.

## Reading the Register Tables

- **Address**: the register address in decimal and in hex. The emulator verbose log shows the hex form (`addr=0x002B`).
- **Value**: the stored register value in decimal and in hex. The log shows the hex form with four digits (`0x08FC`).
- **Decoded**: the value after the driver applies its scaling.

The fixtures configure holding registers only. They have no input registers, coils or discrete inputs. The emulator answers a read of a register that is not configured with the value 0, not with a Modbus exception. The emulator serves only the register functions 0x03, 0x04, 0x06 and 0x10.

The `deviceType` and `description` fields in the JSON files are labels. The emulator ignores them.

## EX9EM Register Map

Five fixtures emulate an EX9EM energy meter. The map comes from `packages/driver-ex9em/src/index.ts`.

| Address | Hex      | Driver data point       | Encoding                                                |
| ------- | -------- | ----------------------- | ------------------------------------------------------- |
| 0       | `0x0000` | `voltage`               | value / 10, V                                           |
| 1       | `0x0001` | `current`               | value / 10, A                                           |
| 2       | `0x0002` | `frequency`             | value / 10, Hz                                          |
| 3       | `0x0003` | `active_power`          | W                                                       |
| 4       | `0x0004` | `reactive_power`        | VAr                                                     |
| 5       | `0x0005` | `apparent_power`        | VA                                                      |
| 6       | `0x0006` | `power_factor`          | value / 1000                                            |
| 7-8     | `0x0007` | `total_active_energy`   | 32-bit, register 7 is the high word, value / 100, kWh   |
| 9-10    | `0x0009` | `total_reactive_energy` | 32-bit, register 9 is the high word, value / 100, kVArh |
| 42      | `0x002A` | `baud_rate`             | code: 1 = 1200, 2 = 2400, 3 = 4800, 4 = 9600            |
| 43      | `0x002B` | `device_address`        | 1-247                                                   |

The layout is sparse. Registers 0-10, 42 and 43 are configured. Registers 11-41 and 44 and above are not configured and read as 0. The driver reads registers 0-10 in one request (`func=0x03 addr=0x0000 count=11`).

## Emulator Fixtures

### `emulators/port1-single-device.json`

- **Device**: one EX9EM energy meter, slave ID 1
- **Ports**: emulator on `/tmp/ttyV0`, clients on `/tmp/ttyV1`
- **Used by**: `02-emulator`, `03-mqtt-bridge`, `04-cli` and `05-device-profiler`

Holding registers:

| Address | Hex      | Value (dec) | Value (hex) | Field                            | Decoded                               |
| ------- | -------- | ----------- | ----------- | -------------------------------- | ------------------------------------- |
| 0       | `0x0000` | 2300        | `0x08FC`    | Voltage                          | 230.0 V                               |
| 1       | `0x0001` | 520         | `0x0208`    | Current                          | 52.0 A                                |
| 2       | `0x0002` | 500         | `0x01F4`    | Grid frequency                   | 50.0 Hz                               |
| 3       | `0x0003` | 1196        | `0x04AC`    | Active power                     | 1196 W                                |
| 4       | `0x0004` | 100         | `0x0064`    | Reactive power                   | 100 VAr                               |
| 5       | `0x0005` | 1200        | `0x04B0`    | Apparent power                   | 1200 VA                               |
| 6       | `0x0006` | 990         | `0x03DE`    | Power factor                     | 0.990                                 |
| 7       | `0x0007` | 1234        | `0x04D2`    | Total active energy, high word   | 808771.02 kWh (registers 7 and 8)     |
| 8       | `0x0008` | 5678        | `0x162E`    | Total active energy, low word    |                                       |
| 9       | `0x0009` | 9012        | `0x2334`    | Total reactive energy, high word | 5906138.88 kVArh (registers 9 and 10) |
| 10      | `0x000A` | 3456        | `0x0D80`    | Total reactive energy, low word  |                                       |
| 42      | `0x002A` | 4           | `0x0004`    | Baud rate code                   | 9600 baud                             |
| 43      | `0x002B` | 1           | `0x0001`    | Device address                   | 1                                     |

Registers 11-41 are not configured. Input registers, coils and discrete inputs: none.

### `emulators/port1-single-device-alt.json`

- **Device**: one EX9EM energy meter, slave ID 1, on the same ports as `port1-single-device.json`
- **Used by**: the test "mqtt-bridge reconnects after device comes back online" in `03-mqtt-bridge`

All registers and the timing are the same as in `port1-single-device.json`, except register 0:

| Address | Hex      | Value (dec) | Value (hex) | Field   | Decoded |
| ------- | -------- | ----------- | ----------- | ------- | ------- |
| 0       | `0x0000` | 2400        | `0x0960`    | Voltage | 240.0 V |

### `emulators/port2-multi-device.json`

- **Devices**: an XYMD1 sensor (slave ID 1) and an EX9EM energy meter (slave ID 2) on one bus
- **Ports**: emulator on `/tmp/ttyV2`, clients on `/tmp/ttyV3`
- **Used by**: `02-emulator`, `03-mqtt-bridge`, `04-cli` and `05-device-profiler`

Slave ID 1 (XYMD1), holding registers:

| Address | Hex      | Value (dec) | Value (hex) |
| ------- | -------- | ----------- | ----------- |
| 0       | `0x0000` | 250         | `0x00FA`    |
| 1       | `0x0001` | 450         | `0x01C2`    |
| 2       | `0x0002` | 4500        | `0x1194`    |

The XYMD1 driver does not read these registers. It reads input registers 1 and 2 (temperature and humidity, value / 10) and holding registers `0x0101` to `0x0104` (configuration). The fixture does not configure those, so they read as 0. The profiler tests scan holding registers 0-5 of this device. Registers 3-5 are not configured.

Slave ID 2 (EX9EM), holding registers (map in "EX9EM Register Map"):

| Address | Hex      | Value (dec) | Value (hex) | Field                            | Decoded                               |
| ------- | -------- | ----------- | ----------- | -------------------------------- | ------------------------------------- |
| 0       | `0x0000` | 2200        | `0x0898`    | Voltage                          | 220.0 V                               |
| 1       | `0x0001` | 480         | `0x01E0`    | Current                          | 48.0 A                                |
| 2       | `0x0002` | 500         | `0x01F4`    | Grid frequency                   | 50.0 Hz                               |
| 3       | `0x0003` | 1050        | `0x041A`    | Active power                     | 1050 W                                |
| 4       | `0x0004` | 95          | `0x005F`    | Reactive power                   | 95 VAr                                |
| 5       | `0x0005` | 1150        | `0x047E`    | Apparent power                   | 1150 VA                               |
| 6       | `0x0006` | 950         | `0x03B6`    | Power factor                     | 0.950                                 |
| 7       | `0x0007` | 1111        | `0x0457`    | Total active energy, high word   | 728127.18 kWh (registers 7 and 8)     |
| 8       | `0x0008` | 2222        | `0x08AE`    | Total active energy, low word    |                                       |
| 9       | `0x0009` | 3333        | `0x0D05`    | Total reactive energy, high word | 2184359.32 kVArh (registers 9 and 10) |
| 10      | `0x000A` | 4444        | `0x115C`    | Total reactive energy, low word  |                                       |
| 42      | `0x002A` | 4           | `0x0004`    | Baud rate code                   | 9600 baud                             |
| 43      | `0x002B` | 2           | `0x0002`    | Device address                   | 2                                     |

Registers 11-41 are not configured. Input registers, coils and discrete inputs: none.

## Modbus TCP Fixtures

Both fixtures configure an EX9EM energy meter with slave ID 1 on `127.0.0.1`, transport type `tcp`. Only `07-tcp` uses them. The port in the JSON file is 15502. `start_tcp_emulator` in `helpers.bash` writes a copy of the fixture with the requested port, so tests can use another port. The default port is `$TCP_EMULATOR_PORT` (15502).

### `emulators/tcp-single-device.json`

- **Device**: one EX9EM energy meter, slave ID 1
- **Used by**: the CLI `read` and `write` tests and the profiler scan tests in `07-tcp`

The registers and the timing are the same as in `port1-single-device.json`. Only the transport differs.

### `emulators/tcp-slow-device.json`

- **Device**: one EX9EM energy meter, slave ID 1, that answers every request 1500 ms after it arrives
- **Used by**: the profiler timeout tests in `07-tcp`

The timing has only `processingDelay` 1500 ms. The other timing fields are not set.

Holding registers:

| Address | Hex      | Value (dec) | Value (hex) | Field          | Decoded |
| ------- | -------- | ----------- | ----------- | -------------- | ------- |
| 0       | `0x0000` | 2300        | `0x08FC`    | Voltage        | 230.0 V |
| 1       | `0x0001` | 520         | `0x0208`    | Current        | 52.0 A  |
| 2       | `0x0002` | 500         | `0x01F4`    | Grid frequency | 50.0 Hz |

All other registers are not configured. Input registers, coils and discrete inputs: none.

## Bridge Fixtures

Both fixtures connect to the MQTT broker at `mqtt://localhost:1883` and poll every 100 ms. The bridge publishes each device to `modbus/<deviceId>/data`.

| Fixture                           | Client ID                     | Device ID | Driver                    | Port         | Slave ID | Emulator fixture           |
| --------------------------------- | ----------------------------- | --------- | ------------------------- | ------------ | -------- | -------------------------- |
| `bridge-config.json`              | `ya-modbus-test-bridge`       | `ex9em-1` | `@ya-modbus/driver-ex9em` | `/tmp/ttyV1` | 1        | `port1-single-device.json` |
| `bridge-config-multi-device.json` | `ya-modbus-test-bridge-multi` | `xymd1-1` | `@ya-modbus/driver-xymd1` | `/tmp/ttyV3` | 1        | `port2-multi-device.json`  |
| `bridge-config-multi-device.json` | `ya-modbus-test-bridge-multi` | `ex9em-2` | `@ya-modbus/driver-ex9em` | `/tmp/ttyV3` | 2        | `port2-multi-device.json`  |
