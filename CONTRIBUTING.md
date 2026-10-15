# Contributing to ya-modbus

Thank you for your interest in contributing! This document outlines the development workflow and testing practices.

## Development Workflow

### Writing Tests

**Tests are essential for all new features and bug fixes:**

1. Write tests to verify the expected behavior
2. Implement the feature or fix
3. Ensure all tests pass
4. Refactor as needed while keeping tests green
5. Commit with tests included

### Workflow Examples

#### Example 1: Adding a New Device Driver

Create the package first (see `docs/NEW-PACKAGE.md`).

```bash
# 1. Create test file (next to the source file)
cat > packages/driver-my-meter/src/index.test.ts << 'EOF'
import type { Transport } from '@ya-modbus/driver-types'

import { createDriver } from './index'

describe('my-meter driver', () => {
  let transport: jest.Mocked<Pick<Transport, 'readInputRegisters'>>

  beforeEach(() => {
    transport = { readInputRegisters: jest.fn() }
  })

  it('should read voltage in volts', async () => {
    // Register 0 holds 0x0901 = 2305, which is 230.5 V
    transport.readInputRegisters.mockResolvedValue(Buffer.from([0x09, 0x01]))
    const driver = await createDriver({ transport: transport as unknown as Transport, slaveId: 1 })

    const voltage = await driver.readDataPoint('voltage')

    expect(voltage).toBeCloseTo(230.5, 1)
  })
})
EOF

# 2. Implement driver
cat > packages/driver-my-meter/src/index.ts << 'EOF'
import { readScaledUInt16BE } from '@ya-modbus/driver-sdk'
import type { CreateDriverFunction, DataPoint, DeviceDriver } from '@ya-modbus/driver-types'

const DATA_POINTS: ReadonlyArray<DataPoint> = [
  { id: 'voltage', name: 'Voltage', type: 'float', unit: 'V', access: 'r', decimals: 1 },
]

export const createDriver: CreateDriverFunction = ({ transport }) => {
  const driver: DeviceDriver = {
    name: 'my-meter',
    manufacturer: 'VendorName',
    model: 'Model123',
    dataPoints: DATA_POINTS,

    async readDataPoint(id) {
      if (id !== 'voltage') throw new Error(`Unknown data point: ${id}`)
      // Input register 0 holds the voltage in tenths of a volt
      const buffer = await transport.readInputRegisters(0, 1)
      return readScaledUInt16BE(buffer, 0, 10)
    },

    writeDataPoint(id) {
      return Promise.reject(new Error(`Data point ${id} is read-only`))
    },

    async readDataPoints(ids) {
      const result: Record<string, unknown> = {}
      for (const id of ids) result[id] = await driver.readDataPoint(id)
      return result
    },
  }

  return Promise.resolve(driver)
}
EOF

# 3. Run tests
npm test --workspace=packages/driver-my-meter

# 4. Commit with tests
git add packages/driver-my-meter/src/{index.ts,index.test.ts}
git commit -m "feat(driver-my-meter): add MyMeter energy meter driver

- Reads voltage from input register 0
- Includes test coverage with a mocked transport"
```

#### Example 2: Fixing a Bug

```bash
# 1. Write test that reproduces the bug
cat > packages/transport/src/retry.last-attempt.test.ts << 'EOF'
import { withRetry } from './retry.js'

describe('withRetry - bug #123', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('should not wait after the last failed attempt', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('timeout'))

    await expect(withRetry(operation, 1)).rejects.toThrow('timeout')

    expect(jest.getTimerCount()).toBe(0)
  })
})
EOF

# 2. Fix the bug
# Edit packages/transport/src/retry.ts to return the error right after the last attempt

# 3. Run tests
npm test --workspace=packages/transport

# 4. Commit with test
git commit -m "fix(transport): skip the retry delay after the last attempt

Fixes #123

- Return the error right after the last attempt
- Includes regression test"
```

#### Example 3: Adding an SDK Feature

