# Aspar MOD-16RO register map

This is our own list of the Modbus registers of the Aspar MOD-16RO relay module. It is written from the Aspar user manual "RS485 MODBUS Module 16RO", version 1.6 (17 pages): https://www.aspar.com.pl/katalogi/IOMODULES/16RO_en.pdf (seen 2026-11-03). Names are as printed there. Notes in the last column are ours.

## Communication

- Modbus RTU or ASCII over RS-485. Registers are 16-bit.
- Factory settings: 19200 baud, no parity, RTU, response delay 0 ms. The manual says "Data bits 1"; this is read as 8 data bits and 1 stop bit.
- Address: DIP switches 1-5 set 0 to 31 (switch 1 = +1 ... switch 5 = +16). Higher addresses can be set over the bus. Switch 6 on at power on restores the factory settings and clears all registers.
- "Address" below is the protocol address (0-based). The manual also gives 1-based numbers (30001, 40003, coil 817).

## Function codes

The manual lists 4 kinds of data, with these function codes:

| Manual name      | Manual numbers | Read | Write  |
| ---------------- | -------------- | ---- | ------ |
| Digital Outputs  | 00001...       | 01   | 05, 15 |
| Digital Inputs   | 10001...       | 02   | -      |
| Input Registers  | 30001...       | 03   | -      |
| Output Registers | 40001...       | 04   | 06, 16 |

This swaps the usual Modbus names: usually FC 03 reads holding registers and FC 04 reads input registers. The driver follows the manual: FC 03 for 0x00-0x01, FC 04 for the rest. The old homy reader does the same on real modules. Whether the module also answers the other function code is not known.

## Registers

| Address | Manual no. | Name                  | Access | Read with | Notes                                                                                                        |
| ------- | ---------- | --------------------- | ------ | --------- | ------------------------------------------------------------------------------------------------------------ |
| 0x00    | 30001      | Version/Type          | R      | FC 03     | High byte: firmware version x 10 (0x0B = 1.1). Low byte: module type, MOD-16RO = 7                           |
| 0x01    | 30002      | Switches              | R      | FC 03     | DIP switch state. The manual does not give the bits                                                          |
| 0x02    | 40003      | Baud rate             | R/W    | FC 04     | 0 = 2400, 1 = 4800, 2 = 9600, 3 = 19200, 4 = 38400, 5 = 57600, 6 = 115200, other = value x 10                |
| 0x03    | 40004      | Stop Bits & Data Bits | R/W    | FC 04     | Low byte: stop bits, 1 or 2. High byte: data bits, 7 or 8                                                    |
| 0x04    | 40005      | Parity                | R/W    | FC 04     | 0 = none, 1 = odd, 2 = even, 3 = always 1, 4 = always 0                                                      |
| 0x05    | 40006      | Response Delay        | R/W    | FC 04     | ms                                                                                                           |
| 0x06    | 40007      | Modbus Mode           | R/W    | FC 04     | 0 = RTU, 1 = ASCII                                                                                           |
| 0x08    | 40009      | Watchdog              | R/W    | FC 04     | ms, 0-65535, 0 = off (default). Without a valid message for this long, all outputs go to their default state |
| 0x0C    | 40013      | Default Output State  | R/W    | FC 04     | Output states after power on or a watchdog reset, bit 0 = output 1                                           |
| 0x20    | 40033      | Received packets LSB  | R/W    | FC 04     | 32-bit counter with 0x21, low word first                                                                     |
| 0x21    | 40034      | Received packets MSB  | R/W    | FC 04     |                                                                                                              |
| 0x22    | 40035      | Incorrect packets LSB | R/W    | FC 04     | 32-bit counter with 0x23, low word first                                                                     |
| 0x23    | 40036      | Incorrect packets MSB | R/W    | FC 04     |                                                                                                              |
| 0x24    | 40037      | Sent packets LSB      | R/W    | FC 04     | 32-bit counter with 0x25, low word first                                                                     |
| 0x25    | 40038      | Sent packets MSB      | R/W    | FC 04     |                                                                                                              |
| 0x33    | 40052      | Outputs               | R/W    | FC 04     | Output states, bit 0 = output 1                                                                              |

Registers 0x07, 0x09-0x0B are not in the manual. The driver reads them as part of the block 0x02-0x0C, like the old reader, and ignores them.

## Coils

| Address     | Manual no. | Name                             | Access | Notes                      |
| ----------- | ---------- | -------------------------------- | ------ | -------------------------- |
| 0x0C0-0x0CF | 193-208    | Default state of output 1 ... 16 | R/W    | Bits 0-15 of register 0x0C |
| 0x330-0x33F | 817-832    | Output 1 ... 16                  | R/W    | Bits 0-15 of register 0x33 |

Coil address = register address x 16 + bit. The driver writes the outputs with FC 05 on coils 0x330-0x33F.

## Module type codes

Register 0x00, low byte. The manual lists the codes of all Aspar modules; for this driver only MOD-16RO = 7 matters. Some others: MOD-8I8O = 0, MOD-16I = 1, MOD-16O = 2, MOD-6RO = 3, MOD-8I8RO = 8.
