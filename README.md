# ya-modbus

> Production-ready Modbus to MQTT bridge with automatic bus collision prevention, adaptive polling, and runtime reconfiguration

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-24+-green.svg)](https://nodejs.org/)
[![codecov](https://codecov.io/gh/groupsky/ya-modbus/graph/badge.svg)](https://codecov.io/gh/groupsky/ya-modbus)

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
- **Agent-friendly** - Comprehensive documentation, per-directory guides for AI assistants

## Quick Start

### Installation

```bash
npm install -g ya-modbus
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

## Why ya-modbus?

### The Multi-Device Problem

Modbus RTU uses a shared serial bus. Reading from multiple devices simultaneously causes protocol violations:

```
Device 1: Read request →  [Bus collision!]  ← Device 2: Read request
Result: Timeouts, CRC errors, data corruption
```

**Common workaround** (manual delays):

```javascript
await device1.read()
await sleep(100) // Manual delay - error-prone!
await device2.read()
```

**Our solution** (automatic mutex):

```javascript
await device1.read() // Mutex acquired automatically
await device2.read() // Waits for mutex, then executes
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

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed comparison.

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

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for details.

## Supported Devices

### Built-in Drivers

#### Energy Meters

- **SDM630** - Eastron 3-phase energy meter
- **DDS519MR** - Single-phase energy meter
- **EX9EM** - ABB energy meter

#### Solar Inverters

- **SUN2000** - Huawei solar inverter
- **MICROSYST-SR04** - Microsyst solar inverter

#### HVAC

- **BAC002** - Climate controller

#### Generic Modbus

- Configurable generic driver for any Modbus device

### Third-Party Driver Ecosystem

Device drivers can be distributed as independent npm packages:

```bash
# Install bridge + third-party driver
npm install -g ya-modbus ya-modbus-driver-solar

# Use in configuration
{
  "devices": [{
    "driver": "ya-modbus-driver-solar",
    "deviceType": "X1000",  // Optional - auto-detect if omitted
    "transport": "tcp",
    "host": "192.168.1.100"
  }]
}
```

**Recommended naming**: `ya-modbus-driver-<name>` for easy discovery

**Auto-detection**: Drivers can auto-detect device model when `deviceType` is omitted

**Want to create a driver?** See [docs/DRIVER-DEVELOPMENT.md](./docs/DRIVER-DEVELOPMENT.md)

**Driver developers get**:

- Standardized SDK with TypeScript types
- Test harness with emulator integration
- Device characterization tools (auto-discover capabilities)
- CLI for testing with real devices
- Independent release cycle

## Documentation

- **[Getting Started](./docs/getting-started.md)** - Installation, configuration, first steps
- **[Architecture](./docs/ARCHITECTURE.md)** - System design, key decisions, data flow
- **[Driver Development](./docs/DRIVER-DEVELOPMENT.md)** - Creating third-party device drivers
- **[Contributing](./CONTRIBUTING.md)** - Development workflow, testing, code style
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
git clone https://github.com/groupsky/ya-modbus.git
cd ya-modbus

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

Pre-built multi-platform images available on Docker Hub and GitHub Container Registry:

- **Docker Hub**: `groupsky/ya-modbus:latest`
- **GHCR**: `ghcr.io/groupsky/ya-modbus:latest`

Two container variants are available:

- **`ya-modbus:latest`** (complete) - Includes mqtt-bridge + all built-in drivers (recommended)
- **`ya-modbus:<version>`** (base) - mqtt-bridge only, install drivers separately

**Platforms**: linux/amd64, linux/arm64

### Quick Start (Pre-built Images)

**Simplest start** (using environment variables):

```bash
# Pull and run from Docker Hub
docker run -d \
  --name modbus-bridge \
  -e MQTT_URL=mqtt://your-broker:1883 \
  -v $(pwd)/data:/data \
  --device /dev/ttyUSB0:/dev/ttyUSB0 \
  groupsky/ya-modbus:latest

# Or from GHCR
docker run -d \
  --name modbus-bridge \
  -e MQTT_URL=mqtt://your-broker:1883 \
  -v $(pwd)/data:/data \
  --device /dev/ttyUSB0:/dev/ttyUSB0 \
  ghcr.io/groupsky/ya-modbus:latest
```

### Building Locally

**If you want to build from source**:

```bash
# Build complete image with all drivers
docker build -t ya-modbus:complete --build-arg VARIANT=complete .

# Run with just MQTT broker URL
docker run -d \
  --name modbus-bridge \
  -e MQTT_URL=mqtt://your-broker:1883 \
  -v $(pwd)/data:/data \
  --device /dev/ttyUSB0:/dev/ttyUSB0 \
  ya-modbus:complete
```

**With configuration file**:

```bash
# Run with configuration file
docker run -d \
  --name modbus-bridge \
  -v $(pwd)/config:/config:ro \
  -v $(pwd)/data:/data \
  --device /dev/ttyUSB0:/dev/ttyUSB0 \
  ya-modbus:complete
```

The container automatically detects if `/config/config.json` exists and uses it; otherwise it uses environment variables (`MQTT_URL`, `MQTT_CLIENT_ID`).

### Using Base Variant (Custom Drivers)

```bash
# Build base image (bridge only)
docker build -t ya-modbus:base --build-arg VARIANT=base .

# Create Dockerfile to add custom drivers
cat > Dockerfile.custom <<EOF
FROM ya-modbus:base
USER root
RUN npm install ya-modbus-driver-custom-device
USER modbus
EOF

# Build and run
docker build -f Dockerfile.custom -t ya-modbus:custom .
docker run -d --name modbus-bridge ya-modbus:custom
```

### Docker Compose

```bash
# Copy example configuration
cp config/config.example.json config/config.json

# Edit config.json with your devices and MQTT settings
# Then start the bridge
docker compose up -d

# View logs
docker compose logs -f mqtt-bridge-complete

# Stop
docker compose down
```

See `docker-compose.yml` for complete example with MQTT broker.

### Configuration

Mount configuration file at `/config/config.json`:

```json
{
  "mqtt": {
    "url": "mqtt://mosquitto:1883",
    "clientId": "ya-modbus-bridge"
  },
  "devices": [
    {
      "id": "temp_sensor_1",
      "driver": "ya-modbus-driver-xymd1",
      "transport": "rtu",
      "port": "/dev/ttyUSB0",
      "slaveId": 1
    }
  ]
}
```

### Serial Device Access

For RTU devices, pass through the serial device:

```bash
docker run -d \
  --name modbus-bridge \
  --device /dev/ttyUSB0:/dev/ttyUSB0 \
  ya-modbus:complete
```

### Persistence

Bridge state is saved to `/data` by default:

```bash
docker run -d \
  -v $(pwd)/data:/data \
  ya-modbus:complete
```

### Environment Variables

Configure the bridge using environment variables (no config file needed):

| Variable         | Default                 | Description                                             |
| ---------------- | ----------------------- | ------------------------------------------------------- |
| `MQTT_URL`       | `mqtt://localhost:1883` | MQTT broker URL                                         |
| `MQTT_CLIENT_ID` | `ya-modbus-bridge`      | MQTT client identifier                                  |
| `STATE_DIR`      | `/data`                 | State persistence directory (can be overridden)         |
| `NODE_ENV`       | `production`            | Node.js environment (affects logging and error details) |

Example:

```bash
docker run -d \
  -e MQTT_URL=mqtt://broker:1883 \
  -e MQTT_CLIENT_ID=my-bridge \
  ya-modbus:complete
```

**Note**: Devices must still be configured via config file or MQTT runtime configuration.

### Health Checks

The container includes built-in health monitoring:

```bash
# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# View health check logs
docker inspect modbus-bridge --format='{{.State.Health}}'
```

Health check runs every 30s, verifies the bridge process is running. Containers are marked healthy after 5s start period.

## Companion Package: modbus-herdsman-converters

Optional data normalization layer inspired by zigbee-herdsman-converters:

```typescript
import { convert } from '@ya-modbus/converters'

// Raw device data
const rawData = {
  voltage: 230.5,
  current: 5.2,
  power: 1198.6,
}

// Convert to InfluxDB format
const influx = convert(rawData, {
  adapter: 'influxdb',
  measurement: 'modbus_device',
  tags: { device_id: 'meter_1', location: 'building_a' },
})

// Convert to Prometheus format
const prometheus = convert(rawData, {
  adapter: 'prometheus',
  prefix: 'modbus',
})
```

See [@ya-modbus/converters](./packages/converters/README.md) for details.

## Performance

### RTU Performance (9600 baud)

| Scenario                        | Operations/cycle | Time/cycle | Improvement |
| ------------------------------- | ---------------- | ---------- | ----------- |
| Individual reads (10 registers) | 10 reads         | ~100ms     | Baseline    |
| Batched reads (10 registers)    | 1 read           | ~10ms      | **90%**     |
| Uniform polling (all registers) | Continuous       | -          | Baseline    |
| Adaptive polling (dynamic only) | Continuous       | -          | **60-80%**  |

### TCP Performance

- Concurrent device polling (no mutex)
- 100+ polls/second per device
- Limited by network bandwidth and CPU

## License

GPL-3.0-or-later - see [LICENSE](./LICENSE) for details

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Development workflow
- Testing guidelines
- Code style guidelines
- Pull request process

## Support

- **GitHub Issues**: [Bug reports and features](https://github.com/groupsky/ya-modbus/issues)
- **GitHub Discussions**: [Questions and ideas](https://github.com/groupsky/ya-modbus/discussions)
- **Documentation**: [Full docs](./docs/)

## Acknowledgments

- Inspired by [zigbee2mqtt](https://www.zigbee2mqtt.io/) architecture
- Uses [modbus-serial](https://github.com/yaacov/node-modbus-serial) for Modbus protocol implementation
- Uses [async-mutex](https://github.com/DirtyHairy/async-mutex) for RTU bus locking

## Roadmap

See [GitHub Projects](https://github.com/groupsky/ya-modbus/projects) for planned features.

Key upcoming features:

- Web UI for configuration and monitoring
- Advanced device fingerprinting
- High-availability mode with failover
- Additional device drivers (community-driven)
