# Architecture Documentation

## System Overview

ya-modbus-mqtt-bridge is a TypeScript monorepo that bridges Modbus devices (RTU/TCP) to MQTT, solving critical challenges in multi-device deployments:

1. **Bus collision prevention** - Automatic mutex for RTU serial buses
2. **Adaptive polling** - Different rates for dynamic vs static registers
3. **Runtime reconfiguration** - Add/modify/remove devices via MQTT
4. **Device discovery** - Auto-detect devices and connection parameters
5. **Production monitoring** - Comprehensive diagnostics and error publishing

## Core Architecture

### Package Structure

```
@ya-modbus/core         - Bridge orchestration, transport, polling
@ya-modbus/cli          - Command-line tools
@ya-modbus/devices      - Device driver implementations
@ya-modbus/converters   - Optional data normalization layer
@ya-modbus/emulator     - Software Modbus emulator for testing
@ya-modbus/mqtt-config  - Runtime configuration management
```

### Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MQTT Interface                       │
│  (Configuration, Status, Data Publishing, Discovery)    │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
┌─────────────────────────────────────────────────────────┐
│                   Bridge Orchestrator                   │
│  - Device lifecycle management                          │
│  - Polling coordination                                 │
│  - State persistence                                    │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
┌─────────────────────────────────────────────────────────┐
│              Adaptive Polling Engine                    │
│  - Dynamic vs static register handling                  │
│  - Multi-register read optimization                     │
│  - Per-device poll scheduling                           │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
┌─────────────────────────────────────────────────────────┐
│                  Device Abstraction                     │
│  - Driver interface                                     │
│  - Register definitions                                 │
│  - Constraints & protection                             │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
┌─────────────────────────────────────────────────────────┐
│              Mutex Layer (RTU only)                     │
│  - async-mutex for serial bus protection                │
│  - Prevents simultaneous device access                  │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │
┌─────────────────────────────────────────────────────────┐
│                  Transport Layer                        │
│  - RTU (serial) transport                               │
│  - TCP transport                                        │
│  - RTU-over-TCP bridges                                 │
└─────────────────────────────────────────────────────────┘
```

## Key Architectural Decisions

### 1. Mutex Strategy: Transport-Aware Locking

**Problem**: Modbus RTU requires sequential access (single bus), but Modbus TCP supports concurrent connections.

**Solution**: Mutex only for RTU transport (and RTU-over-TCP bridges).

```typescript
class TransportManager {
  private rtuMutex = new Mutex();

  async executeOperation(device: Device, operation: () => Promise<any>) {
    if (device.transport === 'rtu' || device.transport === 'rtu-over-tcp') {
      // Serial bus - requires mutex
      return this.rtuMutex.runExclusive(() => operation());
    } else {
      // TCP - direct execution
      return operation();
    }
  }
}
```

**Rationale**: Maximizes throughput for TCP devices while ensuring RTU safety.

### 2. Adaptive Polling: Three Register Types

**Problem**: Some registers change frequently (voltage), others rarely (serial number).

**Solution**: Three polling strategies with different rates.

| Poll Type    | Use Case                  | Default Interval | Behavior                    |
|--------------|---------------------------|------------------|-----------------------------|
| `dynamic`    | Real-time measurements    | 1-10 seconds     | Continuous polling          |
| `static`     | Device metadata           | Once at startup  | Read once, cache forever    |
| `on-demand`  | Configuration registers   | Never            | Only when explicitly requested |

```typescript
interface RegisterDefinition {
  address: number;
  type: 'coil' | 'discrete' | 'holding' | 'input';
  format: 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32';
  pollType: 'dynamic' | 'static' | 'on-demand';
  pollInterval?: number;  // Override device default
}
```

**Rationale**: Reduces bus traffic by 60-80% compared to uniform polling.

### 3. Multi-Register Read Optimization

**Problem**: Reading registers individually wastes bus bandwidth.

**Solution**: Batch adjacent registers into single read operations.

```typescript
// Example: Reading registers [0, 1, 2, 5, 6, 7]
// Without optimization: 6 read operations
// With optimization: 2 read operations ([0-2], [5-7])

class ReadOptimizer {
  optimizeReads(registers: RegisterDefinition[]): ReadOperation[] {
    const sorted = registers.sort((a, b) => a.address - b.address);
    const batches: ReadOperation[] = [];

    let currentBatch = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].address - sorted[i-1].address;

