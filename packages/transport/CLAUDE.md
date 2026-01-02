# Transport Package

Modbus transport implementations (RTU/TCP) wrapping modbus-serial.

## Agent Guidelines

- Implements Transport interface from `@ya-modbus/driver-types`
- Automatic retry on transient failures (3 attempts, 100ms delay)
- Returns Buffers for consistency with driver interface
- Mock `modbus-serial` in tests, never external boundaries

## Testing

Mock modbus-serial library. Test retry logic by simulating transient failures.

## Interfaces

- Transport interface: `packages/driver-types/src/transport.ts`
- Driver interface: `packages/driver-types/src/device-driver.ts`
