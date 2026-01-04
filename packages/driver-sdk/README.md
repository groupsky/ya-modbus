# @ya-modbus/driver-sdk

Runtime SDK for ya-modbus device drivers with transformation utilities and helpers.

## Overview

This package provides reusable utilities for developing Modbus device drivers:

- **Codec functions**: Read/write scaled integer values from/to register buffers
- **Validators**: Type-safe configuration validation with TypeScript type narrowing
- **Error formatting**: Consistent validation error messages

## Installation

```bash
npm install @ya-modbus/driver-sdk
```

## API Reference

### Codec Functions

Utilities for reading and writing scaled integer values from Modbus register buffers.

#### `readScaledUInt16BE(buffer, offset, scale)`

Read and scale an unsigned 16-bit integer from a buffer.

**Parameters:**

- `buffer: Buffer` - Buffer containing register data
- `offset: number` - Byte offset to start reading from
- `scale: number` - Scale factor (e.g., 10 for ×10 values)

**Returns:** `number` - Scaled floating-point value

**Throws:** Error if scale is not a finite positive number

**Example:**

```typescript
import { readScaledUInt16BE } from '@ya-modbus/driver-sdk'

// Device stores temperature as integer ×10 (235 = 23.5°C)
const buffer = await transport.readInputRegisters(0, 1)
const temperature = readScaledUInt16BE(buffer, 0, 10)
// temperature = 23.5
```

#### `readScaledInt16BE(buffer, offset, scale)`

Read and scale a signed 16-bit integer from a buffer.

**Parameters:**

- `buffer: Buffer` - Buffer containing register data
- `offset: number` - Byte offset to start reading from
- `scale: number` - Scale factor (e.g., 10 for ×10 values)

**Returns:** `number` - Scaled floating-point value

**Throws:** Error if scale is not a finite positive number

**Example:**

```typescript
import { readScaledInt16BE } from '@ya-modbus/driver-sdk'

// Device stores correction offset as signed integer ×10 (-50 = -5.0°C)
const buffer = await transport.readHoldingRegisters(0x103, 1)
const correction = readScaledInt16BE(buffer, 0, 10)
// correction = -5.0
```

#### `readScaledUInt32BE(buffer, offset, scale)`

Read and scale an unsigned 32-bit integer from a buffer (2 consecutive registers).

**Parameters:**

- `buffer: Buffer` - Buffer containing register data
- `offset: number` - Byte offset to start reading from
- `scale: number` - Scale factor (e.g., 100 for ×100 values)

**Returns:** `number` - Scaled floating-point value

**Throws:** Error if scale is not a finite positive number

**Example:**

```typescript
import { readScaledUInt32BE } from '@ya-modbus/driver-sdk'

// Device stores total energy as 32-bit integer ×100 (1000000 = 10000.00 kWh)
const buffer = await transport.readHoldingRegisters(0x0007, 2)
const totalEnergy = readScaledUInt32BE(buffer, 0, 100)
// totalEnergy = 10000.0
```

#### `writeScaledUInt16BE(value, scale)`

Encode and scale a value to an unsigned 16-bit integer buffer.

**Parameters:**

- `value: number` - Value to encode
- `scale: number` - Scale factor (e.g., 10 for ×10 values)

**Returns:** `Buffer` - 2-byte buffer containing the scaled value

**Throws:** Error if value is not finite, scale is invalid, or scaled value exceeds uint16 range

**Example:**

```typescript
import { writeScaledUInt16BE } from '@ya-modbus/driver-sdk'

// Write humidity correction of 5.5% (stored as 55)
const buffer = writeScaledUInt16BE(5.5, 10)
await transport.writeMultipleRegisters(0x104, buffer)
```

#### `writeScaledInt16BE(value, scale)`

Encode and scale a value to a signed 16-bit integer buffer.

**Parameters:**

- `value: number` - Value to encode
- `scale: number` - Scale factor (e.g., 10 for ×10 values)

**Returns:** `Buffer` - 2-byte buffer containing the scaled value

**Throws:** Error if value is not finite, scale is invalid, or scaled value exceeds int16 range

**Example:**

```typescript
import { writeScaledInt16BE } from '@ya-modbus/driver-sdk'

// Write temperature correction of -3.5°C (stored as -35)
const buffer = writeScaledInt16BE(-3.5, 10)
await transport.writeMultipleRegisters(0x103, buffer)
```

### Validation Functions

Type-safe validators for configuration values with proper TypeScript type narrowing.

#### `createEnumValidator(values)`

Create a type-safe enum validator function.

**Parameters:**

- `values: readonly T[]` - Readonly array of valid enum values

**Returns:** `(value: unknown) => value is T[number]` - Type guard function

**Example:**