      // Batch if gap ≤ 10 registers and same type
      if (gap <= 10 && sorted[i].type === sorted[i-1].type) {
        currentBatch.push(sorted[i]);
      } else {
        batches.push(this.createBatch(currentBatch));
        currentBatch = [sorted[i]];
      }
    }

    batches.push(this.createBatch(currentBatch));
    return batches;
  }
}
```

**Configuration**:
```typescript
// Gap threshold configurable per device
deviceConfig.readOptimization = {
  enabled: true,
  maxGap: 10,      // Max gap between registers to batch
  maxBatchSize: 80 // Respect device limits
};
```

**Rationale**: Reduces read operations by 70-90% for typical devices.

### 4. Runtime Configuration via MQTT

**Problem**: Adding/modifying devices requires bridge restart.

**Solution**: MQTT-based configuration with state persistence.

**MQTT Topic Structure**:
```
modbus/
├── config/
│   ├── devices/
│   │   ├── add              # Add new device
│   │   ├── remove           # Remove device
│   │   └── {deviceId}/
│   │       ├── polling      # Update polling config
│   │       ├── enabled      # Enable/disable device
│   │       └── registers    # Update register definitions
│   └── bridge/
│       └── reload           # Reload configuration
│
├── {deviceId}/
│   ├── data                 # Device data publications
│   ├── status/              # Device status
│   └── errors/              # Device errors
│
└── bridge/
    ├── status/              # Bridge status
    └── discovery/           # Discovery results
```

**State Persistence**:
- File: `./data/bridge-state.json` (configurable)
- Format: JSON with semver schema versioning
- Auto-save: On changes + periodic (5 min) + graceful shutdown
- Recovery: Restore devices and polling state on startup

### 5. Device Discovery & Auto-Detection

**Problem**: Manual configuration of serial parameters is error-prone.

**Solution**: Multi-stage discovery process.

```typescript
interface DiscoveryProcess {
  // Stage 1: Serial parameter detection
  baudRates: [9600, 19200, 38400, 115200];
  parities: ['none', 'even', 'odd'];
  stopBits: [1, 2];

  // Stage 2: Device address scan
  slaveIds: range(1, 247);

  // Stage 3: Device type identification
  probeRegisters: [0, 1, 40000, 40001];  // Common addresses
  deviceSignatures: Map<string, RegisterPattern>;
}
```

**Discovery Flow**:
1. Try each serial configuration
2. For each config, scan slave IDs
3. Match responses against device signatures
4. Report matches with confidence scores

**Output**:
```json
{
  "slaveId": 1,
  "baudRate": 9600,
  "parity": "none",
  "deviceType": "SDM630",
  "confidence": 95,
  "manufacturer": "Eastron",
  "model": "SDM630-Modbus"
}
```

### 6. Error Handling & Publishing

**Strategy**: Publish all errors to MQTT for monitoring.

**Error Categories**:
| Category           | Action         | MQTT Topic                        |
|--------------------|----------------|-----------------------------------|
| Timeout            | Retry 3x       | `modbus/{deviceId}/errors/timeout` |
| CRC error          | Retry 3x       | `modbus/{deviceId}/errors/crc`     |
| Invalid response   | Retry 3x       | `modbus/{deviceId}/errors/invalid` |
| Modbus exception   | Log & continue | `modbus/{deviceId}/errors/exception` |
| Connection lost    | Reconnect      | `modbus/{deviceId}/events/disconnected` |

**Error Message Format**:
```json
{
  "timestamp": "2025-12-22T10:30:45.123Z",
  "type": "timeout",
  "operation": "read",
  "address": 0x0000,
  "count": 10,
  "retryAttempt": 3,
  "willRetry": true,
  "message": "Timeout reading holding registers 0-9"
}
```

### 7. Device Constraints & Protection

**Problem**: Devices have different limits and forbidden register ranges.

**Solution**: Per-device constraint configuration.

```typescript
interface DeviceConstraints {
  maxReadRegisters: number;      // Modbus standard: 125
  maxReadCoils: number;           // Modbus standard: 2000
  maxWriteRegisters: number;      // Modbus standard: 123
  maxWriteCoils: number;          // Modbus standard: 1968

