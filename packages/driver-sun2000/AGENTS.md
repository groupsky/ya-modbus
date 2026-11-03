# SUN2000 Driver Package

Huawei SUN2000 solar inverter driver implementation (Modbus TCP).

## Agent Guidelines

- Implements DeviceDriver interface from `@ya-modbus/driver-types`
- Holding registers (FC 03), big-endian, high word first for 32-bit values
- Units match the old reader: kW, kVAr, kWh, MΩ (MΩ is not a standard unit, so `insulation_resistance` has no `unit`)
- Active power, reactive power, power factor and internal temperature are signed; the energy counters are unsigned 32-bit
- A full poll is 3 requests: 32080 x 9, 32106 x 2, 32114 x 2. Do not read over 32108-32113 (not in the register list)
- The inverter allows one Modbus TCP connection only
- All data points are read-only; do not add writes or settings

## Testing

Mock transport for decode and block tests; `emulator.integration.test.ts` reads every data point over TCP from the emulator.

## Interfaces

- DeviceDriver interface: `packages/driver-types/src/device-driver.ts`
- SDK utilities: `packages/driver-sdk/src/index.ts`