```typescript
import { createEnumValidator, formatEnumError } from '@ya-modbus/driver-sdk'

const VALID_BAUD_RATES = [9600, 14400, 19200] as const
type ValidBaudRate = (typeof VALID_BAUD_RATES)[number]

const isValidBaudRate = createEnumValidator(VALID_BAUD_RATES)

if (!isValidBaudRate(value)) {
  throw new Error(formatEnumError('baud rate', VALID_BAUD_RATES))
}
// value is now typed as ValidBaudRate (9600 | 14400 | 19200)
```

#### `createRangeValidator(min, max)`

Create a numeric range validator function.

**Parameters:**

- `min: number` - Minimum valid value (inclusive)
- `max: number` - Maximum valid value (inclusive)

**Returns:** `(value: unknown) => value is number` - Validator function

**Example:**

```typescript
import { createRangeValidator, formatRangeError } from '@ya-modbus/driver-sdk'

const isValidAddress = createRangeValidator(1, 247)

if (!isValidAddress(value)) {
  throw new Error(formatRangeError('device address', 1, 247))
}
// value is a finite number between 1 and 247
```

#### `isValidInteger(value)`

Validate that a value is a finite integer.

**Parameters:**

- `value: unknown` - Value to validate

**Returns:** `value is number` - True if value is a finite integer

**Example:**

```typescript
import { isValidInteger } from '@ya-modbus/driver-sdk'

if (!isValidInteger(value)) {
  throw new Error('Device address must be an integer')
}
```

### Error Formatting

Utilities for consistent validation error messages.

#### `formatRangeError(name, min, max)`

Format a range validation error message.

**Parameters:**

- `name: string` - Field name for the error message
- `min: number` - Minimum valid value
- `max: number` - Maximum valid value

**Returns:** `string` - Formatted error message

**Example:**

```typescript
import { formatRangeError } from '@ya-modbus/driver-sdk'

formatRangeError('device address', 1, 247)
// => 'Invalid device address: must be between 1 and 247'
```

#### `formatEnumError(name, values)`

Format an enum validation error message.

**Parameters:**

- `name: string` - Field name for the error message
- `values: readonly unknown[]` - Valid enum values

**Returns:** `string` - Formatted error message

**Example:**

```typescript
import { formatEnumError } from '@ya-modbus/driver-sdk'

formatEnumError('baud rate', [9600, 14400, 19200])
// => 'Invalid baud rate: must be one of 9600, 14400, 19200'
```

## Edge Case Handling

All codec functions include comprehensive edge case validation:

- **Division by zero**: Scale must be greater than 0
- **Non-finite values**: NaN and Infinity are rejected
- **Integer overflow**: Values exceeding uint16/int16 ranges throw errors
- **Negative scale**: Scale must be positive

**Example:**

```typescript
// Throws: Invalid scale: must be greater than 0
readScaledUInt16BE(buffer, 0, 0)

// Throws: Invalid value: must be a finite number
writeScaledUInt16BE(NaN, 10)

// Throws: Invalid scaled value: 65536 is outside uint16 range (0 to 65535)
writeScaledUInt16BE(6553.6, 10)
```

## TypeScript Support

All functions include full TypeScript type definitions with type narrowing support:

```typescript
const isValidBaudRate = createEnumValidator([9600, 14400, 19200] as const)

let value: unknown = getUserInput()

if (isValidBaudRate(value)) {
  // TypeScript knows: value is 9600 | 14400 | 19200
  const encoded = encodeBaudRate(value)
}
```

## Usage in Drivers

Typical driver implementation pattern:

```typescript
import type { DeviceDriver } from '@ya-modbus/driver-types'
import {
  readScaledUInt16BE,
  readScaledInt16BE,
  writeScaledUInt16BE,
  createEnumValidator,
  formatEnumError,
} from '@ya-modbus/driver-sdk'

const VALID_BAUD_RATES = [9600, 14400, 19200] as const
const isValidBaudRate = createEnumValidator(VALID_BAUD_RATES)

export const createDriver = async (config): Promise<DeviceDriver> => {
  // Validate configuration
  if (!isValidBaudRate(config.baudRate)) {
    throw new Error(formatEnumError('baud rate', VALID_BAUD_RATES))
  }

  return {
    name: 'my-device',

    async readDataPoint(id: string) {
      if (id === 'temperature') {
        const buffer = await transport.readInputRegisters(0, 1)
        return readScaledUInt16BE(buffer, 0, 10)
      }
      if (id === 'correction') {
        const buffer = await transport.readHoldingRegisters(0x103, 1)
        return readScaledInt16BE(buffer, 0, 10)
      }
    },

    async writeDataPoint(id: string, value: number) {
      if (id === 'correction') {
        const buffer = writeScaledInt16BE(value, 10)
        await transport.writeMultipleRegisters(0x103, buffer)
      }
    },
  }
}
```

## See Also

- [Driver Development Guide](../../docs/DRIVER-DEVELOPMENT.md)
- [Driver Types](../driver-types/README.md)
- [Example Drivers](../driver-xymd1/)

## License

GPL-3.0-or-later
