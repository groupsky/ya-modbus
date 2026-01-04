#!/bin/sh
set -e

# Docker entrypoint for ya-modbus bridge
# Handles config file auto-detection and forwards all arguments

# If no arguments provided, use default "run" command
if [ $# -eq 0 ]; then
  set -- run --state-dir /data
fi

# Auto-detect config file if "run" command and no --config specified
if [ "$1" = "run" ] && ! echo "$*" | grep -q -- "--config"; then
  if [ -f /config/config.json ]; then
    set -- "$@" --config /config/config.json
  else
    # Use environment variables (set defaults in Dockerfile)
    set -- "$@" --mqtt-url "${MQTT_URL}" --mqtt-client-id "${MQTT_CLIENT_ID}"
  fi
fi

# Execute the bridge with all arguments
exec node /app/packages/mqtt-bridge/dist/bin/ya-modbus-bridge.js "$@"
