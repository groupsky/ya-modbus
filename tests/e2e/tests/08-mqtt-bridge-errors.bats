#!/usr/bin/env bats
#
# MQTT Bridge E2E error scenarios
#
# Invalid configs, an unreachable MQTT broker and a device that does not answer.
# Configs that must fail are written to BATS_TEST_TMPDIR.
#

load helpers

setup() {
  EMULATOR_PID=""
  BRIDGE_PID=""
  MQTT_SUB_PID=""
  MQTT_MESSAGES_FILE=$(mktemp /tmp/mqtt-messages-XXXXXX.txt)
  BRIDGE_BIN="$(get_project_root)/packages/mqtt-bridge/dist/esm/bin/ya-modbus-bridge.js"
  clean_test_artifacts
}

teardown() {
  if [ -n "$MQTT_SUB_PID" ]; then
    stop_mqtt_subscriber "$MQTT_SUB_PID"
  fi
  if [ -n "$BRIDGE_PID" ]; then
    stop_mqtt_bridge "$BRIDGE_PID"
  fi
  if [ -n "$EMULATOR_PID" ]; then
    stop_test_emulator "$EMULATOR_PID"
  fi
  rm -f "$MQTT_MESSAGES_FILE"
  clean_test_artifacts
}

# Write a bridge config to $BATS_TEST_TMPDIR/config.json
#   $1 - MQTT URL
#   $2 - JSON array of devices
write_config() {
  cat > "$BATS_TEST_TMPDIR/config.json" <<JSON
{
  "mqtt": { "url": "$1", "clientId": "ya-modbus-test-bridge-errors" },
  "devices": $2
}
JSON
}

# JSON of one RTU ex9em device ($1 = device ID, $2 = slave ID, $3 = port)
ex9em_device() {
  cat <<JSON
{
  "deviceId": "$1",
  "driver": "@ya-modbus/driver-ex9em",
  "connection": { "type": "rtu", "port": "$3", "baudRate": 9600, "parity": "even", "dataBits": 8, "stopBits": 1, "slaveId": $2 },
  "polling": { "interval": 100 }
}
JSON
}

@test "mqtt-bridge rejects a config that is not JSON" {
  echo '{ "mqtt": ' > "$BATS_TEST_TMPDIR/config.json"

  run timeout 20 node "$BRIDGE_BIN" run --config "$BATS_TEST_TMPDIR/config.json"
  assert_failure
  assert_output_contains "Error:"
  assert_output_contains "JSON"
  assert_output_not_contains "Bridge started successfully"
}

@test "mqtt-bridge rejects a config file that does not exist" {
  run timeout 20 node "$BRIDGE_BIN" run --config "$BATS_TEST_TMPDIR/missing.json"
  assert_failure
  assert_output_contains "ENOENT"
}

@test "mqtt-bridge rejects an MQTT URL with an unknown scheme" {
  write_config "http://localhost:1883" "[]"

  run timeout 20 node "$BRIDGE_BIN" run --config "$BATS_TEST_TMPDIR/config.json"
  assert_failure
  assert_output_contains "Invalid configuration"
  assert_output_contains "mqtt.url: URL must start with mqtt://, mqtts://, ws://, or wss://"
}

@test "mqtt-bridge rejects a device with an invalid slave ID" {
  write_config "mqtt://localhost:1883" "[$(ex9em_device bad-slave 300 /tmp/ttyV1)]"

  run timeout 20 node "$BRIDGE_BIN" run --config "$BATS_TEST_TMPDIR/config.json"
  assert_failure
  assert_output_contains "Invalid configuration"
  assert_output_contains "Slave ID"
  assert_output_not_contains "Bridge started successfully"
}

@test "mqtt-bridge rejects a device with an unknown driver" {
  write_config "mqtt://localhost:1883" "[$(ex9em_device bad-driver 1 /tmp/ttyV1 | sed 's#@ya-modbus/driver-ex9em#@ya-modbus/driver-does-not-exist#')]"

  run timeout 20 node "$BRIDGE_BIN" run --config "$BATS_TEST_TMPDIR/config.json"
  assert_failure
  assert_output_contains "devices\[0\] \(bad-driver\)"
  assert_output_contains "driver-does-not-exist"
  assert_output_not_contains "Bridge started successfully"
}

