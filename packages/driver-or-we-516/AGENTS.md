# OR-WE-516 Driver Package

ORNO OR-WE-516 3-Phase Energy Meter driver implementation.

## Agent Guidelines

- Implements DeviceDriver interface from `@ya-modbus/driver-types`
- Uses SDK utilities from `@ya-modbus/driver-sdk` for validation and encoding
- All floats are IEEE 754 big-endian (use `readFloatBE`/`writeFloatBE`)
- Two register ranges: realtime (0x0000-0x003B) and energy (0x0100-0x012E)

## Testing

Mock transport interface. Test all 56 data points and validation edge cases.

## Interfaces

- DeviceDriver interface: `packages/driver-types/src/device-driver.ts`
- SDK utilities: `packages/driver-sdk/src/index.ts`
