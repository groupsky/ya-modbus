# @ya-modbus/driver-mbsl32di

MBSL32DI 32 digital input module driver for ya-modbus.

## Device Information

- **Model**: MBSL32DI, a module with 32 digital inputs, RS-485. Sold under the brand "Dio Smart"
- **Communication**: Modbus RTU, big-endian 16-bit registers
- **Function code used by the driver**: FC 03 (read holding registers) on registers 0x0000-0x0001, in one request
- **Settings** (of the real bus; there is no manual):
  - Baud rate: 115200
  - Parity: Even
  - Data bits: 8
  - Stop bits: 1
  - Address: the factory address is not known. `DEFAULT_CONFIG.defaultAddress` is 1 as a placeholder
- **Supported Settings**: only the settings above are known to work. `SUPPORTED_CONFIG` lists only them, plus addresses 1 to 247

The register list is in [docs/register-map.md](https://github.com/groupsky/ya-modbus/blob/main/packages/driver-mbsl32di/docs/register-map.md).

## Installation

```bash
npm install @ya-modbus/driver-mbsl32di
```

## Usage

```typescript
import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-mbsl32di'
import { createRTUTransport } from '@ya-modbus/transport'

// The address of your module
const address = 1

const transport = await createRTUTransport({
  port: '/dev/ttyUSB0',
  baudRate: DEFAULT_CONFIG.baudRate,
  parity: DEFAULT_CONFIG.parity,
  dataBits: DEFAULT_CONFIG.dataBits,
  stopBits: DEFAULT_CONFIG.stopBits,
  slaveId: address,
})

const driver = await createDriver({ transport, slaveId: address })

console.log(await driver.readDataPoints(['inputs', 'input_1', 'input_32']))
```

## Data Points

All data points are read-only and read on every poll. A read of any of them, or of all of them, is one request: FC 03, 2 registers from 0x0000.

| ID                        | Register                              | Type    | Meaning                                                       |
| ------------------------- | ------------------------------------- | ------- | ------------------------------------------------------------- |
| `inputs`                  | 0x0000 (low word), 0x0001 (high word) | integer | All 32 inputs, unsigned 32-bit, bit 0 = input 1 (0 to 2^32-1) |
| `input_1` ... `input_16`  | 0x0000 bit 0 ... 15                   | boolean | One input, `true` = on                                        |
| `input_17` ... `input_32` | 0x0001 bit 0 ... 15                   | boolean | One input, `true` = on                                        |

`input_n` is bit n-1 of `inputs`.

## Fields of the old homy reader

The old reader is `docker/modbus-serial/devices/mbsl32di.js` in homy.

| Old field | Data point                                          |
| --------- | --------------------------------------------------- |
| `inputs`  | `inputs`; each bit is also `input_1` ... `input_32` |

## Differences from the old reader

- **Signed and unsigned.** The old reader joins the two registers with `reg1 << 16 | reg0`. In JavaScript this is a signed 32-bit number, so `inputs` was negative when input 32 was on. The driver's `inputs` is unsigned: 0 to 4294967295. Code that tests a bit with `inputs & (1 << n)` gives the same truth value with both (JavaScript `&` turns both sides into signed 32-bit first). Code that compares `inputs` with a number, or checks `inputs < 0`, must change.
- **Publish on change and the heartbeat.** The old reader returned a value only when an input changed, or after `maxMsBetweenReports`. The driver reads on every poll; publish on change and the heartbeat are now the job of the MQTT bridge.

## Open questions

These need a check on a real module:

- **Bit order.** Is bit 0 of register 0x0000 input 1, and bit 0 of register 0x0001 input 17? The old reader never names single inputs. Switch one input at a time and watch which `input_n` changes.
- **Factory address.** It is not known. 1 is a placeholder.
- **Settings registers.** The sister module MBSL16DI16RO has settings registers (address 40003, baud rate 40004, parity 40005, version 40007; see the [register map](https://github.com/groupsky/ya-modbus/blob/main/packages/driver-mbsl32di/docs/register-map.md#not-confirmed-settings-registers-of-the-sister-module)). Does the MBSL32DI have them too, and with which codes? Its manual's baud rate codes stop at 57600, while the MBSL32DI bus runs at 115200. The driver does not read them until this is checked.

## Sources

- The old homy reader, `docker/modbus-serial/devices/mbsl32di.js`, which works on the real modules
- MBSL16DI16RO manual (sister module, not this one): https://nvcnc.net/modbus/MBSL16DI16RO.pdf (seen 2026-11-03)

## License

GPL-3.0-or-later
