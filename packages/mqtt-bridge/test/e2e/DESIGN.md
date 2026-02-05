# E2E Integration Testing Design

## Overview

End-to-end integration testing for ya-modbus using real emulated devices, virtual serial ports, and MQTT broker. No mocking of core functionality - only real code and real protocols.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Test Harness                              │
│  - Creates virtual serial ports (socat)                          │
│  - Starts test MQTT broker (Aedes)                               │
│  - Launches emulators on virtual ports                           │
│  - Configures mqtt-bridge to connect to emulated devices         │
│  - Verifies MQTT messages                                        │
│  - Tears down all resources                                      │
└─────────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │  Virtual  │   │  Virtual  │   │   MQTT    │
    │  Serial   │   │  Serial   │   │  Broker   │
    │  Port 1   │   │  Port 2   │   │  (Aedes)  │
    └─────┬─────┘   └─────┬─────┘   └─────▲─────┘
          │               │                 │
          │               │                 │
    ┌─────▼─────┐   ┌─────▼─────┐         │
    │ Emulator  │   │ Emulator  │         │
    │ Device 1  │   │ Devices   │         │
    │ (ex9em)   │   │ 2 & 3     │         │
    │ SlaveID=1 │   │ (xymd1=1, │         │
    │           │   │ or-we=2)  │         │
    └─────┬─────┘   └─────┬─────┘         │
          │               │                 │
          └───────┬───────┘                 │
                  │                         │
            ┌─────▼─────────────────────────┘
            │   MQTT Bridge                 │
            │   - Connects to emulators     │
            │   - Reads device data         │
            │   - Publishes to MQTT         │
            └───────────────────────────────┘
```

## Test Scenarios

### Scenario 1: Single Device on Single Port

- **Setup**: Virtual port pair `/tmp/ttyV0` ↔ `/tmp/ttyV1`
- **Emulator**: Single device (ex9em) on `/tmp/ttyV0`, slave ID 1
- **Bridge**: Connect to `/tmp/ttyV1`, read from slave ID 1
- **Verify**: MQTT messages contain correct data from ex9em device

### Scenario 2: Multiple Devices on Single Port

- **Setup**: Virtual port pair `/tmp/ttyV2` ↔ `/tmp/ttyV3`
- **Emulator**: Two devices on `/tmp/ttyV2`
  - Device 1: xymd1, slave ID 1
  - Device 2: or-we-516, slave ID 2
- **Bridge**: Connect to `/tmp/ttyV3`, read from both slave IDs
- **Verify**: MQTT messages correctly distinguish between devices

### Scenario 3: Concurrent Multi-Port Operation

- **Setup**: Both port pairs running simultaneously
- **Bridge**: Two serial connections, three total devices
- **Verify**: No bus collision, correct data routing, proper mutex behavior

## Component Design

### 1. Virtual Port Manager (`virtual-ports.ts`)

```typescript
interface VirtualPortPair {
  masterPort: string // Port for emulator
  slavePort: string // Port for mqtt-bridge
  socatPid: number
}

class VirtualPortManager {
  createPortPair(baseName: string): Promise<VirtualPortPair>
  cleanup(): Promise<void>
  isPortReady(port: string): Promise<boolean>
}
```

**Responsibilities:**

- Create virtual serial port pairs using socat
- Track socat process PIDs for cleanup
- Wait for port availability before tests proceed
- Clean up all ports and processes on teardown
- Handle errors and timeouts gracefully

**Implementation:**

- Use socat with `pty,rawer,echo=0,link=<path>,perm=0666`
- Store PIDs in Map for cleanup
- Implement proper trap/cleanup handlers
- Wait for symlink creation before returning

### 2. Emulator Manager (`emulator-manager.ts`)

```typescript
interface EmulatorDevice {
  slaveId: number
  driver: string
  registers: RegisterMap
}

interface EmulatorInstance {
  port: string
  devices: EmulatorDevice[]
  emulator: ModbusEmulator
}