```bash
# 1. Write tests for the feature
cat > packages/driver-sdk/src/codec-int32.test.ts << 'EOF'
import { readScaledInt32BE } from './codec'

describe('readScaledInt32BE', () => {
  it('should read and scale a positive int32', () => {
    const buffer = Buffer.from([0x00, 0x00, 0x27, 0x10]) // 10000
    expect(readScaledInt32BE(buffer, 0, 100)).toBe(100.0)
  })

  it('should read and scale a negative int32', () => {
    const buffer = Buffer.from([0xff, 0xff, 0xd8, 0xf0]) // -10000
    expect(readScaledInt32BE(buffer, 0, 100)).toBe(-100.0)
  })

  it('should throw when the buffer is too short', () => {
    expect(() => readScaledInt32BE(Buffer.from([0x00, 0x01]), 0, 100)).toThrow()
  })
})
EOF

# 2. Implement feature
# - Add readScaledInt32BE to packages/driver-sdk/src/codec.ts
# - Validate the scale and the buffer bounds like readScaledUInt32BE

# 3. Run tests
npm test --workspace=packages/driver-sdk

# 4. Commit
git commit -m "feat(driver-sdk): add readScaledInt32BE

- Reads a signed 32-bit value from two consecutive registers
- Divides the value by the scale factor
- Throws when the scale or the buffer bounds are invalid"
```

## Testing Requirements

### Test Coverage

- **Minimum coverage**: 80% for new code
- **Required coverage**: 100% for critical paths (mutex, polling, errors)

Run coverage report:

```bash
npm test -- --coverage
```

### Test Categories

#### 1. Unit Tests

**Location**: Next to the code being tested (e.g., `foo.ts` → `foo.test.ts`)
**Purpose**: Test individual functions/classes in isolation
**Tools**: Jest with mocks

```typescript
// Example: Testing a pure function
import { parseModbusFloat32 } from '../parsers'

describe('parseModbusFloat32', () => {
  it('should parse IEEE 754 float correctly', () => {
    const buffer = Buffer.from([0x43, 0x66, 0x40, 0x00])
    expect(parseModbusFloat32(buffer)).toBeCloseTo(230.5, 1)
  })
})
```

#### 2. Integration Tests

**Location**: Next to the modules being tested with `.integration.test.ts` suffix
**Purpose**: Test interaction between components
**Tools**: Jest with Emulator

```typescript
// Example: Testing device + transport
import { MyDevice } from '../my-device'
import { ModbusEmulator } from '@ya-modbus/emulator'

describe('MyDevice Integration', () => {
  it('should read data via RTU transport', async () => {
    const emulator = new ModbusEmulator({ transport: 'rtu' })
    // ... test device communication
  })
})
```

#### 3. End-to-End Tests

**Location**: Next to entry points with `.e2e.test.ts` suffix
**Purpose**: Test complete workflows
**Tools**: Jest + Emulator + MQTT

```typescript
// Example: Testing full bridge workflow
describe('Bridge E2E', () => {
  it('should poll device and publish to MQTT', async () => {
    // Setup emulator, bridge, MQTT client
    // Verify data flows end-to-end
  })
})
```

### Using the Emulator

**Always use the emulator for device driver tests:**

```typescript
import { ModbusEmulator } from '@ya-modbus/emulator'

const emulator = new ModbusEmulator({
  transport: 'rtu',
  port: '/dev/pts/10', // Virtual serial port
  devices: [
    {
      slaveId: 1,
      type: 'custom',
      registers: {
        // Define register values
        0x0000: 230.5,
        0x0006: 5.2,
      },
    },
  ],
})

await emulator.start()

// Run your tests

await emulator.stop()
```

**Emulator capabilities:**

- Simulate RTU and TCP devices
- Configure register values
- Simulate errors (timeout, CRC, exceptions)
- Test edge cases (disconnection, slow responses)

## Code Style

### TypeScript Standards

- **Strict mode**: Enabled (`strict: true` in tsconfig.json)
- **No `any`**: Use proper types or `unknown`
- **Explicit return types**: For public functions
- **Interface over type**: Prefer interfaces for objects

### Code Comments

**Write for current state only:**

