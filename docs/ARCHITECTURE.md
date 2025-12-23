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

### Core Dependencies

**Modbus Protocol**: Uses `modbus-serial` package for Modbus RTU and TCP communication.
- Supports serial ports (RS-485/RS-232) and TCP connections
- Handles low-level protocol framing and CRC
- Provides async/await interface for operations

**Why modbus-serial**: Mature, well-tested library with active maintenance and broad device compatibility.

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
│  - RTU (serial) transport via modbus-serial             │
│  - TCP transport via modbus-serial                      │
│  - RTU-over-TCP bridges                                 │
└─────────────────────────────────────────────────────────┘
```

**Transport Implementation**: Wraps `modbus-serial` to provide:
- Unified interface for RTU and TCP transports
- Connection management and recovery
- Error normalization and retry logic
- Integration with mutex layer for RTU operations

## Key Architectural Decisions

### 1. Mutex Strategy: Transport-Aware Locking

**Problem**: Modbus RTU requires sequential access (single bus), but Modbus TCP supports concurrent connections.

**Solution**: Transport-aware locking - mutex only applied to RTU/RTU-over-TCP operations, TCP operations execute directly without locking.

**Implementation**: `packages/core/src/transport/manager.ts`

**Rationale**: Maximizes throughput for TCP devices while ensuring RTU safety.

### 2. Adaptive Polling: Three Register Types

**Problem**: Some registers change frequently (voltage), others rarely (serial number).

**Solution**: Three polling strategies with different rates.

| Poll Type    | Use Case                  | Default Interval | Behavior                    |
|--------------|---------------------------|------------------|-----------------------------|
| `dynamic`    | Real-time measurements    | 1-10 seconds     | Continuous polling          |
| `static`     | Device metadata           | Once at startup  | Read once, cache forever    |
| `on-demand`  | Configuration registers   | Never            | Only when explicitly requested |

**Register configuration**: Each register specifies address, type, format, poll type, and optional custom interval.

**Implementation**: `packages/core/src/types/register.ts`

**Rationale**: Reduces bus traffic by 60-80% compared to uniform polling.

### 3. Multi-Register Read Optimization

**Problem**: Reading registers individually wastes bus bandwidth.

**Solution**: Batch adjacent registers into single read operations.

**Example**: Reading registers [0, 1, 2, 5, 6, 7]
- Without optimization: 6 read operations
- With optimization: 2 read operations ([0-2], [5-7])

**Algorithm**:
1. Sort registers by address
2. Group consecutive registers with gaps ≤ threshold
3. Ensure groups respect device batch size limits
4. Only batch registers of same type (holding, input, etc.)

**Configuration**: Per-device settings for gap threshold (default: 10 registers) and max batch size (default: 80 registers, per Modbus spec).

**Implementation**: `packages/core/src/polling/read-optimizer.ts`

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

**Discovery Stages**:
1. **Serial parameter detection** - Test combinations of baud rates (9600, 19200, 38400, 115200), parities (none, even, odd), and stop bits (1, 2)
2. **Device address scan** - Probe slave IDs 1-247 for responses
3. **Device type identification** - Match response patterns against known device signatures

**Output**: Discovery results include slave ID, serial parameters, identified device type, confidence score, manufacturer, and model.

**Implementation**: `packages/core/src/discovery/`

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

**Error Message Format**: Published errors include timestamp, error type, operation details (read/write, address, count), retry attempt number, and human-readable message.

### 7. Device Constraints & Protection

**Problem**: Devices have different limits and forbidden register ranges.

**Solution**: Per-device constraint configuration.

**Constraints include**:
- Max read/write sizes (Modbus standard: 125 read registers, 123 write registers, 2000 coils)
- Device-specific forbidden register ranges (both read and write)
- Range specifications include type, start/end addresses, and optional reason

**Enforcement**: Validate all operations before execution, reject requests that violate constraints.

**Implementation**: `packages/core/src/device/constraints.ts`

### 8. Connection Management & Recovery

**Problem**: Devices disconnect unpredictably (serial adapter removal, network issues).

**Solution**: Automatic reconnection with exponential backoff.

**Algorithm**:
1. Start with 1 second delay
2. Publish disconnection status to MQTT
3. Attempt reconnection
4. On failure, double delay (capped at 60 seconds)
5. Repeat until successful or manually stopped

**Reconnection Triggers**:
- Serial adapter disconnection (USB removal)
- TCP connection timeout
- Repeated communication failures (>10 errors)

### 9. Diagnostics & Issue Detection

**Proactive Issue Detection**:
- High error rate (>5% of operations failing)
- Slow responses (>500ms average latency)
- Connection flapping (>10 reconnects per hour)
- Wrong configuration (consistent CRC errors indicating wrong baud rate/parity)
- Bus contention (should never occur with proper mutex usage)

**Status Publishing**: Device status includes timestamp, connection state, poll rate, average latency, error rate, and detected issues with severity levels (warning, error, critical).

### 10. Data Transformation & External API

**Problem**: Device-specific encodings (integers with multipliers, decimal date formats, BCD) should not leak to external consumers.

**Solution**: Two-layer data representation with device drivers owning the transformation.

**Architecture Layers**:

1. **Internal Layer** (device-specific, opaque to consumers):
   - Raw Modbus register definitions with wire formats (int16, uint16, float32, etc.)
   - Device-specific transformations (multipliers, offsets, custom decoders)
   - Register address mappings and batch optimization

2. **External Layer** (standardized API):
   - Semantic data points identified by meaningful IDs ("voltage_l1", "total_energy")
   - Standard data types and units (canonical definitions in `packages/core/src/types/`)
   - Polling configuration by data point, not by register

**Transformation Examples**:

| Device Encoding         | Raw Value | External Value       |
|-------------------------|-----------|----------------------|
| uint16 × 0.1 (voltage)  | 2305      | 230.5 (float)        |
| Decimal date (YYMMDD)   | 251220    | "2025-12-20"         |
| Decimal time (HHMMSS)   | 103045    | "10:30:45"           |
| BCD-encoded             | 0x1234    | 1234 (integer)       |

**Responsibilities**:

- **Device Drivers**: Define data point catalog, implement transformations, optimize register reads
- **Consumers**: Configure polling by semantic data point IDs, receive standardized values
- **Bridge Core**: Provide transformation helpers, define canonical types/units, coordinate polling

**Extensibility**:
- Data types: `packages/core/src/types/data-types.ts`
- Units: `packages/core/src/types/units.ts`
- Standard transforms: `packages/core/src/transforms/`

**Rationale**:
- Consumers configure "what" (voltage, energy) not "how" (register addresses and formats)
- Device complexity is encapsulated and transparent to users
- New data types/units extend the system without modifying existing devices
- Clear separation enables independent device driver development

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

**Usage**: See `packages/emulator/__tests__/examples/` for usage examples.

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

**Container approach**:
- Node.js Alpine base image
- Production dependencies only
- Volume mount for state persistence
- Device passthrough for serial ports

**Configuration**: See `docker/` directory for Dockerfile and Docker Compose examples.

### Systemd Service

**Service configuration**: Simple service type, automatic restart, runs as dedicated user, configurable state file location.

**Configuration**: See `deployment/systemd/` directory for service unit file examples.

## Monitoring & Observability

### MQTT Status Topics

```
modbus/bridge/status/health     # Overall bridge health
modbus/{deviceId}/status/*      # Per-device status
modbus/{deviceId}/errors/*      # Per-device errors
```

### Integration with Monitoring Systems

**Telegraf**: MQTT consumer input plugin subscribes to data and status topics, parses JSON format.

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
