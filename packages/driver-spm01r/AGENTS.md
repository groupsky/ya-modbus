# SPM01R Driver Package

Bituo SPM01R FLEX single-phase energy meter driver implementation.

## Agent Guidelines

- Implements DeviceDriver interface from `@ya-modbus/driver-types`
- The register list comes from the vendor user guide and is NOT yet confirmed on hardware; do not call the driver hardware-verified until `npx ya-modbus read` was run on a real meter
- All floats are IEEE 754 big-endian (ABCD), read with `readFloatBE`
- All 12 measurements come from ONE `readHoldingRegisters(20000, 24)`; keep it a single request
- Active power (register in kW) and apparent power (register in kVA) are multiplied by 1000 to give W and VA; the scale is unconfirmed (a 100 W load should read 0.1)
- Settings 6000 (address), 6001 (baud rate), 6002 (parity) are `rw` and `pollType: 'on-demand'`, written with FC 06
- Baud rate: the guide lists codes 0 and 3 both as 9600; reads accept both, writes use 3
- Parity code 3 (no parity, 2 stop bits) reads as `none` (throwing would break polls); it cannot be written, and writing `none` sets N81
- Energy names: `active_energy_{forward,reverse,total}` are the non-resettable counters (20016-20020); `_resettable` suffix marks 20010-20014. Only 20010 and 20012 are marked resettable in the guide; 20014 is probably, not confirmed
- Never expose 10000 (LED blink), 10001 (energy reset) or 30000 (broadcast address) as data points

## Testing

Mock transport interface. Test every decode, the single block read, settings reads and writes, and validation edge cases. No driver in this repo uses `@ya-modbus/emulator` in its tests.

## Interfaces

- DeviceDriver interface: `packages/driver-types/src/device-driver.ts`
- SDK utilities: `packages/driver-sdk/src/index.ts`
