# MBSL32DI register map

This is our own list of the Modbus registers of the MBSL32DI, a module with 32 digital inputs sold under the brand "Dio Smart".

There is no manual for this module. The registers below come from the old homy reader, which is the only code known to work on a real module.

## Communication

- Modbus RTU over RS-485. Registers are 16-bit, big-endian.
- The real bus runs at 115200 baud, even parity, 8 data bits, 1 stop bit.
- The factory address is not known.
- "Address" below is the protocol address (0-based).

## Registers

Read both with function code 03 (read holding registers), in one request.

| Address | Access | Meaning                                                   |
| ------- | ------ | --------------------------------------------------------- |
| 0x0000  | R      | Inputs 1-16: bit 0 = input 1 ... bit 15 = input 16 (\*)   |
| 0x0001  | R      | Inputs 17-32: bit 0 = input 17 ... bit 15 = input 32 (\*) |

(\*) The bit order is assumed: the old reader only joins the two registers into one number (register 0x0001 is the high word) and never names single inputs. Check it on a real module.

## Not confirmed: settings registers of the sister module

The sister module MBSL16DI16RO (16 inputs, 16 relay outputs) has a manual: https://nvcnc.net/modbus/MBSL16DI16RO.pdf (seen 2026-11-03). It lists settings registers: slave address (40003), baud rate (40004), parity (40005) and version (40007).

These are **not** confirmed on the MBSL32DI, and the driver does not read them:

- No one has read them on an MBSL32DI.
- The baud rate codes in that manual stop at 57600, but the real MBSL32DI bus runs at 115200. So the 32DI firmware is at least partly different.
