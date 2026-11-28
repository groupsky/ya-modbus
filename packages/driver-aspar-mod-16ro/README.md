# @ya-modbus/driver-aspar-mod-16ro

Aspar MOD-16RO 16-relay output module driver for ya-modbus.

## Device Information

- **Manufacturer**: Aspar
- **Model**: MOD-16RO, a module with 16 relay outputs, DIN rail, RS-485
- **Communication**: Modbus RTU (or ASCII), big-endian 16-bit registers
- **Function codes used by the driver**:
  - FC 03 for registers 0x00-0x01 (version, type and DIP switches)
  - FC 04 for all other registers (settings, packet counters, outputs)
  - FC 05 to switch one output (coil 0x330-0x33F)
- **Default Settings** (from the manual):
  - Address: set with DIP switches 1-5 (0 to 31). There is no factory address; `DEFAULT_CONFIG.defaultAddress` is 1 as a placeholder
  - Baud rate: 19200
  - Parity: None
  - Data bits: 8 (the manual says "Data bits 1", which is a mistake)
  - Stop bits: 1
  - Mode: RTU
- **Supported Settings**: baud rate 2400 to 115200; no, odd or even parity; 7 or 8 data bits; 1 or 2 stop bits; address 1 to 247 (above 31 it can only be set over the bus)

