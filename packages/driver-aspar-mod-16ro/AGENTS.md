# MOD-16RO Driver Package

Aspar MOD-16RO 16-relay output module driver implementation.

## Agent Guidelines

- Implements DeviceDriver interface from `@ya-modbus/driver-types`
- Registers come from the Aspar user manual v1.6. Our own copy of the list is in `docs/register-map.md`. Do not add the vendor PDF to the repo
- The manual swaps the usual Modbus names: registers 0x00-0x01 are read with FC 03, all other registers with FC 04. The old homy reader does the same on the real modules. Do not "fix" this without a check on a real module
- Keep the 4 blocks of `src/data-points.ts`: they are the requests of the old reader
- Writes: only `output_1`-`output_16`, each with FC 05 on coil 0x330-0x33F (coil 0x330 + n is bit n of register 0x33). Do not add writes of settings, the watchdog or the counters without the owner's go: a wrong serial setting cuts the module off the bus, and a watchdog can switch relays off
- Settings and identity are `static` (read once); the counters and the outputs are read on every poll

## Testing

Mock transport for decoding, requests and writes (`src/index.test.ts`). Emulator test over TCP reads every data point and writes every output (`src/emulator.test.ts`).

## Interfaces

- DeviceDriver interface: `packages/driver-types/src/device-driver.ts`
