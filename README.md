# ya-modbus-mqtt-bridge

> Production-ready Modbus to MQTT bridge with automatic bus collision prevention, adaptive polling, and runtime reconfiguration

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-24+-green.svg)](https://nodejs.org/)

## Features

- **Automatic bus collision prevention** - Zero-config async-mutex for RTU serial buses
- **Adaptive polling** - Different rates for dynamic vs static registers (60-80% traffic reduction)
- **Runtime reconfiguration** - Add/modify/remove devices via MQTT without restart
- **Device discovery** - Auto-detect devices, baud rate, parity, and slave ID
- **Multi-register optimization** - Batch adjacent registers (70-90% fewer operations)
- **Production monitoring** - Comprehensive diagnostics, error publishing, health checks
- **RTU & TCP support** - Serial (RS-485/RS-232) and network Modbus devices
- **Converter ecosystem** - Optional data normalization for InfluxDB, Prometheus, PostgreSQL
- **Software emulator** - Test device drivers without physical hardware
- **Agent-friendly** - TDD workflow, comprehensive documentation, per-directory guides

## Quick Start

### Installation

```bash
npm install -g ya-modbus-mqtt-bridge
```

### Basic Usage

```bash
# Start bridge with configuration file
ya-modbus bridge --config config.json

# Discover devices on serial bus
ya-modbus discover /dev/ttyUSB0

# Test device connectivity
ya-modbus test --device SDM630 --port /dev/ttyUSB0 --slave 1
```

### Configuration Example

```json
{
  "mqtt": {
    "broker": "mqtt://localhost:1883",
    "username": "user",
    "password": "pass"
  },
  "devices": [
    {
      "id": "meter_1",
      "driver": "SDM630",
      "transport": "rtu",
      "port": "/dev/ttyUSB0",
      "baudRate": 9600,
      "slaveId": 1,
      "pollInterval": 5000
    },
    {
      "id": "inverter_1",
      "driver": "SUN2000",
      "transport": "tcp",
      "host": "192.168.1.100",
      "port": 502,
      "slaveId": 1,
      "pollInterval": 10000
    }
  ]
}
```

## Why ya-modbus-mqtt-bridge?

### The Multi-Device Problem

Modbus RTU uses a shared serial bus. Reading from multiple devices simultaneously causes protocol violations:

```
Device 1: Read request →  [Bus collision!]  ← Device 2: Read request
Result: Timeouts, CRC errors, data corruption
```

**Common workaround** (manual delays):
```javascript
await device1.read();
await sleep(100);  // Manual delay - error-prone!
await device2.read();
```

**Our solution** (automatic mutex):
```javascript
await device1.read();  // Mutex acquired automatically
await device2.read();  // Waits for mutex, then executes
// No manual delays, no collisions, no configuration needed
```

### Competitive Analysis

We analyzed 48+ competing solutions. **None** provide all of:
- ✅ Automatic mutex for RTU bus protection
- ✅ Adaptive polling (dynamic vs static registers)
- ✅ Runtime reconfiguration via MQTT
- ✅ Multi-register read optimization
- ✅ Device discovery & auto-detection
- ✅ TypeScript with comprehensive tooling

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed comparison.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    MQTT Interface                       │
│  Configuration, Status, Data Publishing, Discovery      │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│               Bridge Orchestrator                       │
│  Device lifecycle, polling coordination, persistence    │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│          Adaptive Polling Engine                        │
│  Dynamic/static/on-demand, multi-register optimization  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│            Device Abstraction Layer                     │
│  Driver interface, register definitions, constraints    │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│         Mutex Layer (RTU only)                          │
│  Prevents simultaneous serial bus access                │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              Transport Layer                            │
│  RTU (serial), TCP (network), RTU-over-TCP bridges      │
└─────────────────────────────────────────────────────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for details.

## Supported Devices

### Energy Meters
- **SDM630** - Eastron 3-phase energy meter
- **DDS519MR** - Single-phase energy meter
- **EX9EM** - ABB energy meter

### Solar Inverters
- **SUN2000** - Huawei solar inverter
- **MICROSYST-SR04** - Microsyst solar inverter

### HVAC
- **BAC002** - Climate controller

### Generic Modbus
- Configurable generic driver for any Modbus device

Want to add a device? See [docs/devices/adding-new-device.md](./docs/devices/adding-new-device.md)

## Documentation

- **[Getting Started](./docs/getting-started.md)** - Installation, configuration, first steps
- **[Architecture](./ARCHITECTURE.md)** - System design, key decisions, data flow
- **[Contributing](./CONTRIBUTING.md)** - Development workflow, TDD, code style
- **[AGENTS.md](./AGENTS.md)** - Quick guide for AI assistants and developers
- **[API Reference](./docs/api/)** - Package APIs and interfaces
- **[Device Drivers](./docs/devices/)** - Adding and converting device drivers
- **[Troubleshooting](./docs/troubleshooting.md)** - Common issues and solutions
- **[FAQ](./docs/faq.md)** - Frequently asked questions

## Development

### Prerequisites

- Node.js 24+ (see `.nvmrc`)
- npm 10+

### Setup

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

# Start development mode
npm run dev
```

### Project Structure

```
packages/
├── core/         # Bridge orchestration, transport, polling, discovery
├── cli/          # Command-line tool (test, provision, monitor)
├── devices/      # Device-specific implementations
├── converters/   # Data normalization layer (optional companion)
├── emulator/     # Software Modbus device emulator for testing
└── mqtt-config/  # Runtime configuration management
```

### Test-Driven Development

This project requires TDD for all features and bug fixes:

1. Write test first (should fail)
2. Write minimal code to pass
3. Refactor while keeping tests green
4. Commit with tests included

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed TDD workflow.

## Runtime Configuration via MQTT

Add devices without restarting:

```bash
# Add device
mosquitto_pub -t "modbus/config/devices/add" -m '{
  "id": "meter_2",
  "driver": "SDM630",
  "transport": "rtu",
  "port": "/dev/ttyUSB0",
  "slaveId": 2
}'