**Function codes 03 and 04.** The manual swaps the usual Modbus names. It calls registers read with FC 03 "input registers" (addresses 3xxxx) and registers read with FC 04 "output registers" (addresses 4xxxx). The driver uses the function codes of the manual, which are also the ones the old homy reader uses on real modules. A check on a real module must confirm these requests work (see [Open questions](#open-questions)).

The register list is in [docs/register-map.md](https://github.com/groupsky/ya-modbus/blob/main/packages/driver-aspar-mod-16ro/docs/register-map.md). It is written from the Aspar user manual v1.6, see [Sources](#sources).

## Installation

```bash
npm install @ya-modbus/driver-aspar-mod-16ro
```

## Usage

```typescript
import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-aspar-mod-16ro'
import { createRTUTransport } from '@ya-modbus/transport'

// The address set with the DIP switches
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

console.log(await driver.readDataPoints(['outputs', 'output_1']))

// Switch output 1 on
await driver.writeDataPoint('output_1', true)
```

With the MQTT bridge, set `allowWrites: true` in the device config and publish `{"output_1": true}` on `{topicPrefix}/{deviceId}/set`.

## Data Points

"Poll" says when the bridge reads the value: `dynamic` on every poll, `static` once at the start (restart the bridge to see a changed setting).

### Outputs

| ID                         | Register        | Type    | Access     | Poll    | Meaning                                                             |
| -------------------------- | --------------- | ------- | ---------- | ------- | ------------------------------------------------------------------- |
| `outputs`                  | 0x33 (FC 04)    | integer | read       | dynamic | All 16 outputs, bit 0 = output 1                                    |
| `output_1` ... `output_16` | 0x33 bit 0...15 | boolean | read/write | dynamic | One relay output, `true` = on. Write: FC 05 on coil 0x330 ... 0x33F |

A write takes only `true` or `false`.

### Packet counters

Unsigned 32-bit, low word first, read on every poll.

| ID                  | Registers (FC 04) | Meaning                        |
| ------------------- | ----------------- | ------------------------------ |
| `received_packets`  | 0x20-0x21         | Packets the module received    |
| `incorrect_packets` | 0x22-0x23         | Received packets with an error |
| `sent_packets`      | 0x24-0x25         | Packets the module sent        |

### Identity and settings

All are read-only and `static`.

| ID                     | Register               | Type    | Meaning                                                                                   |
| ---------------------- | ---------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `firmware_version`     | 0x00 high byte (FC 03) | float   | Firmware version: the byte divided by 10 (0x0B = 1.1)                                     |
| `module_type`          | 0x00 low byte (FC 03)  | integer | Aspar module type code; MOD-16RO is 7                                                     |
| `switches`             | 0x01 (FC 03)           | integer | DIP switch state, raw value                                                               |
| `baud_rate`            | 0x02 (FC 04)           | integer | Baud rate. Codes 0-6 are 2400-115200; any other value is the baud rate / 10               |
| `data_bits`            | 0x03 high byte (FC 04) | integer | 7 or 8                                                                                    |
| `stop_bits`            | 0x03 low byte (FC 04)  | integer | 1 or 2                                                                                    |
| `parity`               | 0x04 (FC 04)           | enum    | `none`, `odd`, `even`, `mark` (always 1), `space` (always 0); `null` for other codes      |
| `response_delay_ms`    | 0x05 (FC 04)           | integer | Wait before the answer, in ms                                                             |
| `modbus_mode`          | 0x06 (FC 04)           | enum    | `RTU` or `ASCII`; `null` for other codes                                                  |
| `watchdog_ms`          | 0x08 (FC 04)           | integer | Time without a valid message before the outputs go to their default state, in ms; 0 = off |
| `default_output_state` | 0x0C (FC 04)           | integer | Output states after power on or a watchdog reset, bit 0 = output 1                        |

## Requests

A read of all data points takes 4 requests, the same as the old reader: FC 03 0x00 x 2, FC 04 0x02 x 11, FC 04 0x20 x 6, FC 04 0x33 x 1. The bridge reads the static points once, so a poll takes 2 requests (counters and outputs).

## Fields of the old homy reader

The old reader is `docker/modbus-serial/devices/aspar-mod-16ro.js` in homy.

### Read

| Old field            | Data point                                                           |
| -------------------- | -------------------------------------------------------------------- |
| `deviceVersionType`  | `firmware_version` and `module_type` (the raw word split, see below) |
| `switches`           | `switches`                                                           |
| `baudRate`           | `baud_rate`                                                          |
| `stopBits`           | `stop_bits`                                                          |
| `dataBits`           | `data_bits`                                                          |
| `parity`             | `parity` (`always1` is now `mark`, `always0` is now `space`)         |
| `responseDelay`      | `response_delay_ms`                                                  |
| `modbusMode`         | `modbus_mode`                                                        |
| `watchdog`           | `watchdog_ms`                                                        |
| `defaultOutputState` | `default_output_state`                                               |
| `receivedPackets`    | `received_packets`                                                   |
| `incorrectPackets`   | `incorrect_packets`                                                  |
| `sentPackets`        | `sent_packets`                                                       |
| `outputs`            | `outputs`; each bit is also `output_1` ... `output_16`               |

### Written

| Old field          | Data point                                                                  |
| ------------------ | --------------------------------------------------------------------------- |
| `out0` ... `out15` | `output_1` ... `output_16` (the number is 1 higher: `out15` is `output_16`) |

The old reader could also write `def0` ... `def15` (default state coils 0x0C0-0x0CF), `watchdog`, `defaultOutputState`, `outputs` (all outputs at once), the packet counters, and the serial settings (`setup()`). Nothing in homy writes these; homy only writes `out0` ... `out15`. The driver does not write them: a wrong serial setting cuts the module off the bus, and a watchdog can switch relays off.

## Differences from the old reader

The manual and the old reader agree on all addresses and function codes. These are the differences; the driver follows the manual.

- **Version and type.** The old `deviceVersionType` is the raw word of register 0x00. The manual says the high byte is the firmware version x 10 and the low byte the module type. The driver reports them as `firmware_version` and `module_type`.
- **Packet counters above 2^31.** The old reader joins the two words with `msb << 16 | lsb`, which is a signed 32-bit number in JavaScript: a counter above 2147483647 came out negative. The driver reads them unsigned.
- **Stop bits write.** The old `setup()` wrote the stop bits as `val && 0xFF`, which gives 255 instead of 1 or 2 ([groupsky/homy#1706](https://github.com/groupsky/homy/issues/1706)). The driver does not write settings.
- **Parity names.** The old reader called codes 3 and 4 `always1` and `always0`; the driver uses the usual names `mark` and `space`.
- **Settings and identity are read once.** The old reader read them on every report. The bridge reads the `static` data points once at the start.
- **Writes.** Only the outputs can be written (see above). A write takes `true` or `false`; the old reader took any value and used its truth (`!!value`).

The manual has two mistakes of its own: the default settings say "Data bits 1" (the driver uses 8 data bits and 1 stop bit), and the address section says the switches set 0 to 127 while its table and the switch list show 5 switches, 0 to 31.

## Open questions

These need a check on a real module (on a bus where the reader can be stopped):

- **Function codes.** The driver reads 0x00-0x01 with FC 03 and 0x02-0x33 with FC 04, like the old reader. Check that the bridge reads all data points without errors. If the module also answers the other function code with the same values, note it in the register map.
- **Output bits.** `output_n` is bit n-1 of register 0x33 and coil 0x32F + n. homy already switches `out15` and reads bit 15, so this should hold; check that a write of `output_1` switches relay 1 and sets bit 0 of `outputs`.
- **Version and type.** Check that `module_type` is 7 and `firmware_version` looks right (for example 1.1).
- **Data bits and stop bits.** The manual puts stop bits in the low byte of 0x03 and data bits in the high byte. Check that the module reports 8 and 1 (or the real settings).
- **Switches.** The manual does not say which bit of 0x01 is which switch. Compare `switches` with the DIP switches and the address of the module.
- **Counters.** Check that the counters grow and look sane (low word first).

## Sources

- Aspar "RS485 MODBUS Module 16RO" user manual, version 1.6: https://www.aspar.com.pl/katalogi/IOMODULES/16RO_en.pdf (seen 2026-11-03)

## License

GPL-3.0-or-later
