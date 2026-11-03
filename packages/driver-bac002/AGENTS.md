# BAC-002 Driver Package

BAC-002 room thermostat driver.

## Agent Guidelines

- Implements the DeviceDriver interface from `@ya-modbus/driver-types`
- Uses SDK utilities from `@ya-modbus/driver-sdk` for validation and error messages
- One read of holding registers 0-10 returns every data point
- Data points are a list of fields in `src/index.ts`. A field with an `encode` function can be
  written, with function 6 (write single register)
- Enum data points use the text values of the old reader (`off`, `heating`, `mon`, ...)
- Registers 0-7 follow the vendor document `docs/bac-1000-modbus-protocol.pdf`. Registers
  8-10 are not in it: they come from the old reader and the Wiren Board page for the BAC-002ALN

## Testing

`src/index.test.ts` starts `@ya-modbus/emulator` on a free TCP port and connects with
`@ya-modbus/transport`. Test every writable data point (valid values, bad values) and check
the emulator register after each write.

## Interfaces

- DeviceDriver interface: `packages/driver-types/src/device-driver.ts`
- SDK utilities: `packages/driver-sdk/src/index.ts`
