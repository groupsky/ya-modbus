# ORNO OR-WE-526 register map

This is our own list of the Modbus registers of the ORNO OR-WE-526 energy meter. It is written from ORNO's register list "Rejestry OR-WE-524, OR-WE-525 i OR-WE-526" (PDF made 2023-05-31, 7 pages): https://files.orno.pl/support/Others/ORNO/ORWE526_5908254827853/OR-WE-526_rejestry.pdf (seen 2026-11-03). Names are as printed there. Notes in the last column are ours.

## Communication

- Modbus RTU over RS-485. All registers are holding registers: read with function code 03, write with 16 (the list calls it "10 control code").
- Factory settings (from the manual): address 1, 9600 baud, no parity, 1 stop bit.
- Addresses are the protocol addresses (0-based), as in the list.
- `INT32(a+b)` means a signed 32-bit value with `a` digits before and `b` digits after the decimal point: divide by 10^b. The list does not give the word order. The old homy reader reads the high word first and gets correct values.
- Some values exist only on the OR-WE-526 with tariffs (marked "tariff version" below). On a meter without tariffs, T1 holds the total and T2-T4 are 0.

## Instantaneous values

| Address | Registers | Format     | Unit | Name           | Notes                            |
| ------- | --------- | ---------- | ---- | -------------- | -------------------------------- |
| 0x0100  | 2         | INT32(3+3) | V    | voltage        |                                  |
| 0x0102  | 2         | INT32(2+3) | A    | current        | "forward and reverse"            |
| 0x0104  | 2         | INT32(5+0) | W    | active power   |                                  |
| 0x0106  | 2         | INT32(5+0) | VA   | apparent power |                                  |
| 0x0108  | 2         | INT32(5+0) | var  | reactive power |                                  |
| 0x010A  | 1         | INT16(2+1) | Hz   | frequency      |                                  |
| 0x010B  | 1         | INT16(1+3) | PF   | power factor   | Has the sign of the active power |

## Energy

All are 2 registers, `INT32(6+2)`. Each group is total, T1, T2, T3, T4.

| Address       | Unit  | Name                                                 |
| ------------- | ----- | ---------------------------------------------------- |
| 0x010E-0x0116 | kWh   | (T1-T4) total forward active energy                  |
| 0x0118-0x0120 | kWh   | (T1-T4) total reverse active energy                  |
| 0x0122-0x012A | kWh   | (T1-T4) total active energy (by the combined code)   |
| 0x012C-0x0134 | kvarh | (T1-T4) total forward reactive energy                |
| 0x0136-0x013E | kvarh | (T1-T4) total reverse reactive energy                |
| 0x0140-0x0148 | kvarh | (T1-T4) total reactive energy                        |
| 0x014A-0x0152 | kvarh | (T1-T4) total reactive energy in the first quadrant  |
| 0x0154-0x015C | kvarh | (T1-T4) total reactive energy in the second quadrant |
| 0x015E-0x0166 | kvarh | (T1-T4) total reactive energy in the third quadrant  |
| 0x0168-0x0170 | kvarh | (T1-T4) total reactive energy in the fourth quadrant |
| 0x0172        | kWh   | resettable total active energy                       |
| 0x0174        | kvarh | resettable total reactive energy                     |

## Demand

All are 2 registers, `INT32(6+1)`.

| Address | Unit | Name                                 | Notes                        |
| ------- | ---- | ------------------------------------ | ---------------------------- |
| 0x0176  | W    | forward active demand                |                              |
| 0x0178  | W    | forward maximum active energy demand |                              |
| 0x017A  | W    | reverse active demand                |                              |
| 0x017C  | W    | reverse maximum active energy demand |                              |
| 0x0180  | var  | forward reactive demand              | 0x017E-0x017F are not listed |
| 0x0182  | var  | forward maximum reactive demand      |                              |
| 0x0184  | var  | reverse reactive demand              |                              |
| 0x0186  | var  | reverse maximum reactive demand      |                              |

## Meter parameters

| Address | Registers | Access | Values                                                               | Name                        | Notes                                                                   |
| ------- | --------- | ------ | -------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------- |
| 0x1000  | 3         | R/W    | 12 digits in hex, 0123 4567 8910 = 012345678910                      | serial No.                  | The list says length 6 (bytes)                                          |
| 0x1003  | 1         | R/W    | 1-247                                                                | Modbus ID                   |                                                                         |
| 0x1004  | 1         | R      |                                                                      | FW version                  | Example value 101                                                       |
| 0x1005  | 1         | R      |                                                                      | HW version                  |                                                                         |
| 0x1006  | 1         | R      |                                                                      | FW checksum                 |                                                                         |
| 0x1007  | 4         | R/W    | 0, year, month, day, week, hour, minute, second (one byte each)      | time                        | Tariff version. Bytes are BCD (0x26 = 26)                               |
| 0x100B  | 1         | R/W    | 0-99                                                                 | scrolling time              | Seconds (manual)                                                        |
| 0x100C  | 1         | R/W    | 6 = 9600, 7 = 19200, 8 = 38400, 9 = 115200                           | 485 baud rate               |                                                                         |
| 0x100D  | 1         | R/W    | 0 = none, 1 = odd, 2 = even                                          | 485 check digit (parity)    |                                                                         |
| 0x100E  | 1         | R/W    | 1 = 1 bit, 2 = 2 bit                                                 | 485 stop bit                |                                                                         |
| 0x100F  | 1         | R/W    | 1 = forward, 2 = reverse, 3 = forward+reverse, 4 = forward-reverse   | combined code               | How the total active energy is made                                     |
| 0x1010  | 1         |        | 0 = interval, 1 = slip                                               | demand mode                 | The list gives no access                                                |
| 0x1011  | 1         | R/W    | 1-30 minutes, default 15                                             | demand cycle                |                                                                         |
| 0x1012  | 4         | R/W    | bits, 0 = not shown                                                  | cycle display content       | 8 bytes for three-phase meters, 4 bytes for single-phase                |
| 0x1016  | 1         | R/W    | 0000-9999                                                            | password of the LCD buttons |                                                                         |
| 0x1018  | 2         | R/W    | write 0 to clear                                                     | meter running time          | Tariff version. Counts while the current is above 0x101A. No unit given |
| 0x101A  | 2         | R/W    | mA, default: the startup current; up to 1.2 x max current            | timing current value        |                                                                         |
| 0x2002  | 1         | W      | bit 12: resettable active energy, bit 13: resettable reactive energy | clear energy                |                                                                         |
| 0x2003  | 1         | W      | 0xA5XX; bits 0-3: maximum demand values                              | clear maximum demand        | The list prints the bit names with mistakes                             |

## Tariffs (tariff version)

| Address | Registers | Format      | Name                                                |
| ------- | --------- | ----------- | --------------------------------------------------- |
| 0x1700  | 12 each   | hhmmNN x 8  | time period tables 1-8 (0x1700, 0x170C, ... 0x1754) |
| 0x1760  | 12        | MMDDNN x 8  | time zone table                                     |
| 0x176C  | 21        | MMDDNN x 14 | holidays table                                      |

The tables must be written in one write (function code 16).
