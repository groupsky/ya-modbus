# @ya-modbus/driver-loader

Dynamic driver loader for ya-modbus device drivers.

## Package Purpose

This package provides runtime driver loading and validation functionality for ya-modbus drivers. It supports:

- Auto-detection of drivers from package.json
- Explicit driver package loading
- Runtime validation of driver exports
- Configuration validation (DEFAULT_CONFIG, SUPPORTED_CONFIG, DEVICES)
- Cross-validation of configuration constraints

## Key Modules

- **loader.ts**: Core driver loading functionality
- **config-validator.ts**: Validation of driver configuration exports

## Usage

```typescript
import { loadDriver } from '@ya-modbus/driver-loader'

// Auto-detect driver from current directory
const driver = await loadDriver({})

// Load specific driver package
const driver = await loadDriver({ driverPackage: 'ya-modbus-driver-xymd1' })
```

## Testing Requirements

- Follow TDD approach (test first, then implement)
- Mock filesystem and module imports
- Test both success and error paths
- 95% coverage threshold required
