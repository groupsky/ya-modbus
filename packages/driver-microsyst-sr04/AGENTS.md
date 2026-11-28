# Microsyst SR04 Driver Package

Microsyst SR04 solar heating systems controller driver implementation.

## Agent Guidelines

- Implements DeviceDriver interface from `@ya-modbus/driver-types`
- Registers come from the maker's manual, revision 2020-10-30, pages 15-16. The register list is in `docs/register-map.md`
- The device answers function codes 01, 03, 05 and 06 only. Never use 16 (write multiple registers): the clock is written with four 06 writes
- The device has an 80 byte buffer. Keep every read block at most 35 registers or 64 coils, and keep the blocks of `src/data-points.ts`: they are the requests the old homy reader made on the real device
- Only the clock is writable. Do not make the settings, the calibration or the serial settings writable without the owner's go: a wrong write can stop the heating control or cut the device off the bus
- Temperatures are signed tenths of a degree. 2070 means "no sensor" and reads as null

## Testing

Mock transport for decoding, block reads and write order (`src/index.test.ts`, `src/clock.test.ts`). Emulator test over TCP reads every data point and writes the clock (`src/emulator.test.ts`).

## Interfaces

- DeviceDriver interface: `packages/driver-types/src/device-driver.ts`
- SDK utilities: `packages/driver-sdk/src/index.ts`
