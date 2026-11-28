# Microsyst SR04 register map

This is our own list of the Modbus registers of the Microsyst SR04 solar heating systems controller. It is written from the maker's manual "SR04 Technical description and user manual", revision 2020-10-30, pages 11-16: https://www.microsyst.net/wp-content/uploads/2020/11/SR04_2020-10-30_EN-1.pdf (seen 2026-11-03). The manual has the tables as pictures; the labels below are as printed there. Notes in the last column are ours.

## Communication

- Modbus RTU slave, RS-485 two wire, 9600 or 19200 baud, no parity or even parity, 1 or 2 stop bits.
- Function codes: 01 read coils, 03 read holding registers, 05 write single coil, 06 write single register. There is no 16 (write multiple registers).
- The device has an 80 byte buffer. Do not ask for a longer answer.
- Registers that are not in the list must not be used. A write must stay inside the limits of the setting (see the menu tables of the manual, pages 11-14).
- Addresses are the protocol addresses (0-based), as in the manual.

## Coils (function code 01)

| Address | Label                 | Notes                                                                  |
| ------- | --------------------- | ---------------------------------------------------------------------- |
| 296     | BOILER LOW E1         | Element flag. Probably the menu setting Sens1 (sensor T1 is used)      |
| 297     | SOLAR 2 E4            | Probably Sens4 (second solar collector)                                |
| 298     | ACCUMUL. E5           | Probably Sens5 (storage tank)                                          |
| 299     | HEAT INSTALLATION E6  | Probably Sens6 (three-way valve to the heating system)                 |
| 300     | POOL E7               | Probably Sens7 (pool)                                                  |
| 301     | CHIMNEY E8            | Probably Sens8 (stove or fireplace)                                    |
| 302     | TYPE SENS             | Menu TypSn: PT or NTC sensors. Which value is which is not printed     |
| 303     | TRIAL                 | Trial period is on                                                     |
| 352     | PRIOR                 | The PRIOR button: pool or storage tank first                           |
| 353     | SUM-WIN               | Summer or winter mode                                                  |
| 1000    | 1-TX 9 BIT 0-TX 8 BIT | Bit 0 of the RS485 setting. The menu codes show it as 1 or 2 stop bits |
| 1001    | 1-EVEN PAR 0-NO PAR   | Bit 1 of the RS485 setting: parity                                     |
| 1002    | 1-19200 0-9600 bps    | Bit 2 of the RS485 setting: baud rate                                  |
| 1003    | NO BROADCAST          | Bit 3 of the RS485 setting: 0 = broadcast is taken, 1 = it is not      |
| 2865    | FAST                  | Not explained in the manual                                            |
| 2896    | P1                    | Output P1, pump of solar collector 1                                   |
| 2897    | P2                    | Output P2, pump of solar collector 2                                   |
| 2898    | P3                    | Output P3, valve or pump to the storage tank                           |
| 2899    | P4                    | Output P4, pool                                                        |
| 2900    | P5                    | Output P5, three-way valve from the storage tank to the heating system |
| 2901    | P6                    | Output P6, electric heater or other second source                      |
| 2902    | P7                    | Output P7, stove pump                                                  |
| 2903    | P8                    | Output P8, heating pump                                                |

The manual cuts the first character of the label of 1001. The menu table (page 14) says "Bit 1 - parity 0-no 1-even".

The RS485 menu setting (page 14) is one number made of the 4 bits of coils 1000-1003. The menu lists its 16 values in order: B9n1, B9n2, B9E1, B9E2, B19n1, B19n2, B19E1, B19E2, 9n1, 9n2, 9E1, 9E2, 19n1, 19n2, 19E1, 19E2 ("B" = with broadcast, 9 or 19 = 9600 or 19200 baud, n or E = no or even parity, 1 or 2 = stop bits). The factory value is 0: B9n1. In this order bit 0 (coil 1000) is the only bit that changes 1 to 2 stop bits.

## Holding registers (function code 03)

All values are signed 16 bit, unless the notes say otherwise.

