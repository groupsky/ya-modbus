# MBSL32DI Driver Package

MBSL32DI 32 digital input module driver implementation.

## Agent Guidelines

- Implements DeviceDriver interface from `@ya-modbus/driver-types`
- There is no manual for this module. The only known registers come from the old homy reader: FC 03, holding registers 0x0000-0x0001. Our own list is in `docs/register-map.md`
- Do not add the settings registers of the sister module MBSL16DI16RO (address, baud rate, parity, version). They are not confirmed on this module, and its baud codes stop at 57600 while the real bus runs at 115200
- `inputs` is unsigned 32-bit, register 0x0000 is the low word. Do not copy the signed `<< 16` of the old reader
- Read-only: every write is rejected. All data points come from one read of the 2 registers

## Testing

Mock transport for decoding and requests (`src/index.test.ts`). Emulator test over TCP reads every data point (`src/emulator.test.ts`).

## Interfaces

- DeviceDriver interface: `packages/driver-types/src/device-driver.ts`