```typescript
// Good: Describes what the code does
// Acquire mutex for RTU devices to prevent bus collisions
if (device.transport === 'rtu') {
  await this.rtuMutex.acquire()
}

// Bad: References previous state or changes
// Changed to use mutex instead of delays
// Previously we used sleep(), now we use proper locking
if (device.transport === 'rtu') {
  await this.rtuMutex.acquire()
}

// Good: Explains non-obvious logic
// Batch registers within 10 addresses to minimize read operations
const gap = current.address - previous.address
if (gap <= 10) {
  currentBatch.push(current)
}

// Bad: Unnecessary temporal commentary
// Updated gap threshold from 5 to 10
// Changed batching logic to be more efficient
const gap = current.address - previous.address
if (gap <= 10) {
  currentBatch.push(current)
}
```

**Guidelines:**

- Describe **why** code exists, not **what changed**
- Explain non-obvious logic or business rules
- Document **current** behavior and constraints
- Git history tracks changes; comments describe current state

### Formatting

```bash
# Format code
npm run format

# Lint code
npm run lint

# Fix lint issues
npm run lint:fix
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Important Guidelines:**

- **Write for current state**: Describe what the code does NOW, not what it did before or will do later
- **Squash-ready**: Assume commits will be squashed, so focus on the end result
- **Avoid temporal references**: No "change", "update", "modify" - describe the current behavior
- **Git provides history**: Don't explain what was removed or what existed before

**Examples:**

Good (describes current state):

```
feat(driver-sdm630): add SDM630 energy meter driver

Reads voltage, current, and power from holding registers using float32 format.
Includes test suite using emulator.
```

Bad (references previous state):

```
feat(driver-sdm630): change energy meter to use new format

Updated from int16 to float32.
Removed old parser.
Changed test structure.
```

Good (describes current behavior):

```
fix(transport): release mutex on device timeout

Mutex releases automatically when device timeout occurs, preventing deadlock.
Includes regression test for timeout handling.

Fixes #42
```

Bad (references what was wrong):

```
fix(transport): fix bug where mutex wasn't released

Previously the mutex would deadlock on timeout.
Now it releases properly.
Updated the tests.
```

Good (describes current state):

```
docs(architecture): document RTU mutex scope

RTU transport uses mutex for serial bus protection.
TCP transport executes operations concurrently without mutex.
Includes flowchart showing transport selection logic.
```

Bad (references changes):

```
docs(architecture): clarify RTU mutex behavior

Changed the documentation to explain mutex better.
Added more details about when mutex is used.
Updated flowchart.
```

## Pull Request Process

### Before Submitting

1. **Tests pass**: `npm test`
2. **Linting passes**: `npm run lint`
3. **Build succeeds**: `npm run build`
4. **Coverage meets minimum**: Check coverage report
5. **Documentation updated**: If adding features

### PR Checklist

- [ ] Tests included for new code
- [ ] All tests pass
- [ ] Coverage ≥ 80% for new code
- [ ] Linting passes
- [ ] Commit messages follow convention
- [ ] Documentation updated (if applicable)
- [ ] CHANGELOG entry added (for user-facing changes)

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated (if applicable)
- [ ] Tested with emulator
- [ ] Tested with real hardware (specify device)

## Checklist

- [ ] Tests included with changes
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings introduced
```

## Development Setup

### Prerequisites

- Node.js 22.12+ or 24 (see `.nvmrc`)
- npm 11+
- Git

### Initial Setup

```bash
# Clone repository
git clone https://github.com/groupsky/ya-modbus.git
cd ya-modbus

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Start development mode (watch)
npm run dev
```

### IDE Setup

**Recommended: VS Code**

Install extensions:

- ESLint
- Prettier
- Jest Runner
- TypeScript Vue Plugin

**Settings** (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "jest.autoRun": "off"
}
```

## Package Development

### Creating a New Package

```bash
# 1. Create package directory
mkdir -p packages/my-package/src

# 2. Initialize package.json
cat > packages/my-package/package.json << 'EOF'
{
  "name": "@ya-modbus/my-package",
  "version": "0.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  }
}
EOF

# 3. Add tsconfig.json
cat > packages/my-package/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src"]
}
EOF

