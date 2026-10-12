# MQTT Bridge Configuration Examples

Example configuration files for the MQTT bridge.

## Files

### basic-config.json

Minimal configuration with only the MQTT broker URL.

```bash
ya-modbus-bridge run --config examples/basic-config.json
```

### full-config.json

Full configuration with all available options including authentication and custom settings.

```bash
ya-modbus-bridge run --config examples/full-config.json
```

## Configuration Options

See the [package README](../README.md#configuration-file) for all options, their defaults and their ranges.

## Security Best Practices

⚠️ **Never commit credentials to version control!**

- Replace placeholder values (`<your-username>`, `<your-password>`) with actual credentials
- Make the config file readable only by the user that runs the bridge (`chmod 600`)
- Keep configuration files with real credentials in `.gitignore`
- Put credentials in the config file. Other users can see CLI flags such as `--mqtt-password` in the process list
- Use TLS/SSL (`mqtts://` or `wss://`) for production deployments

## CLI Overrides

All configuration options can be overridden via CLI flags:

```bash
ya-modbus-bridge run \
  --config examples/basic-config.json \
  --mqtt-url mqtt://broker.example.com:1883 \
  --mqtt-username myuser \
  --mqtt-password mypass
```
