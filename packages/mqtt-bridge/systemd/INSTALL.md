# Systemd Installation Guide

This guide covers installing and running ya-modbus-bridge as a systemd service on Linux systems.

## Prerequisites

- Linux system with systemd (most modern distributions)
- Node.js 20 or higher
- Root or sudo access
- ya-modbus-bridge installed globally via npm

## Installation Steps

### 1. Install ya-modbus-bridge globally

```bash
sudo npm install -g @ya-modbus/mqtt-bridge
```

### 2. Create system user

Create a dedicated, unprivileged system user for running the service:

```bash
sudo useradd --system --home /var/lib/ya-modbus-bridge --create-home --shell /usr/sbin/nologin ya-modbus-bridge
```

### 3. Create configuration directory

```bash
sudo mkdir -p /etc/ya-modbus-bridge
```

Note: The state directory `/var/lib/ya-modbus-bridge` is automatically created by systemd with correct ownership when the service starts (via `StateDirectory=ya-modbus-bridge`).

### 4. Locate systemd configuration files

After global installation, find the systemd configuration files:

```bash
# Find the npm global installation directory
# Use npm root -g which works reliably across different npm configurations
NPM_GLOBAL_ROOT=$(npm root -g 2>/dev/null || echo "/usr/local/lib/node_modules")
SYSTEMD_FILES="$NPM_GLOBAL_ROOT/@ya-modbus/mqtt-bridge/systemd"

# Verify the path exists
ls -la "$SYSTEMD_FILES"

# If the above fails (e.g., using nvm), try finding via the binary location
if [ ! -d "$SYSTEMD_FILES" ]; then
  BRIDGE_BIN=$(which ya-modbus-bridge 2>/dev/null)
  if [ -n "$BRIDGE_BIN" ]; then
    # Follow symlink to actual package location
    BRIDGE_BIN=$(readlink -f "$BRIDGE_BIN")
    SYSTEMD_FILES="$(dirname $(dirname "$BRIDGE_BIN"))/systemd"
    echo "Found via binary location: $SYSTEMD_FILES"
  fi
fi
```

Alternatively, you can download the files directly from the GitHub repository.

### 5. Create configuration file

Copy the example configuration and customize it:

```bash
sudo cp "$SYSTEMD_FILES/config.json.example" /etc/ya-modbus-bridge/config.json
sudo nano /etc/ya-modbus-bridge/config.json
```

Edit the configuration to match your MQTT broker settings. For sensitive credentials, ensure proper file permissions:

```bash
sudo chmod 600 /etc/ya-modbus-bridge/config.json
sudo chown ya-modbus-bridge:ya-modbus-bridge /etc/ya-modbus-bridge/config.json
```

### 6. Create environment file

```bash
sudo cp "$SYSTEMD_FILES/environment.example" /etc/ya-modbus-bridge/environment
sudo nano /etc/ya-modbus-bridge/environment
```

Set appropriate permissions:

```bash
sudo chmod 600 /etc/ya-modbus-bridge/environment
sudo chown ya-modbus-bridge:ya-modbus-bridge /etc/ya-modbus-bridge/environment
```

### 7. Set configuration directory ownership

```bash
sudo chown -R ya-modbus-bridge:ya-modbus-bridge /etc/ya-modbus-bridge
```

Note: The state directory ownership is handled automatically by systemd's `StateDirectory` directive.

### 8. Install systemd service file

Copy the service file to systemd:

```bash
sudo cp "$SYSTEMD_FILES/ya-modbus-bridge.service" /etc/systemd/system/
```

**Important:** The service file expects `ya-modbus-bridge` to be available at `/usr/bin/ya-modbus-bridge`. Verify the binary location:

```bash
which ya-modbus-bridge
```

If the binary is not in `/usr/bin`, you have two options:

**Option A:** Create a symlink (recommended):

```bash
sudo ln -s $(which ya-modbus-bridge) /usr/bin/ya-modbus-bridge
```

**Option B:** Edit the service file to use the actual path:

```bash
# Find the actual path
BRIDGE_PATH=$(which ya-modbus-bridge)

# Edit the service file
sudo sed -i "s|/usr/bin/ya-modbus-bridge|$BRIDGE_PATH|g" /etc/systemd/system/ya-modbus-bridge.service
```

### 9. Reload systemd and enable service

```bash
# Reload systemd configuration
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable ya-modbus-bridge.service

# Start the service
sudo systemctl start ya-modbus-bridge.service
```

## Verification

### Check service status

```bash
sudo systemctl status ya-modbus-bridge.service
```

You should see output indicating the service is "active (running)".

### View logs

```bash
# View recent logs
sudo journalctl -u ya-modbus-bridge.service -n 50

# Follow logs in real-time
sudo journalctl -u ya-modbus-bridge.service -f

# View logs from today
sudo journalctl -u ya-modbus-bridge.service --since today
```