# 4. Write tests FIRST
# 5. Implement package
# 6. Update root package.json workspaces if needed
```

### Package Dependencies

**Inter-package dependencies:**

```json
{
  "dependencies": {
    "@ya-modbus/driver-sdk": "^0.8.0"
  }
}
```

Use a version range that matches the version of the local package. npm then links the local package instead of downloading it.

**External dependencies:**

- Minimize dependencies
- Justify each dependency in PR
- Check bundle size impact

## Contributing Device Drivers

### Third-Party Drivers

Device drivers can be contributed as independent npm packages without modifying this repository.

**Benefits**:

- Independent release cycle
- Own your driver's versioning and maintenance
- Private/proprietary drivers possible
- Faster iteration

**See**: `docs/DRIVER-DEVELOPMENT.md` for complete guide.

### Built-in Drivers

To contribute a driver to this repository, as a `@ya-modbus/driver-<name>` package in `packages/driver-<name>` (see `docs/NEW-PACKAGE.md`):

1. Implement using `@ya-modbus/driver-sdk` (same as third-party)
2. Add tests next to the source, with a mocked `Transport` (see `packages/driver-xymd1/src/index.test.ts`)
3. Test with real hardware
4. Document device quirks and constraints
5. Submit PR with driver + tests

**When to contribute as built-in**:

- Widely-used commercial device
- Open hardware standard
- Reference implementation for similar devices

**When to publish independently**:

- Proprietary devices
- Niche/custom devices
- Company-specific drivers
- Rapid iteration needed

## Testing Best Practices

### Test Naming

```typescript
// Good: Descriptive, behavior-oriented
it('should batch adjacent registers into single read', () => {})
it('should retry on timeout up to 3 times', () => {})
it('should publish error to MQTT when device disconnects', () => {})

// Bad: Vague, implementation-focused
it('works correctly', () => {})
it('calls the function', () => {})
it('updates the internal state', () => {})
```

### Testing Behavior, Not Implementation

**Tests should verify behavior through public APIs, not implementation details.**

This allows refactoring internal code without breaking tests.

```typescript
// Good: Test observable behavior
describe('DevicePolling', () => {
  it('should read voltage value from device', async () => {
    const emulator = new ModbusEmulator()
    emulator.setRegister(0x0000, 230.5)
    await emulator.start()

    const device = new SDM630({ transport: emulator.getTransport() })
    const data = await device.read(['voltage'])

    expect(data.voltage).toBeCloseTo(230.5, 1)
  })
})

// Bad: Test implementation details
describe('DevicePolling', () => {
  it('should call readHoldingRegisters with correct address', async () => {
    const device = new SDM630()
    const spy = jest.spyOn(device.transport, 'readHoldingRegisters')

    await device.read(['voltage'])

    expect(spy).toHaveBeenCalledWith(0x0000, 2)
  })
})

// Good: Test error handling behavior
it('should retry on timeout and eventually fail', async () => {
  const emulator = new ModbusEmulator()
  emulator.simulateTimeout(true)
  await emulator.start()

  const device = new SDM630({ transport: emulator.getTransport() })

  await expect(device.read(['voltage'])).rejects.toThrow('timeout')
})

// Bad: Test retry implementation
it('should call retry function 3 times', async () => {
  const device = new SDM630()
  const retrySpy = jest.spyOn(device, 'retryOperation')

  try {
    await device.read(['voltage'])
  } catch {}

  expect(retrySpy).toHaveBeenCalledTimes(3)
})
```

**Why this matters:**

- Refactoring internal code shouldn't break tests
- Tests document what the code does, not how
- More resilient test suite
- Easier to maintain and understand

### Test Structure

**Use AAA pattern (Arrange, Act, Assert):**

```typescript
it('should calculate power from voltage and current', () => {
  // Arrange
  const device = new MyDevice({ slaveId: 1 })
  device.setData({ voltage: 230, current: 5 })

  // Act
  const power = device.calculatePower()

  // Assert
  expect(power).toBe(1150)
})
```

### Mocking

**Critical Rule: Only mock external dependencies, never internal code.**

Internal code should be tested through public APIs. Mocking internal dependencies couples tests to implementation details and makes refactoring difficult.

```typescript
// Good: Mock external dependencies (MQTT client, serial port, network)
const mockMqtt = {
  publish: jest.fn(),
  subscribe: jest.fn(),
}

