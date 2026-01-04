# @ya-modbus/driver-types

TypeScript type definitions for ya-modbus device drivers.

## Overview

This package provides TypeScript interfaces and types for developing Modbus device drivers. It contains no runtime code - only type definitions designed to be a lightweight dependency.

## Installation

```bash
npm install @ya-modbus/driver-types
```

## Core Types

### DeviceDriver

The main interface that all device drivers must implement:

```typescript
import type { DeviceDriver } from '@ya-modbus/driver-types'

const driver: DeviceDriver = {
  name: 'my-device',
  manufacturer: 'Acme Corp',
  model: 'MD-100',
  dataPoints: [...],

  async readDataPoint(id: string) { ... },
  async writeDataPoint(id: string, value: unknown) { ... },
  async readDataPoints(ids: string[]) { ... },
}
```

### Transport

Abstraction over Modbus RTU/TCP communication:

```typescript
import type { Transport } from '@ya-modbus/driver-types'

// Read holding registers
const buffer = await transport.readHoldingRegisters(0x0000, 2)

// Write single register
await transport.writeSingleRegister(0x0100, 1234)
```

**Transport methods:**

- `readHoldingRegisters(address, count)` - Read holding registers (FC 03)
- `readInputRegisters(address, count)` - Read input registers (FC 04)
- `readCoils(address, count)` - Read coils (FC 01)
- `readDiscreteInputs(address, count)` - Read discrete inputs (FC 02)
- `writeSingleRegister(address, value)` - Write single register (FC 06)
- `writeMultipleRegisters(address, values)` - Write multiple registers (FC 16)
- `writeSingleCoil(address, value)` - Write single coil (FC 05)
- `writeMultipleCoils(address, values)` - Write multiple coils (FC 15)
- `close()` - Close the transport connection

### DataPoint

Defines semantic data points exposed by drivers:

```typescript
import type { DataPoint } from '@ya-modbus/driver-types'

const temperaturePoint: DataPoint = {
  id: 'temperature',
  name: 'Temperature',
  description: 'Current temperature reading',
  unit: '°C',
  dataType: 'float',
  access: 'read',
}
```

### Configuration Types

Types for driver configuration and device defaults:

```typescript
import type {
  DriverConfig,
  DefaultSerialConfig,
  DefaultTCPConfig,
  SupportedSerialConfig,
} from '@ya-modbus/driver-types'

// Factory function configuration
const config: DriverConfig = {
  transport,
  slaveId: 1,
  device: 'or-we-514', // For multi-device drivers
}

// Default serial port configuration
export const DEFAULT_CONFIG = {
  baudRate: 9600,
  parity: 'even',
  dataBits: 8,
  stopBits: 1,
  defaultAddress: 1,
} as const satisfies DefaultSerialConfig

// Supported configuration constraints
export const SUPPORTED_CONFIG = {
  validBaudRates: [9600, 14400, 19200],
  validParity: ['even', 'none'],
} as const satisfies SupportedSerialConfig
```

### Multi-Device Support

Types for drivers that support multiple device models:

```typescript
import type { DeviceRegistry, DeviceInfo } from '@ya-modbus/driver-types'

export const DEVICES = {
  'or-we-514': {
    manufacturer: 'ORNO',
    model: 'OR-WE-514',
    description: 'Single-phase energy meter',
  },
  'or-we-516': {
    manufacturer: 'ORNO',
    model: 'OR-WE-516',
    description: 'Three-phase energy meter',
  },
} as const satisfies DeviceRegistry
```

## Exported Types

| Type                    | Description                      |
| ----------------------- | -------------------------------- |
| `DeviceDriver`          | Main driver interface            |
| `CreateDriverFunction`  | Factory function signature       |
| `DriverConfig`          | Factory function configuration   |
| `Transport`             | Modbus transport interface       |
| `DataPoint`             | Semantic data point definition   |
| `DataType`              | Supported data types             |
| `AccessMode`            | Read/write access modes          |
| `Unit`                  | Standard measurement units       |
| `SlaveId`               | Modbus slave ID (1-247)          |
| `Parity`                | Serial parity settings           |
| `DataBits`              | Serial data bits (7/8)           |
| `StopBits`              | Serial stop bits (1/2)           |
| `BaudRate`              | Serial baud rate                 |
| `DefaultSerialConfig`   | Default RTU configuration        |
| `DefaultTCPConfig`      | Default TCP configuration        |
| `SupportedSerialConfig` | Serial configuration constraints |
| `SupportedTCPConfig`    | TCP configuration constraints    |
| `DeviceInfo`            | Device metadata                  |
| `DeviceRegistry`        | Multi-device registry            |

## See Also

- [Driver SDK](../driver-sdk/) - Runtime utilities for driver development
- [Driver Development Guide](../../docs/DRIVER-DEVELOPMENT.md)
- [Example Drivers](../driver-ex9em/)

## License

GPL-3.0-or-later
