# CLI Transport Layer

## Architecture

Wraps `modbus-serial` to implement Transport interface.

- Implement all 8 Transport methods
- Automatic retry on transient failures
- Return Buffers for consistency with driver interface

## Retry Rationale

RTU on RS-485 has transient bus collisions; auto-retry improves reliability.

## Testing

Mock `modbus-serial` library. Test retry logic by failing N times then succeeding.

See: `src/transport/rtu-transport.test.ts`, `src/transport/tcp-transport.test.ts`

## Interfaces

- Transport interface: `packages/driver-types/src/transport.ts`
- Driver interface: `packages/driver-types/src/device-driver.ts`
