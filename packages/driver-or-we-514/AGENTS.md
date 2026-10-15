# OR-WE-514 Driver Package

ORNO OR-WE-514 single-phase energy meter driver implementation.

## Agent Guidelines

- Implements DeviceDriver interface from `@ya-modbus/driver-types`
- Holding registers (FC 03), big-endian, high word first for 32-bit values
- Power is in W, VAr and VA (the list says 0.001 kW per count, which is 1 W, checked on a real meter)
- Power factor is read signed (the list says INT; not checked on hardware)
- Only register-verified data points are included; do not add unverified registers without a real-meter check
- Settings (0x110 address, 0x111 baud) are not exposed; do not write the parity into the high byte of 0x111 (undocumented)
- A full poll must stay at 8 requests: 0x130 x 2, 0x139 x 2, 0x140 x 2, 0x148 x 2, 0x150 x 2, 0x158 x 1, 0xA000 x 2, 0xA01E x 2. Wider reads are not tried on the meter.

## Testing

Mock transport interface. Test every decode, the block reads and unknown data points.

## Interfaces

- DeviceDriver interface: `packages/driver-types/src/device-driver.ts`
- SDK utilities: `packages/driver-sdk/src/index.ts`