@test "mqtt-bridge check names the problem of an invalid device" {
  write_config "mqtt://localhost:1883" "[$(ex9em_device bad-slave 300 /tmp/ttyV1)]"

  run timeout 20 node "$BRIDGE_BIN" check --config "$BATS_TEST_TMPDIR/config.json"
  assert_failure
  assert_output_contains "Slave ID"
}

@test "mqtt-bridge fails with a clear error when the MQTT broker is unreachable" {
  write_config "mqtt://localhost:9999" "[]"

  # A timeout of 20 s keeps a bridge that retries forever from hanging the test
  run timeout 20 node "$BRIDGE_BIN" run --config "$BATS_TEST_TMPDIR/config.json"
  assert_failure
  [ "$status" -ne 124 ]
  assert_output_contains "connecting to mqtt://localhost:9999"
  assert_output_contains "ECONNREFUSED"
  assert_output_not_contains "Bridge started successfully"
}

@test "mqtt-bridge keeps publishing the good device when another device does not answer" {
  # Emulator has xymd1 on slave 1 and ex9em on slave 2, nothing on slave 5
  run start_test_emulator "fixtures/emulators/port2-multi-device.json"
  assert_success
  EMULATOR_PID="$output"

  run start_mqtt_subscriber "modbus/#" "$MQTT_MESSAGES_FILE"
  assert_success
  MQTT_SUB_PID="$output"

  write_config "mqtt://localhost:1883" "[$(ex9em_device ex9em-good 2 /tmp/ttyV3), $(ex9em_device ex9em-silent 5 /tmp/ttyV3)]"

  run start_mqtt_bridge "$BATS_TEST_TMPDIR/config.json"
  assert_success
  BRIDGE_PID="$output"

  # The device that answers is published (slave 2 holds voltage 220 V)
  run wait_for 10 'assert_json_field "$MQTT_MESSAGES_FILE" "modbus/ex9em-good/data" ".data.voltage" 220'
  assert_success

  # The errors of the silent device are logged with its ID
  run wait_for 20 'assert_bridge_log_contains "$BRIDGE_PID" "Polling error for device ex9em-silent"'
  assert_success

  # The status topic of the silent device shows the error
  run wait_for 20 'assert_json_field "$MQTT_MESSAGES_FILE" "modbus/ex9em-silent/status" ".state" "\"error\""'
  assert_success

  # The bridge still runs, and the good device has no polling errors
  run assert_bridge_running "$BRIDGE_PID"
  assert_success
  run grep "Polling error for device ex9em-good" "/tmp/bridge-$BRIDGE_PID.log"
  assert_failure

  # The silent device never publishes data
  run grep "modbus/ex9em-silent/data" "$MQTT_MESSAGES_FILE"
  assert_failure
}

@test "mqtt-bridge publishes online status, device status and offline after a clean stop" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run start_mqtt_subscriber "modbus/#" "$MQTT_MESSAGES_FILE"
  assert_success
  MQTT_SUB_PID="$output"

  # timeout sends SIGTERM after 6 s: the bridge shuts down cleanly
  timeout -s TERM 6 node "$BRIDGE_BIN" run --config fixtures/bridge-config.json > "$BATS_TEST_TMPDIR/bridge.log" 2>&1 || true

  run assert_file_contains "$MQTT_MESSAGES_FILE" "modbus/ex9em-1/status"
  assert_success
  run assert_json_field "$MQTT_MESSAGES_FILE" "modbus/ex9em-1/status" ".state" '"connected"'
  assert_success

  # Retained bridge status: online while running, offline after the stop. The last message
  # of the topic is the current one.
  run grep "^modbus/bridge/status " "$MQTT_MESSAGES_FILE"
  assert_success
  [ "${lines[-2]}" = "modbus/bridge/status online" ]
  [ "${lines[-1]}" = "modbus/bridge/status offline" ]
}
