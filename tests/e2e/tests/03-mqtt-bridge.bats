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
  MQTT_MESSAGES_FILE=$(mktemp /tmp/mqtt-messages-XXXXXX.txt)
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

  # Verify bridge is running and healthy
  run assert_bridge_running "$BRIDGE_PID"
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
  run wait_for 5 'assert_file_contains "$MQTT_MESSAGES_FILE" "modbus/ex9em-1/data"'
  assert_success

  # Verify message structure using JSON validation
  run assert_json_field "$MQTT_MESSAGES_FILE" "modbus/ex9em-1/data" ".deviceId" '"ex9em-1"'
  assert_success
  run assert_json_field "$MQTT_MESSAGES_FILE" "modbus/ex9em-1/data" ".timestamp" "number"
  assert_success
  run assert_json_field "$MQTT_MESSAGES_FILE" "modbus/ex9em-1/data" ".data" "object"
  assert_success
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

  # Wait for bridge to poll and publish data with expected voltage value
  # The ex9em driver should decode register 0 (value 2300) as voltage=230.0V
  run wait_for 5 'assert_json_field "$MQTT_MESSAGES_FILE" "modbus/ex9em-1/data" ".data.voltage" 230'
  assert_success
}

@test "mqtt-bridge handles multiple devices on same bus" {
  # Start emulator with xymd1 (slave 1) and ex9em (slave 2)
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

  # Wait for bridge to poll both devices (longer timeout for multi-device)
  run wait_for 10 'assert_file_contains "$MQTT_MESSAGES_FILE" "modbus/xymd1-1/data"'
  assert_success
  run wait_for 10 'assert_file_contains "$MQTT_MESSAGES_FILE" "modbus/ex9em-2/data"'
  assert_success

  # Verify each device publishes to its own correct topic with valid JSON structure
  run assert_json_field "$MQTT_MESSAGES_FILE" "modbus/xymd1-1/data" ".deviceId" '"xymd1-1"'
  assert_success
  run assert_json_field "$MQTT_MESSAGES_FILE" "modbus/xymd1-1/data" ".data" "object"
  assert_success
  run assert_json_field "$MQTT_MESSAGES_FILE" "modbus/ex9em-2/data" ".deviceId" '"ex9em-2"'
  assert_success
  run assert_json_field "$MQTT_MESSAGES_FILE" "modbus/ex9em-2/data" ".data" "object"
  assert_success
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

  # Wait for initial data to be published
  run wait_for 5 'assert_file_contains "$MQTT_MESSAGES_FILE" "modbus/ex9em-1/data"'
  assert_success

  # Stop emulator to simulate disconnection
  stop_test_emulator "$EMULATOR_PID"
  EMULATOR_PID=""

  # Wait for bridge to attempt polling and detect disconnection
  # Bridge should log polling errors without crashing
  run wait_for 5 'assert_bridge_log_contains "$BRIDGE_PID" "Polling error for device"'
  assert_success

  # Verify bridge is still running (does not crash on disconnection)
  run assert_bridge_running "$BRIDGE_PID"
  assert_success
}

@test "mqtt-bridge reconnects after device comes back online" {
  # Start emulator with ex9em device (voltage register 0 = 2300)
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

  # Wait for initial data with voltage=230V using JSON validation
  run wait_for 5 'assert_json_field "$MQTT_MESSAGES_FILE" "modbus/ex9em-1/data" ".data.voltage" 230'
  assert_success

  # Stop MQTT subscriber before clearing file to avoid concurrent write issues
  stop_mqtt_subscriber "$MQTT_SUB_PID"
  MQTT_SUB_PID=""

  # Clear MQTT messages to track reconnection with new data
  > "$MQTT_MESSAGES_FILE"

  # Restart MQTT subscriber with clean file
  run start_mqtt_subscriber "modbus/#" "$MQTT_MESSAGES_FILE"
  assert_success
  MQTT_SUB_PID="$output"

  # Stop emulator
  stop_test_emulator "$EMULATOR_PID"
  EMULATOR_PID=""

  # Wait for bridge to detect disconnection
  run wait_for 5 'assert_bridge_log_contains "$BRIDGE_PID" "Polling error for device"'
  assert_success

  # Restart emulator with different register values (voltage register 0 = 2400)
  run start_test_emulator "fixtures/emulators/port1-single-device-alt.json"
  assert_success
  EMULATOR_PID="$output"

  # Wait for bridge to reconnect and publish new data with voltage=240V (longer timeout for reconnection)
  run wait_for 15 'assert_json_field "$MQTT_MESSAGES_FILE" "modbus/ex9em-1/data" ".data.voltage" 240'
  assert_success

  # Verify bridge resumed publishing with valid JSON structure
  run assert_json_field "$MQTT_MESSAGES_FILE" "modbus/ex9em-1/data" ".deviceId" '"ex9em-1"'
  assert_success
  run assert_json_field "$MQTT_MESSAGES_FILE" "modbus/ex9em-1/data" ".timestamp" "number"
  assert_success
}