class EmulatorManager {
  startEmulator(config: EmulatorInstance): Promise<void>
  stopEmulator(port: string): Promise<void>
  getAllEmulators(): EmulatorInstance[]
  cleanup(): Promise<void>
}
```

**Responsibilities:**

- Configure and start ModbusEmulator instances
- Manage multiple emulators on different ports
- Populate device registers with test data
- Track emulator instances for cleanup
- Support RTU transport on virtual serial ports

**Implementation:**

- Use ModbusEmulator with RTU transport (when available) or memory transport
- Configure realistic device data based on driver specs
- Store emulator instances in Map
- Implement graceful shutdown

### 3. Bridge Test Helper (`bridge-helper.ts`)

```typescript
interface BridgeTestConfig {
  mqttUrl: string
  devices: DeviceConfig[]
  stateFile?: string
}

class BridgeTestHelper {
  startBridge(config: BridgeTestConfig): Promise<MqttBridge>
  stopBridge(): Promise<void>
  waitForDeviceReady(deviceId: string): Promise<void>
  waitForMqttMessage(topic: string): Promise<MqttMessage>
}
```

**Responsibilities:**

- Configure mqtt-bridge with test devices
- Start bridge and wait for initialization
- Subscribe to MQTT topics for verification
- Collect MQTT messages for assertions
- Handle bridge lifecycle

**Implementation:**

- Use existing test broker utilities
- Configure devices to connect to virtual serial ports
- Implement message collection with timeouts
- Support multiple concurrent bridges if needed

### 4. Test Fixture Builder (`fixtures.ts`)

```typescript
interface TestFixture {
  virtualPorts: VirtualPortPair[]
  emulators: EmulatorInstance[]
  broker: TestBroker
  bridge: MqttBridge
  cleanup: () => Promise<void>
}

async function createFixture(scenario: TestScenario): Promise<TestFixture>
```

**Responsibilities:**

- Orchestrate setup of all test components
- Return fully-configured test fixture
- Provide single cleanup function
- Handle setup failures gracefully

## Test Data

### ex9em Device Data (Slave ID 1, Port 1)

```typescript
const EX9EM_TEST_DATA = {
  slaveId: 1,
  driver: '@ya-modbus/driver-ex9em',
  registers: {
    holding: {
      0: 2300, // Voltage L1 * 10 = 230.0V
      2: 2310, // Voltage L2 * 10 = 231.0V
      4: 2305, // Voltage L3 * 10 = 230.5V
      6: 520, // Current L1 * 100 = 5.20A
      8: 530, // Current L2 * 100 = 5.30A
      10: 525, // Current L3 * 100 = 5.25A
      12: 11960, // Power * 10 = 1196.0W
      // ... more registers
    },
  },
}
```

### xymd1 Device Data (Slave ID 1, Port 2)

```typescript
const XYMD1_TEST_DATA = {
  slaveId: 1,
  driver: '@ya-modbus/driver-xymd1',
  registers: {
    holding: {
      0: 250, // Voltage * 10 = 25.0V
      1: 180, // Current * 10 = 18.0A
      2: 4500, // Power = 450W
      // ... more registers
    },
  },
}
```

### or-we-516 Device Data (Slave ID 2, Port 2)

```typescript
const OR_WE_516_TEST_DATA = {
  slaveId: 2,
  driver: '@ya-modbus/driver-or-we-516',
  registers: {
    holding: {
      0: 500, // Temperature * 10 = 50.0°C
      1: 650, // Humidity * 10 = 65.0%
      // ... more registers
    },
  },
}
```

## Expected MQTT Messages

### Port 1, Device 1 (ex9em)

```
Topic: modbus/ex9em-1/data
Payload: {
  "voltage_l1": 230.0,
  "voltage_l2": 231.0,
  "voltage_l3": 230.5,
  "current_l1": 5.20,
  "current_l2": 5.30,
  "current_l3": 5.25,
  "power": 1196.0,
  "timestamp": "2026-02-05T..."
}
```

### Port 2, Device 1 (xymd1)

```
Topic: modbus/xymd1-1/data
Payload: {
  "voltage": 25.0,
  "current": 18.0,
  "power": 450,
  "timestamp": "2026-02-05T..."
}
```

### Port 2, Device 2 (or-we-516)

```
Topic: modbus/or-we-516-2/data
Payload: {
  "temperature": 50.0,
  "humidity": 65.0,
  "timestamp": "2026-02-05T..."
}
```

## Test Flow

### Setup Phase

1. Start test MQTT broker (Aedes)
2. Create virtual serial port pairs
   - Pair 1: `/tmp/ttyV0` ↔ `/tmp/ttyV1`
   - Pair 2: `/tmp/ttyV2` ↔ `/tmp/ttyV3`
3. Wait for ports to be ready (verify symlinks exist)
4. Start emulator on `/tmp/ttyV0` with ex9em device
5. Start emulator on `/tmp/ttyV2` with xymd1 and or-we-516 devices
6. Wait for emulators to be ready

### Bridge Initialization Phase

7. Configure mqtt-bridge with:
   - MQTT broker URL
   - Serial port `/tmp/ttyV1` with ex9em device (slave ID 1)
   - Serial port `/tmp/ttyV3` with xymd1 (slave ID 1) and or-we-516 (slave ID 2)
8. Start mqtt-bridge
9. Wait for bridge to connect to MQTT broker
10. Wait for devices to be initialized

### Verification Phase

11. Subscribe to device data topics
12. Wait for initial poll cycle
13. Verify MQTT messages:
    - Correct topic structure
    - Correct device data values
    - Proper data transformations applied
    - Timestamps present
14. Verify device status messages
15. Verify no error messages

### Teardown Phase

16. Stop mqtt-bridge (wait for graceful shutdown)
17. Stop emulators
18. Kill socat processes
19. Remove virtual port symlinks
20. Stop MQTT broker
21. Verify no resource leaks

## Error Handling

### Timeouts

- Virtual port creation: 10 seconds
- Emulator startup: 5 seconds
- Bridge initialization: 10 seconds
- MQTT message receipt: 15 seconds (allows for poll cycles)

### Failures

- All failures trigger comprehensive cleanup
- Cleanup errors are logged but don't fail tests
- Use `try/finally` for all resource management
- Collect diagnostic logs on failure:
  - socat logs
  - emulator logs
  - bridge logs
  - MQTT messages

### Retries

- Port creation: retry 3 times with 1s delay
- Emulator connection: retry 3 times with 1s delay
- MQTT message wait: extend timeout, don't retry

## Test Organization

```
packages/mqtt-bridge/test/e2e/
├── DESIGN.md                      # This file
├── helpers/
│   ├── virtual-ports.ts           # Virtual port management
│   ├── emulator-manager.ts        # Emulator lifecycle
│   ├── bridge-helper.ts           # Bridge test utilities
│   └── fixtures.ts                # Test fixture builder
├── fixtures/
│   ├── devices/
│   │   ├── ex9em.ts              # ex9em test data
│   │   ├── xymd1.ts              # xymd1 test data
│   │   └── or-we-516.ts          # or-we-516 test data
│   └── scenarios.ts              # Test scenario definitions
└── integration.test.ts           # Main integration test suite
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: E2E Integration Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build packages
        run: npm run build

      - name: Install socat
        run: sudo apt-get update && sudo apt-get install -y socat

      - name: Run E2E integration tests
        run: npm run test:e2e
        env:
          CI: true

      - name: Upload test logs on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-test-logs
          path: |
            /tmp/socat*.log
            /tmp/emulator*.log
            /tmp/bridge*.log
