# MQTT Bridge Configuration Examples

Example configuration files for the MQTT bridge.

## Files

### basic-config.json

Minimal configuration with only the required MQTT broker URL.

```bash
ya-modbus-bridge run --config examples/basic-config.json
```

### full-config.json

Full configuration with all available options including authentication and custom settings.

```bash
ya-modbus-bridge run --config examples/full-config.json
```

## Configuration Options

### Required

- `mqtt.url`: MQTT broker URL (mqtt://, mqtts://, ws://, wss://)

### Optional

- `mqtt.clientId`: MQTT client identifier
- `mqtt.username`: MQTT authentication username
- `mqtt.password`: MQTT authentication password
- `mqtt.reconnectPeriod`: Reconnection interval in milliseconds (default: 5000)
- `topicPrefix`: Topic prefix for all MQTT topics (default: "modbus")
- `stateDir`: Directory path for state persistence

## CLI Overrides

All configuration options can be overridden via CLI flags:

```bash
ya-modbus-bridge run \
  --config examples/basic-config.json \
  --mqtt-url mqtt://broker.example.com:1883 \
  --mqtt-username myuser \
  --mqtt-password mypass
```
