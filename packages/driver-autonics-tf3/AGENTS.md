# Autonics TF3 Driver Package

Autonics TF3 temperature controller driver implementation.

## Agent Guidelines

- Implements DeviceDriver interface from `@ya-modbus/driver-types`
- The register list comes from the old homy reader, not from the vendor manual (it could not be downloaded). Do not add registers that nothing has checked on a real controller.
- Temperatures are scaled by the decimal-point register (input register 0x03F4). Read it with every temperature read or write; do not hard-code /10 and do not cache it.
- Signed temperatures are read signed. `hysteresis` and `offset` are unsigned.
- Never expose the factory reset (coil 0x0002) or the communication setup (0x0130..0x0134) as writable data points
- Data points live in `src/data-points.ts`; each belongs to a register group that is read whole

## Testing

`src/index.test.ts` uses a mock transport. `src/emulator.test.ts` uses `@ya-modbus/emulator` over TCP and reads every data point.

## Interfaces

- DeviceDriver interface: `packages/driver-types/src/device-driver.ts`
- SDK utilities: `packages/driver-sdk/src/index.ts`