## Management Commands

### Start the service

```bash
sudo systemctl start ya-modbus-bridge.service
```

### Stop the service

```bash
sudo systemctl stop ya-modbus-bridge.service
```

### Restart the service

```bash
sudo systemctl restart ya-modbus-bridge.service
```

### Enable auto-start on boot

```bash
sudo systemctl enable ya-modbus-bridge.service
```

### Disable auto-start

```bash
sudo systemctl disable ya-modbus-bridge.service
```

### Check if service is enabled

```bash
systemctl is-enabled ya-modbus-bridge.service
```

### Check if service is running

```bash
systemctl is-active ya-modbus-bridge.service
```

## Updates

When updating the ya-modbus-bridge package:

```bash
# Stop the service
sudo systemctl stop ya-modbus-bridge.service

# Update the package
sudo npm update -g @ya-modbus/mqtt-bridge

# Start the service
sudo systemctl start ya-modbus-bridge.service

# Verify
sudo systemctl status ya-modbus-bridge.service
```

## Security Analysis

To analyze the security posture of your service:

```bash
systemd-analyze security ya-modbus-bridge.service
```

This command provides a security score (0-10, lower is better) and identifies potential improvements.

## Troubleshooting

### Service won't start

1. Check service status for errors:

   ```bash
   sudo systemctl status ya-modbus-bridge.service
   ```

2. View detailed logs:

   ```bash
   sudo journalctl -u ya-modbus-bridge.service -n 100
   ```

3. Verify configuration file syntax:

   ```bash
   cat /etc/ya-modbus-bridge/config.json | jq .
   ```

4. Check file permissions:

   ```bash
   ls -la /etc/ya-modbus-bridge/
   ls -la /var/lib/ya-modbus-bridge/
   ```

5. Verify ya-modbus-bridge is installed:
   ```bash
   which ya-modbus-bridge
   ya-modbus-bridge --version
   ```

### Permission errors

Ensure configuration files are owned by the service user:

```bash
sudo chown -R ya-modbus-bridge:ya-modbus-bridge /etc/ya-modbus-bridge
```

Note: The state directory `/var/lib/ya-modbus-bridge` is automatically managed by systemd's `StateDirectory` directive with correct ownership.

### MQTT connection issues

1. Verify MQTT broker is accessible:

   ```bash
   telnet your-mqtt-broker 1883
   ```

2. Check network configuration in the service file allows MQTT traffic

3. Review MQTT credentials in configuration file

### Service crashes frequently

1. Check logs for error messages:

   ```bash
   sudo journalctl -u ya-modbus-bridge.service -p err
   ```

2. Consider increasing memory limits in the service file if you see OOM errors

3. Adjust `RestartSec` in the service file to prevent rapid restart loops

## Advanced Configuration

### Custom environment variables for local overrides

Create `/etc/ya-modbus-bridge/environment.local` for local overrides that won't be tracked in version control:

```bash
sudo nano /etc/ya-modbus-bridge/environment.local
```

This file is loaded after `environment` (note the `-` prefix in the service file makes it optional).

### Adjusting resource limits

Edit `/etc/systemd/system/ya-modbus-bridge.service` and modify:

- `MemoryMax`: Maximum memory usage
- `CPUQuota`: CPU usage percentage
- `TasksMax`: Maximum number of tasks/threads

After editing, reload systemd:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ya-modbus-bridge.service
```

### Multiple instances

To run multiple bridge instances:

1. Copy the service file with a different name:

   ```bash
   sudo cp /etc/systemd/system/ya-modbus-bridge.service /etc/systemd/system/ya-modbus-bridge@instance2.service
   ```

2. Modify the configuration path in the new service file

3. Create separate configuration for the new instance

4. Enable and start:
   ```bash
   sudo systemctl enable ya-modbus-bridge@instance2.service
   sudo systemctl start ya-modbus-bridge@instance2.service
   ```

## Uninstallation

To completely remove the service:

```bash
# Stop and disable service
sudo systemctl stop ya-modbus-bridge.service
sudo systemctl disable ya-modbus-bridge.service

# Remove service file
sudo rm /etc/systemd/system/ya-modbus-bridge.service

# Reload systemd
sudo systemctl daemon-reload

# Remove configuration and data (CAUTION: this deletes all data)
sudo rm -rf /etc/ya-modbus-bridge
sudo rm -rf /var/lib/ya-modbus-bridge

# Remove system user
sudo userdel ya-modbus-bridge

# Optionally uninstall the package
sudo npm uninstall -g @ya-modbus/mqtt-bridge
```

## Additional Resources

- [systemd service documentation](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
- [systemd security features](https://www.freedesktop.org/software/systemd/man/systemd.exec.html#Sandboxing)
- [journalctl documentation](https://www.freedesktop.org/software/systemd/man/journalctl.html)