| Address   | Label           | Notes                                                                     |
| --------- | --------------- | ------------------------------------------------------------------------- |
| 0         | Clbr NTC 53,41k | Factory calibration                                                       |
| 2         | Clbr NTC 2,588k | Factory calibration                                                       |
| 4         | Clbr PT 1,000k  | Factory calibration                                                       |
| 6         | Clbr PT 1,385k  | Factory calibration                                                       |
| 12        | Filter          | 1-100, a smaller value filters more                                       |
| 13        | ADC Jump        | Probably the menu setting FZone, zone of the filter, 1-255 °C             |
| 14        | Jump time       | Probably the menu setting ZoneT, (1-255) x 2 s                            |
| 15        | ON1             | Hour 0-23 to switch the electric heater on                                |
| 16        | OFF1            | Hour 0-23 to switch the electric heater off                               |
| 17        | ON2             | As ON1                                                                    |
| 18        | OFF2            | As OFF1                                                                   |
| 19        | ON3             | As ON1                                                                    |
| 20        | OFF3            | As OFF1                                                                   |
| 21        | SP T1           | Boiler set point for heating from sun or stove, 1-100 °C                  |
| 22        | MAX T2          | Max temperature of T2, 1-100 °C                                           |
| 23        | MAX T3,T4       | Max collector temperature, 1-255 °C                                       |
| 24        | MIN T3,T4       | Min collector temperature for an exchange, -20 to 90 °C                   |
| 25        | FREEZ           | Collector freeze protection, -50 to 50 °C                                 |
| 26        | DELTA           | Temperature difference for an exchange, 1-100 °C                          |
| 27        | TOLER           | Tolerance of the solar panel to the electric heater, 1-100 °C             |
| 28        | H               | Hysteresis of P1 and P2, tenths of °C (0-10.0)                            |
| 29        | H2              | Hysteresis of the electric heater P6, tenths of °C (0-10.0)               |
| 30        | H3              | Hysteresis in the other cases, tenths of °C (0-10.0)                      |
| 31        | SP T5           | Storage tank set point, 1-100 °C                                          |
| 32        | SP T7           | Pool set point, 1-100 °C                                                  |
| 33        | MIN T8          | Min stove temperature for an exchange, -20 to 90 °C                       |
| 34        | MAX T8          | Max stove temperature, 1-255 °C                                           |
| 35        | FREEZ T8        | Stove freeze protection, -50 to 50 °C                                     |
| 36        | SHEME           | Basic scheme, 1 or 2                                                      |
| 38        | KickOFF         | Hour 0-23 to stop the "actuality of measurements"                         |
| 39        | KickON          | Hour 0-23 to start the "actuality of measurements"                        |
| 40        | KickPause       | Pause of a pump before it is kicked, 10-255 min                           |
| 41        | KickTime        | How long the pump is kicked, 0-59 s                                       |
| 42        | Time 05 C       | Time to watch for a rise of 0.5 °C, 1-255 s                               |
| 43        | HEAT SP         | Set point of the electric heater                                          |
| 45        | TRIAL TIME      | Not explained                                                             |
| 48        | D Point         | Display: 0 = whole degrees, 1-6 = tenths                                  |
| 123       | SERVICE MODE    | Not explained                                                             |
| 127       | MODBUS ADDRES   | Modbus address, 1-247                                                     |
| 557       | SENS ERR        | Low byte, unsigned                                                        |
| 558       | ADC2            |                                                                           |
| 559       | ADC3            |                                                                           |
| 560       | T1              | Tenths of °C. Boiler, lower sensor                                        |
| 561       | T2              | Tenths of °C. Boiler, top sensor                                          |
| 562       | T3              | Tenths of °C. Solar collector 1                                           |
| 563       | T4              | Tenths of °C. Solar collector 2                                           |
| 564       | T2 (printed)    | Tenths of °C. This is T5, storage tank: the manual prints "T2" by mistake |
| 565       | T6              | Tenths of °C. Return from the heating system                              |
| 566       | T7              | Tenths of °C. Pool                                                        |
| 567       | T8              | Tenths of °C. Stove or fireplace                                          |
| 1024 high | ss              | Clock seconds, BCD                                                        |
| 1024 low  | mm              | Clock minutes, BCD                                                        |
| 1025 high | hh              | Clock hours, BCD                                                          |
| 1025 low  | DayWk           | Week day, not BCD: the value minus 1 is the day, 0 = Sunday               |
| 1026 high | DAY             | Clock day, BCD                                                            |
| 1026 low  | MON             | Clock month, BCD                                                          |
| 1027 high | YEAR            | Clock year 00-99, BCD                                                     |

The low byte of 1027 is not in the list.

The menu (page 11) says: when the minute is set on the front panel, the seconds become 30.

The roles of the sensors T1-T8 and the outputs P1-P8 come from the control rules of the manual (pages 7-11).