  // Forbidden ranges (device-specific)
  forbiddenRead: RegisterRange[];
  forbiddenWrite: RegisterRange[];
}

interface RegisterRange {
  type: 'coil' | 'discrete' | 'holding' | 'input';
  start: number;
  end: number;
  reason?: string;
}
```

**Enforcement**: Validate before operations, reject invalid requests.

### 8. Connection Management & Recovery

**Problem**: Devices disconnect unpredictably (serial adapter removal, network issues).

**Solution**: Automatic reconnection with exponential backoff.

```typescript
class ConnectionRecovery {
  async handleDisconnect(device: Device) {
    let delay = 1000;  // Start with 1 second

    while (!device.connected && delay < 60000) {
      await this.publish(`modbus/${device.id}/status/connected`, 'false');
      await sleep(delay);

      try {
        await device.reconnect();
        await this.publish(`modbus/${device.id}/status/connected`, 'true');
        return;
      } catch (err) {
        delay = Math.min(delay * 2, 60000);  // Cap at 60 seconds
      }
    }
  }
}
```

**Reconnection Triggers**:
- Serial adapter disconnection (USB removal)
- TCP connection timeout
- Repeated communication failures (>10 errors)

### 9. Diagnostics & Issue Detection

**Proactive Issue Detection**:
```typescript
interface DiagnosticChecks {
  highErrorRate: boolean;      // >5% errors
  slowResponses: boolean;       // >500ms average
  connectionFlapping: boolean;  // >10 reconnects/hour
  wrongConfiguration: boolean;  // Consistent CRC errors
  busContention: boolean;       // Should never happen with mutex!
}
```

**Status Publishing**:
```json
{
  "timestamp": "2025-12-22T10:30:45.123Z",
  "connected": true,
  "pollRate": 9.8,
  "avgLatency": 42,
  "errorRate": 0.001,
  "issues": [
    {
      "type": "slow_response",
      "severity": "warning",
      "message": "Average response time: 145ms (threshold: 100ms)"
    }
  ]
}
```

## Data Flow

### 1. Device Registration (Runtime)

```
User → MQTT Publish → modbus/config/devices/add
              ↓
    Bridge receives configuration
              ↓
    Validate configuration (Zod schema)
              ↓
    Instantiate device driver
              ↓
    Add to polling scheduler
              ↓
    Persist to state file
              ↓
    Publish confirmation
```

### 2. Polling Cycle

```
Scheduler triggers poll (interval-based)
              ↓
    Mutex acquire (if RTU)
              ↓
    Optimize register reads (batching)
              ↓
    Execute Modbus read operations
              ↓
    Mutex release (if RTU)
              ↓
    Parse & format data
              ↓
    Publish to MQTT (modbus/{deviceId}/data)
              ↓
    Update statistics & diagnostics
```

### 3. Error Handling Flow

```
Modbus operation fails
              ↓
    Classify error type
              ↓
    Retry logic (3 attempts with backoff)
              ↓
    Publish error to MQTT
              ↓
    Update error statistics
              ↓
    Trigger diagnostics check
              ↓
    If critical: Initiate reconnection
```

## Scaling Considerations

### Performance Targets

| Metric                    | Target         | Notes                              |
|---------------------------|----------------|------------------------------------|
| Devices per bridge        | 50+            | RTU limited by bus speed           |
| Poll rate (RTU)           | 10-50 Hz       | Depends on baud rate & registers   |
| Poll rate (TCP)           | 100+ Hz        | Per device, concurrent             |
| Mutex wait time           | <10ms          | Average wait for RTU devices       |
| Memory per device         | <1MB           | Including polling state            |
| State file size           | <100KB         | For 50 devices                     |

### RTU Bus Limitations

**Serial Bus Math**:
```
Baud rate: 9600 bps
Frame size: ~12 bytes (typical Modbus RTU frame)
Frame time: ~10ms at 9600 baud

For 10 devices @ 9600 baud:
  10 devices × 10ms/frame = 100ms/cycle
  Max poll rate: ~10 Hz across all devices
