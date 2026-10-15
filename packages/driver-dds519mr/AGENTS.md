# DDS519MR Driver Package

Sinotimer DDS519MR single-phase energy meter driver implementation.

## Agent Guidelines

- Implements DeviceDriver interface from `@ya-modbus/driver-types`
- All values are IEEE 754 float32 big-endian input registers (FC 04), 2 registers each (use `readFloatBE`)
- Power is in W, not kW (the manual says kW, checked on real meters)
- Only register-verified data points are included; do not add unverified registers without a real-meter check
- A full poll must stay at 3 requests: 0x00 x 20, 0x2A x 14, 0x100 x 2. Do not read 0x14-0x29 and do not widen the blocks without a real-meter check
- No settings registers and no writes

## Testing

Mock transport interface. Test every decode, the block reads and unknown data points.

## Interfaces

- DeviceDriver interface: `packages/driver-types/src/device-driver.ts`
- SDK utilities: `packages/driver-sdk/src/index.ts`