const mockSerialPort = {
  open: jest.fn(),
  write: jest.fn(),
  read: jest.fn(),
}

// Bad: Mock internal business logic or modules
const mockPollingEngine = {
  poll: jest.fn().mockResolvedValue(data),
}
const mockDeviceRegistry = {
  getDevice: jest.fn().mockReturnValue(device),
}
// Instead, use real instances and test through public API

// Good: Test behavior, not implementation
it('should publish device data to MQTT', async () => {
  const bridge = new ModbusBridge({ mqtt: mockMqtt })
  await bridge.addDevice({ id: 'test', driver: 'SDM630' })

  await bridge.poll()

  expect(mockMqtt.publish).toHaveBeenCalledWith('modbus/test/data', expect.any(String))
})

// Bad: Test implementation details
it('should call internal polling engine', async () => {
  const bridge = new ModbusBridge()
  await bridge.poll()

  expect(bridge.pollingEngine.poll).toHaveBeenCalled()
  expect(bridge.deviceRegistry.getDevices).toHaveBeenCalled()
})
```

**What counts as external vs internal:**

External (mock these):

- MQTT client libraries
- Serial port communication
- TCP sockets
- File system operations
- HTTP clients
- Database connections

Internal (use real instances):

- Your own modules and classes
- Business logic
- Data transformations
- Register parsing
- Polling engines
- Device drivers (use emulator for hardware)

### Edge Cases

**Test edge cases explicitly:**

```typescript
describe('RegisterParser', () => {
  it('should handle empty buffer', () => {
    expect(() => parse(Buffer.alloc(0))).toThrow()
  })

  it('should handle buffer too small', () => {
    expect(() => parse(Buffer.alloc(2))).toThrow()
  })

  it('should handle NaN values', () => {
    const nanBuffer = Buffer.from([0x7f, 0xc0, 0x00, 0x00])
    expect(parse(nanBuffer)).toBeNaN()
  })

  it('should handle infinity', () => {
    const infBuffer = Buffer.from([0x7f, 0x80, 0x00, 0x00])
    expect(parse(infBuffer)).toBe(Infinity)
  })
})
```

## Documentation

### When to Update Docs

- **New features**: Add to relevant docs
- **API changes**: Update API reference
- **Breaking changes**: Add migration guide
- **Bug fixes**: Update troubleshooting if applicable

### Documentation Locations

- `README.md` - Project overview
- `docs/ARCHITECTURE.md` - System design
- `docs/` - User guides and architectural documentation
- `packages/*/README.md` - Package-specific docs
- `packages/*/AGENTS.md` - Development guides

### Code Documentation

**Use JSDoc for public APIs:**

```typescript
/**
 * Optimizes register reads by batching adjacent registers.
 *
 * @param registers - Array of register definitions to optimize
 * @param options - Optimization options (maxGap, maxBatchSize)
 * @returns Array of optimized read operations
 *
 * @example
 * const registers = [
 *   { address: 0, type: 'holding' },
 *   { address: 1, type: 'holding' }
 * ];
 * const operations = optimizer.optimize(registers);
 * // Returns: [{ startAddress: 0, count: 2 }]
 */
export function optimizeReads(
  registers: RegisterDefinition[],
  options?: OptimizationOptions
): ReadOperation[] {
  // Implementation
}
```

## Common Issues

### Tests Failing

```bash
# Clear Jest cache
npx jest --clearCache

# Run specific test file
npm test -- path/to/test.test.ts

# Run in watch mode
npm test -- --watch

# Verbose output
npm test -- --verbose
```

### Build Errors

```bash
# Clean build artifacts
npm run clean

# Rebuild all packages
npm run build

# Check TypeScript errors
npx tsc --noEmit
```

### Emulator Issues

```bash
# Check if emulator is already running
ps aux | grep emulator

# Kill stuck emulator
pkill -f modbus-emulator

# Use different port
emulator.start({ port: 5503 })
```

## Getting Help

- **GitHub Issues**: Bug reports, feature requests
- **GitHub Discussions**: Questions, ideas
- **Discord**: Real-time chat (link in README)
- **Documentation**: Check `docs/` directory

## License

By contributing, you agree that your contributions will be licensed under the GPL-3.0-or-later License.
