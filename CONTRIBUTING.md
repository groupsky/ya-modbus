# Contributing to ya-modbus-mqtt-bridge

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

```bash
# 1. Create test file (next to the source file)
cat > packages/ya-modbus-driver-energymeter/src/my-meter.test.ts << 'EOF'
import { MyMeter } from '../my-meter';
import { ModbusEmulator } from '@ya-modbus/emulator';

describe('MyMeter', () => {
  let emulator: ModbusEmulator;
  let device: MyMeter;

  beforeEach(async () => {
    emulator = new ModbusEmulator();
    emulator.addDevice({
      slaveId: 1,
      type: 'generic',
      registers: {
        0x0000: 230.5,  // voltage
        0x0006: 5.2     // current
      }
    });
    await emulator.start();

    device = new MyMeter({
      slaveId: 1,
      transport: emulator.getTransport()
    });
  });

  afterEach(async () => {
    await emulator.stop();
  });

  it('should read voltage correctly', async () => {
    const data = await device.read(['voltage']);
    expect(data.voltage).toBeCloseTo(230.5, 1);
  });

  it('should read current correctly', async () => {
    const data = await device.read(['current']);
    expect(data.current).toBeCloseTo(5.2, 1);
  });
});
EOF

# 2. Implement device
cat > packages/ya-modbus-driver-energymeter/src/my-meter.ts << 'EOF'
import { ModbusDevice, RegisterDefinition } from '@ya-modbus/core';

export class MyMeter extends ModbusDevice {
  name = 'my-meter';
  vendor = 'VendorName';
  model = 'Model123';

  registers: RegisterDefinition[] = [
    {
      name: 'voltage',
      address: 0x0000,
      type: 'input',
      format: 'float32',
      unit: 'V',
      pollType: 'dynamic'
    },
    {
      name: 'current',
      address: 0x0006,
      type: 'input',
      format: 'float32',
      unit: 'A',
      pollType: 'dynamic'
    }
  ];
}
EOF

# 3. Run tests
npm test --workspace=packages/devices

# 4. Commit with tests
git add packages/ya-modbus-driver-energymeter/src/{my-meter.ts,my-meter.test.ts}
git commit -m "feat(devices): add MyMeter energy meter driver

- Reads voltage and current from holding registers
- Uses float32 format
- Includes comprehensive test coverage"
```

#### Example 2: Fixing a Bug

```bash
# 1. Write test that reproduces the bug
cat > packages/core/polling-bug.test.ts << 'EOF'
import { PollingEngine } from '../polling';

describe('PollingEngine - Bug #123', () => {
  it('should not crash when device disconnects during poll', async () => {
    const engine = new PollingEngine();
    const device = createMockDevice();

    engine.addDevice(device);

    // Simulate disconnection during poll
    device.disconnect();

    // Should not throw
    await expect(engine.poll()).resolves.not.toThrow();
  });
});
EOF

# 2. Fix the bug
# Edit packages/core/src/polling.ts to handle disconnection

# 3. Run tests
npm test --workspace=packages/core

# 4. Commit with test
git commit -m "fix(core): handle device disconnection during poll

Fixes #123

- Add null check before polling disconnected devices
- Includes regression test"
```

#### Example 3: Adding Core Feature

```bash
# 1. Write tests for the feature
cat > packages/core/multi-register-optimization.test.ts << 'EOF'
import { ReadOptimizer } from '../read-optimizer';

describe('ReadOptimizer', () => {
  let optimizer: ReadOptimizer;

  beforeEach(() => {
    optimizer = new ReadOptimizer();
  });

  it('should batch adjacent registers', () => {
    const registers = [
      { address: 0, type: 'holding' },
      { address: 1, type: 'holding' },
      { address: 2, type: 'holding' }
    ];

    const operations = optimizer.optimize(registers);

    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      startAddress: 0,
      count: 3
    });
  });

  it('should split on large gaps', () => {
    const registers = [
      { address: 0, type: 'holding' },
      { address: 1, type: 'holding' },
      { address: 50, type: 'holding' }
    ];

    const operations = optimizer.optimize(registers);

    expect(operations).toHaveLength(2);
    expect(operations[0].startAddress).toBe(0);
    expect(operations[1].startAddress).toBe(50);
  });

  it('should not exceed max batch size', () => {
    const registers = Array.from({ length: 200 }, (_, i) => ({
      address: i,
      type: 'holding'
    }));

    const operations = optimizer.optimize(registers, { maxBatchSize: 80 });

    expect(operations.every(op => op.count <= 80)).toBe(true);
  });
});
EOF

# 2. Implement feature
# - Implement batching adjacent registers
# - Add gap detection
# - Add max size handling

# 3. Run tests
npm test --workspace=packages/core

# 4. Commit
git commit -m "feat(core): add multi-register read optimization

- Batches adjacent registers into single reads
- Respects configurable max gap and batch size
- Reduces read operations by 70-90% for typical devices"
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
feat(devices): add SDM630 energy meter driver

Reads voltage, current, and power from holding registers using float32 format.
Includes test suite using emulator.
```

Bad (references previous state):

```
feat(devices): change energy meter to use new format

Updated from int16 to float32.
Removed old parser.
Changed test structure.
```

Good (describes current behavior):

```
fix(core): release mutex on device timeout

Mutex releases automatically when device timeout occurs, preventing deadlock.
Includes regression test for timeout handling.

Fixes #42
```

Bad (references what was wrong):

```
fix(core): fix bug where mutex wasn't released

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

- Node.js 24+ (see `.nvmrc`)
- npm 10+
- Git

### Initial Setup

```bash
# Clone repository
git clone https://github.com/yourusername/ya-modbus-mqtt-bridge.git
cd ya-modbus-mqtt-bridge

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
    "rootDir": "src"
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
    "@ya-modbus/core": "workspace:*"
  }
}
```

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

To contribute a driver to the built-in collection (`@ya-modbus/devices`):

1. Implement using `@ya-modbus/driver-sdk` (same as third-party)
2. Add tests using `@ya-modbus/driver-dev-tools`
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
