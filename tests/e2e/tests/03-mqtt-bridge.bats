#!/usr/bin/env bats
#
# MQTT Bridge E2E Tests
#
# These tests verify mqtt-bridge functionality with real emulated devices.
# Tests cover single device, multiple devices, and error handling scenarios.
#

load helpers

setup() {
  EMULATOR_PID=""
  BRIDGE_PID=""
  MQTT_SUB_PID=""
  MQTT_MESSAGES_FILE="/tmp/mqtt-messages-$$.txt"
  clean_test_artifacts
}

teardown() {
  # Stop MQTT subscriber first to avoid broken pipe errors
  if [ -n "$MQTT_SUB_PID" ]; then
    stop_mqtt_subscriber "$MQTT_SUB_PID"
  fi

  # Stop bridge before emulator to ensure clean shutdown
  if [ -n "$BRIDGE_PID" ]; then
    stop_mqtt_bridge "$BRIDGE_PID"
  fi

  if [ -n "$EMULATOR_PID" ]; then
    stop_test_emulator "$EMULATOR_PID"
  fi

  # Clean up temp files
  rm -f "$MQTT_MESSAGES_FILE"
  clean_test_artifacts
}

@test "mqtt-bridge binary exists" {
  [ -f "../../packages/mqtt-bridge/dist/esm/bin/ya-modbus-bridge.js" ]
}

@test "mqtt-bridge config files exist" {
  [ -f "fixtures/bridge-config.json" ]
  [ -f "fixtures/bridge-config-multi-device.json" ]
}

@test "mqtt-bridge starts with single device" {
  # Start emulator with ex9em device
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Start MQTT subscriber
  run start_mqtt_subscriber "modbus/#" "$MQTT_MESSAGES_FILE"
  assert_success
  MQTT_SUB_PID="$output"

  # Start bridge
  run start_mqtt_bridge "fixtures/bridge-config.json"
  assert_success
  BRIDGE_PID="$output"

  # Verify bridge process is running
  run kill -0 "$BRIDGE_PID"
  assert_success
}

@test "mqtt-bridge publishes data from single device" {
  # Start emulator with ex9em device
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Start MQTT subscriber
  run start_mqtt_subscriber "modbus/#" "$MQTT_MESSAGES_FILE"
  assert_success
  MQTT_SUB_PID="$output"

  # Start bridge
  run start_mqtt_bridge "fixtures/bridge-config.json"
  assert_success
  BRIDGE_PID="$output"

  # Wait for bridge to poll and publish data
  sleep 5

  # Verify data published to correct topic
  assert_file_contains "$MQTT_MESSAGES_FILE" "modbus/ex9em-1/data"

  # Verify message contains expected structure (deviceId, timestamp, data)
  assert_file_contains "$MQTT_MESSAGES_FILE" '"deviceId":"ex9em-1"'
  assert_file_contains "$MQTT_MESSAGES_FILE" '"timestamp":'
  assert_file_contains "$MQTT_MESSAGES_FILE" '"data":'
}

@test "mqtt-bridge publishes data matching emulator configuration" {
  # Start emulator with ex9em device (voltage_l1=2300 from config)
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Start MQTT subscriber
  run start_mqtt_subscriber "modbus/#" "$MQTT_MESSAGES_FILE"
  assert_success
  MQTT_SUB_PID="$output"

  # Start bridge
  run start_mqtt_bridge "fixtures/bridge-config.json"
  assert_success
  BRIDGE_PID="$output"

  # Wait for bridge to poll and publish data
  sleep 5

  # Verify data values match emulator configuration
  # The ex9em driver should decode register 0 (value 2300) as voltage=230.0V
  assert_file_contains "$MQTT_MESSAGES_FILE" '"voltage":230'
}

@test "mqtt-bridge handles multiple devices on same bus" {
  # Start emulator with xymd1 (slave 1) and or-we-516 (slave 2)
  run start_test_emulator "fixtures/emulators/port2-multi-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Start MQTT subscriber
  run start_mqtt_subscriber "modbus/#" "$MQTT_MESSAGES_FILE"
  assert_success
  MQTT_SUB_PID="$output"

  # Start bridge
  run start_mqtt_bridge "fixtures/bridge-config-multi-device.json"
  assert_success
  BRIDGE_PID="$output"

  # Wait for bridge to poll both devices
  sleep 5

  # Verify data published to separate topics
  assert_file_contains "$MQTT_MESSAGES_FILE" "modbus/xymd1-1/data"
  assert_file_contains "$MQTT_MESSAGES_FILE" "modbus/or-we-516-2/data"

  # Verify both devices have distinct data
  assert_file_contains "$MQTT_MESSAGES_FILE" '"deviceId":"xymd1-1"'
  assert_file_contains "$MQTT_MESSAGES_FILE" '"deviceId":"or-we-516-2"'
}

@test "mqtt-bridge continues running when device disconnects" {
  # Start emulator with ex9em device
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Start MQTT subscriber
  run start_mqtt_subscriber "modbus/#" "$MQTT_MESSAGES_FILE"
  assert_success
  MQTT_SUB_PID="$output"

  # Start bridge
  run start_mqtt_bridge "fixtures/bridge-config.json"
  assert_success
  BRIDGE_PID="$output"

  # Wait for initial data
  sleep 3

  # Stop emulator to simulate disconnection
  stop_test_emulator "$EMULATOR_PID"
  EMULATOR_PID=""

  # Wait for bridge to detect disconnection
  sleep 3

  # Verify bridge is still running (does not crash)
  run kill -0 "$BRIDGE_PID"
  assert_success

  # Bridge should log polling errors (errors are logged, not published to MQTT)
  # We can verify the bridge continues by checking it's still alive
}

@test "mqtt-bridge reconnects after device comes back online" {
  # Start emulator with ex9em device
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Start MQTT subscriber
  run start_mqtt_subscriber "modbus/#" "$MQTT_MESSAGES_FILE"
  assert_success
  MQTT_SUB_PID="$output"

  # Start bridge
  run start_mqtt_bridge "fixtures/bridge-config.json"
  assert_success
  BRIDGE_PID="$output"

  # Wait for initial data
  sleep 3

  # Clear MQTT messages to track reconnection
  > "$MQTT_MESSAGES_FILE"

  # Stop emulator
  stop_test_emulator "$EMULATOR_PID"
  EMULATOR_PID=""

  # Wait for disconnection
  sleep 3

  # Restart emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Wait for bridge to reconnect and publish data
  sleep 5

  # Verify bridge resumed publishing data
  assert_file_contains "$MQTT_MESSAGES_FILE" "modbus/ex9em-1/data"
}
