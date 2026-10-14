# DDS024MR Driver Package

Sinotimer DDS024MR 3-phase (+N) energy meter driver implementation.

## Agent Guidelines

- Implements DeviceDriver interface from `@ya-modbus/driver-types`
- All values are IEEE 754 float32 big-endian input registers (FC 04), 2 registers each (use `readFloatBE`)
- Power is in W and var, not kW (the vendor list is wrong, checked on a real meter)
- Only register-verified data points are included; do not add unverified registers without a real-meter check
- A full poll must stay at 3 requests: 0x00 x 56, 0x100 x 2, 0x400 x 2

## Testing

Mock transport interface. Test every decode, the block reads and unknown data points.

## Interfaces

- DeviceDriver interface: `packages/driver-types/src/device-driver.ts`
- SDK utilities: `packages/driver-sdk/src/index.ts`