```

**Optimization Strategies**:
1. Use higher baud rates (38400, 115200) if supported
2. Batch register reads to reduce frame count
3. Prioritize dynamic registers (static polled once)

### TCP Scalability

**Concurrent TCP Devices**:
- No mutex required
- Limited only by network bandwidth and CPU
- Recommended: Max 100 devices per bridge instance

**Horizontal Scaling**:
- Run multiple bridge instances for >100 devices
- Partition by device groups or buildings
- Use MQTT prefix to avoid topic collisions

## Testing Strategy

### Test Pyramid

```
         ╱╲
        ╱  ╲  E2E Tests (Emulator + MQTT)
       ╱────╲
      ╱      ╲  Integration Tests (Device drivers)
     ╱────────╲
    ╱          ╲  Unit Tests (Polling, mutex, parsing)
   ╱────────────╲
```

### Emulator Usage

**Purpose**: Test device drivers without physical hardware.

**Capabilities**:
- Emulate any Modbus device (RTU/TCP)
- Configurable register values
- Simulate errors (timeouts, CRC failures, exceptions)
- Test scenarios (disconnection, slow responses)

**Example**:
```typescript
const emulator = new ModbusEmulator({
  transport: 'rtu',
  port: '/dev/ttyUSB0',
  devices: [
    {
      slaveId: 1,
      type: 'SDM630',
      registers: {
        0x0000: 230.5,  // Voltage
        0x0006: 5.2     // Current
      }
    }
  ]
});

await emulator.start();
```

## Security Considerations

### MQTT Security

- **Authentication**: Support username/password, TLS client certificates
- **Authorization**: Use MQTT ACLs to restrict topic access
- **Encryption**: TLS 1.2+ for MQTT connections

### Modbus Security

- **Input Validation**: Validate all register addresses, counts, values
- **Forbidden Ranges**: Prevent writes to protected registers
- **Rate Limiting**: Prevent DoS via excessive write operations

### State File Security

- **Permissions**: `chmod 600` for state file (owner read/write only)
- **Validation**: Validate schema version before loading
- **Migration**: Safe migration between schema versions

## Deployment Patterns

### Docker Deployment

```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build

# Volume for state persistence
VOLUME /data

CMD ["npm", "start"]
```

**Docker Compose**:
```yaml
version: '3.8'
services:
  modbus-bridge:
    image: ya-modbus-mqtt-bridge
    volumes:
      - ./data:/data
      - /dev/ttyUSB0:/dev/ttyUSB0
    devices:
      - /dev/ttyUSB0
    environment:
      MQTT_BROKER: mqtt://mosquitto:1883
      STATE_FILE: /data/bridge-state.json
```

### Systemd Service

```ini
[Unit]
Description=ya-modbus-mqtt-bridge
After=network.target

[Service]
Type=simple
User=modbus
ExecStart=/usr/bin/node /opt/ya-modbus-mqtt-bridge/dist/index.js
Restart=always
Environment="STATE_FILE=/var/lib/modbus-bridge/state.json"

[Install]
WantedBy=multi-user.target
```

## Monitoring & Observability

### MQTT Status Topics

```
modbus/bridge/status/health     # Overall bridge health
modbus/{deviceId}/status/*      # Per-device status
modbus/{deviceId}/errors/*      # Per-device errors
```

### Integration with Monitoring Systems

**Telegraf**:
```toml
[[inputs.mqtt_consumer]]
  servers = ["tcp://localhost:1883"]
  topics = ["modbus/+/data", "modbus/bridge/status/#"]
  data_format = "json"
```

**Prometheus** (via converter):
- Export metrics in Prometheus format
- Scrape via HTTP endpoint
- Standard Modbus metrics (voltage, current, power)

**Grafana Dashboards**:
- Device overview (status, poll rates, errors)
- Performance metrics (latency, throughput)
- Error trends and diagnostics

## Future Enhancements

### Phase 2 Considerations

1. **Web UI**: Configuration management, device status dashboard
2. **Advanced Discovery**: Device fingerprinting, auto-driver selection
3. **Historical Data**: Optional built-in time-series storage
4. **Redundancy**: High-availability with failover
5. **Cloud Integration**: AWS IoT Core, Azure IoT Hub connectors

### Extensibility Points

- **Custom Transports**: BACnet, KNX, other protocols
- **Custom Converters**: User-defined data transformations
- **Plugin System**: Third-party device drivers
- **Scripting**: Lua/JavaScript for custom logic
