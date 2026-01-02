# @ya-modbus/driver-loader

Dynamic driver loader for ya-modbus device drivers.

## Installation

```bash
npm install @ya-modbus/driver-loader
```

## Usage

### Auto-detect driver from current directory

```typescript
import { loadDriver } from '@ya-modbus/driver-loader'

const driver = await loadDriver({})
```

### Load specific driver package

```typescript
import { loadDriver } from '@ya-modbus/driver-loader'

const driver = await loadDriver({ driverPackage: 'ya-modbus-driver-xymd1' })
```

## API

### `loadDriver(options?: LoadDriverOptions): Promise<LoadedDriver>`

Loads a ya-modbus driver package and validates its exports.

**Options:**

- `driverPackage` (optional): Name of the driver package to load. If omitted, auto-detects from current directory's package.json.

**Returns:**

- `LoadedDriver` object containing:
  - `createDriver`: Factory function to create driver instances (required)
  - `devices`: Device registry for multi-device drivers (optional)
  - `defaultConfig`: Default configuration for serial or TCP (optional)
  - `supportedConfig`: Configuration constraints (optional)

**Throws:**

- Error if driver package is not found
- Error if driver exports are invalid
- Error if configuration validation fails

## License

GPL-3.0-or-later
