# OR-WE-526 Driver Package

ORNO OR-WE-526 single-phase multi-tariff energy meter driver implementation.

## Agent Guidelines

- Implements DeviceDriver interface from `@ya-modbus/driver-types`
- Registers come from ORNO's register list for the OR-WE-524/525/526 (PDF made 2023-05-31). Our own copy of the list is in `docs/register-map.md`
- Holding registers (FC 03), big-endian. 32-bit values are read high word first, as the old homy reader does on the real meter (the list does not say)
- Read-only. Do not add writes without the owner's go: 0x100C is the baud rate (not the scrolling time, which is 0x100B), and a wrong write can cut the meter off the bus
- Keep the blocks of `src/data-points.ts`. The blocks 0x100 x 12 and 0x10E x 60 are the requests of the old reader; the others are split at documented boundaries
- Settings and identity are `static` (read once); measurements, the clock and the running time are read on every poll

## Testing

Mock transport for decoding and block reads (`src/index.test.ts`). Emulator test over TCP reads every data point (`src/emulator.test.ts`).

## Interfaces

- DeviceDriver interface: `packages/driver-types/src/device-driver.ts`
- SDK utilities: `packages/driver-sdk/src/index.ts`