# Remove device
mosquitto_pub -t "modbus/config/devices/remove" -m "meter_2"

# Enable/disable device
mosquitto_pub -t "modbus/config/devices/meter_1/enabled" -m "false"

# Update polling interval
mosquitto_pub -t "modbus/config/devices/meter_1/polling" -m '{
  "interval": 10000
}'
```

## Monitoring

### Device Status

Subscribe to device status:
```bash
mosquitto_sub -t "modbus/+/status/#"
```

Example output:
```json
{
  "timestamp": "2025-12-22T10:30:45.123Z",
  "connected": true,
  "pollRate": 9.8,
  "avgLatency": 42,
  "errorRate": 0.001,
  "errors": {
    "total": 15,
    "timeout": 10,
    "crc": 5
  }
}
```

### Error Monitoring

Subscribe to errors:
```bash
mosquitto_sub -t "modbus/+/errors/#"
```

### Integration with Telegraf

```toml
# telegraf.conf
[[inputs.mqtt_consumer]]
  servers = ["tcp://localhost:1883"]
  topics = ["modbus/+/data"]
  data_format = "json"
  tag_keys = ["device_id", "device_type"]

[[outputs.influxdb_v2]]
  urls = ["http://localhost:8086"]
  token = "$INFLUX_TOKEN"
  organization = "my-org"
  bucket = "modbus"
```

## Docker Deployment

```bash
# Build image
docker build -t ya-modbus-mqtt-bridge .

# Run with configuration
docker run -d \
  --name modbus-bridge \
  -v $(pwd)/config.json:/app/config.json \
  -v $(pwd)/data:/data \
  --device /dev/ttyUSB0:/dev/ttyUSB0 \
  -e MQTT_BROKER=mqtt://mosquitto:1883 \
  ya-modbus-mqtt-bridge
```

### Docker Compose

```yaml
version: '3.8'
services:
  modbus-bridge:
    image: ya-modbus-mqtt-bridge
    volumes:
      - ./config.json:/app/config.json
      - ./data:/data
      - /dev/ttyUSB0:/dev/ttyUSB0
    devices:
      - /dev/ttyUSB0
    environment:
      MQTT_BROKER: mqtt://mosquitto:1883
      STATE_FILE: /data/bridge-state.json
    restart: unless-stopped
```

## Companion Package: modbus-herdsman-converters

Optional data normalization layer inspired by zigbee-herdsman-converters:

```typescript
import { convert } from '@ya-modbus/converters';

// Raw device data
const rawData = {
  voltage: 230.5,
  current: 5.2,
  power: 1198.6
};

// Convert to InfluxDB format
const influx = convert(rawData, {
  adapter: 'influxdb',
  measurement: 'modbus_device',
  tags: { device_id: 'meter_1', location: 'building_a' }
});

// Convert to Prometheus format
const prometheus = convert(rawData, {
  adapter: 'prometheus',
  prefix: 'modbus'
});
```

See [@ya-modbus/converters](./packages/converters/README.md) for details.

## Performance

### RTU Performance (9600 baud)

| Scenario                        | Operations/cycle | Time/cycle | Improvement |
|---------------------------------|------------------|------------|-------------|
| Individual reads (10 registers) | 10 reads         | ~100ms     | Baseline    |
| Batched reads (10 registers)    | 1 read           | ~10ms      | **90%**     |
| Uniform polling (all registers) | Continuous       | -          | Baseline    |
| Adaptive polling (dynamic only) | Continuous       | -          | **60-80%**  |

### TCP Performance

- Concurrent device polling (no mutex)
- 100+ polls/second per device
- Limited by network bandwidth and CPU

## License

MIT License - see [LICENSE](./LICENSE) for details

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- TDD workflow (required)
- Code style guidelines
- Pull request process
- Development setup

## Support

- **GitHub Issues**: [Bug reports and features](https://github.com/yourusername/ya-modbus-mqtt-bridge/issues)
- **GitHub Discussions**: [Questions and ideas](https://github.com/yourusername/ya-modbus-mqtt-bridge/discussions)
- **Documentation**: [Full docs](./docs/)

## Acknowledgments

- Inspired by [zigbee2mqtt](https://www.zigbee2mqtt.io/) architecture
- Uses [modbus-serial](https://github.com/yaacov/node-modbus-serial) for Modbus protocol implementation
- Uses [async-mutex](https://github.com/DirtyHairy/async-mutex) for RTU bus locking

## Roadmap

See [GitHub Projects](https://github.com/yourusername/ya-modbus-mqtt-bridge/projects) for planned features.

Key upcoming features:
- Web UI for configuration and monitoring
- Advanced device fingerprinting
- High-availability mode with failover
- Additional device drivers (community-driven)