```

## Performance Considerations

### Test Duration

- Target: < 30 seconds for full E2E suite
- Breakdown:
  - Setup: ~5 seconds
  - Bridge init: ~3 seconds
  - Data verification: ~5 seconds
  - Teardown: ~2 seconds
  - Buffer: ~15 seconds

### Resource Limits

- Max 4 virtual port pairs
- Max 6 emulated devices
- Max 2 bridge instances
- MQTT broker supports 10+ concurrent connections

### Optimization

- Run independent scenarios in parallel (if supported by test framework)
- Reuse broker across tests (if isolation allows)
- Use faster poll intervals for tests (1 second vs 10 seconds)
- Skip static register polling in tests (only test dynamic)

## Future Enhancements

### Phase 2

- Test TCP transport in addition to RTU
- Test device discovery functionality
- Test runtime device addition/removal
- Test error scenarios (disconnection, timeouts, CRC errors)
- Test high-frequency polling performance
- Test mutex behavior with concurrent reads

### Phase 3

- Test with physical devices (optional, manual only)
- Benchmark performance metrics
- Long-running stability tests (24+ hours)
- Memory leak detection
- Coverage of all driver types

## References

- Virtual serial ports: See task #1 research results
- ModbusEmulator: packages/emulator/README.md
- MQTT Bridge: packages/mqtt-bridge/README.md
- Test utilities: packages/mqtt-bridge/src/utils/test-utils.ts
- Driver types: packages/driver-types/src/
