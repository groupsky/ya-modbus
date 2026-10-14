# SDM630 Driver Package

Eastron SDM630 3-phase (+N) energy meter driver implementation.

## Agent Guidelines

- Implements DeviceDriver interface from `@ya-modbus/driver-types`
- All values are IEEE 754 float32 big-endian input registers (FC 04), 2 registers each (use `readFloatBE`)
- Register map: "SDM630 Modbus Protocol" V1.8. Average line current is at 0x2E (not 0x2C)
- A full poll must stay at 6 requests: 0x00 x 80, 0x50 x 8, 0x64 x 4, 0xC8 x 8, 0xE0 x 46, 0x14E x 48. The homy Modbus reader reads these same blocks from a real meter. Do not merge blocks across gaps that were not tested; 80 registers is the meter's limit per request
- Ids follow `driver-or-we-516` where the meaning is the same
- `driver-types` has no unit for degrees or kVAh: leave `unit` unset and say it in the description

## Testing

Mock transport interface. Test every decode, the block reads and unknown data points.

## Interfaces

- DeviceDriver interface: `packages/driver-types/src/device-driver.ts`
- SDK utilities: `packages/driver-sdk/src/index.ts`
