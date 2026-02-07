#!/usr/bin/env bats
#
# CLI tools tests
# These tests verify that the ya-modbus CLI commands work correctly
#

load helpers

setup() {
  EMULATOR_PID=""
  CLI_BIN="$(get_project_root)/packages/cli/dist/esm/bin/ya-modbus.js"
  clean_test_artifacts
}

teardown() {
  if [ -n "$EMULATOR_PID" ]; then
    stop_test_emulator "$EMULATOR_PID"
  fi
  clean_test_artifacts
}

@test "CLI binary exists" {
  [ -f "$CLI_BIN" ]
}

@test "CLI shows help text" {
  run node "$CLI_BIN" --help
  assert_success
  assert_output_contains "Usage: ya-modbus"
  assert_output_contains "[options] [command]"
  assert_output_contains "Device Operations:"
}

@test "read command shows help text" {
  run node "$CLI_BIN" read --help
  assert_success
  assert_output_contains "Read data points from device"
  assert_output_contains "--data-point"
  assert_output_contains "--all"
}

@test "write command shows help text" {
  run node "$CLI_BIN" write --help
  assert_success
  assert_output_contains "Write data point to device"
  assert_output_contains "--data-point"
  assert_output_contains "--value"
  assert_output_contains "--verify"
}

@test "list-devices command shows help text" {
  run node "$CLI_BIN" list-devices --help
  assert_success
  assert_output_contains "List supported devices"
  assert_output_contains "--driver"
}

@test "read command fails with invalid slave ID" {
  run node "$CLI_BIN" read \
    --port /tmp/ttyV1 \
    --slave-id 999 \
    --driver @ya-modbus/driver-ex9em \
    --data-point voltage
  assert_failure
  assert_output_contains "Invalid slave ID"
}

@test "read command fails without port or host" {
  run node "$CLI_BIN" read \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point voltage
  assert_failure
  assert_output_contains "cannot open"
}

@test "read command fails without data point" {
  run node "$CLI_BIN" read \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em
  assert_failure
  assert_output_contains "--data-point"
}

@test "can read voltage from ex9em device" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Read voltage data point
  run node "$CLI_BIN" read \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point voltage

  assert_success
  assert_output_contains "Voltage"
  assert_output_contains "230.0"
  assert_output_contains "V"
  assert_output_contains "Performance:"
}

@test "can read multiple data points from ex9em device" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Read multiple data points
  run node "$CLI_BIN" read \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point voltage current frequency

  assert_success
  # Verify all three data points present with values
  assert_output_contains "Voltage"
  assert_output_contains "230.0"
  assert_output_contains "Current"
  assert_output_contains "52.0"
  assert_output_contains "Frequency"
  assert_output_contains "50.0"
}

@test "can read data in JSON format" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Read with JSON output
  run node "$CLI_BIN" read \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point voltage \
    --format json

  assert_success
  # Validate JSON structure
  assert_output_contains '"dataPoints"'
  assert_output_contains '"voltage"'
  assert_output_contains '"driver"'
  assert_output_contains '"performance"'
  assert_output_contains "230"
}

@test "can write device_address to ex9em device" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Write device_address (writable configuration parameter)
  run node "$CLI_BIN" write \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point device_address \
    --value 5 \
    --yes

  assert_success
  assert_output_contains "Successfully wrote"
  assert_output_contains "device_address"
}

@test "can write and verify device_address" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Write with verification
  run node "$CLI_BIN" write \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point device_address \
    --value 10 \
    --yes \
    --verify

  assert_success
  assert_output_contains "Successfully wrote"
  assert_output_contains "Verification:"
}

@test "write command fails for non-writable data point" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Try to write to a read-only data point
  run node "$CLI_BIN" write \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point voltage \
    --value 240 \
    --yes

  assert_failure
  assert_output_contains "read-only"
}

@test "list-devices command shows ex9em driver" {
  run node "$CLI_BIN" list-devices \
    --driver @ya-modbus/driver-ex9em

  assert_success
  assert_output_contains "driver does not export"
  assert_output_contains "single-device driver"
}

@test "list-devices shows message for single-device driver" {
  run node "$CLI_BIN" list-devices \
    --driver @ya-modbus/driver-or-we-516

  assert_success
  assert_output_contains "single-device driver"
}

@test "list-devices with JSON format for single-device driver" {
  run node "$CLI_BIN" list-devices \
    --driver @ya-modbus/driver-or-we-516 \
    --format json

  assert_success
  # Validate JSON structure for single-device driver
  assert_output_contains '"devices": null'
  assert_output_contains '"defaultConfig"'
  assert_output_contains '"baudRate"'
  assert_output_contains '"parity"'
}

@test "show-defaults command shows help text" {
  run node "$CLI_BIN" show-defaults --help
  assert_success
  assert_output_contains "show-defaults"
  assert_output_contains "--driver"
  assert_output_contains "--format"
}

@test "show-defaults displays driver configuration" {
  run node "$CLI_BIN" show-defaults \
    --driver @ya-modbus/driver-ex9em

  assert_success
  assert_output_contains "DEFAULT_CONFIG"
  assert_output_contains "baudRate"
  assert_output_contains "9600"
  assert_output_contains "parity"
  assert_output_contains "even"
}

@test "show-defaults displays supported configuration" {
  run node "$CLI_BIN" show-defaults \
    --driver @ya-modbus/driver-ex9em

  assert_success
  assert_output_contains "SUPPORTED_CONFIG"
  assert_output_contains "validBaudRates"
  assert_output_contains "validParity"
}

@test "show-defaults outputs JSON format" {
  run node "$CLI_BIN" show-defaults \
    --driver @ya-modbus/driver-ex9em \
    --format json

  assert_success

  # Validate JSON structure
  echo "$output" | jq -e 'has("defaultConfig")'
  echo "$output" | jq -e 'has("supportedConfig")'
  echo "$output" | jq -e '.defaultConfig.baudRate == 9600'
  echo "$output" | jq -e '.defaultConfig.parity == "even"'
}

@test "show-defaults works with single-device driver" {
  run node "$CLI_BIN" show-defaults \
    --driver @ya-modbus/driver-or-we-516

  assert_success
  assert_output_contains "DEFAULT_CONFIG"
  assert_output_contains "baudRate"
  assert_output_contains "9600"
  assert_output_contains "parity"
  assert_output_contains "odd"
}

@test "show-defaults fails without --driver" {
  run node "$CLI_BIN" show-defaults

  assert_failure
  assert_output_contains "driver"
}

@test "show-defaults fails with non-existent driver" {
  run node "$CLI_BIN" show-defaults \
    --driver @ya-modbus/driver-nonexistent

  assert_failure
  assert_output_contains "Driver package not found"
}

@test "discover command shows help text" {
  run node "$CLI_BIN" discover --help
  assert_success
  assert_output_contains "discover"
  assert_output_contains "--port"
  assert_output_contains "--strategy"
  assert_output_contains "--driver"
}

@test "discover finds single device with quick strategy" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --driver @ya-modbus/driver-ex9em \
    --strategy quick \
    --max-devices 1

  assert_success
  assert_output_contains "Found 1 device"
  assert_output_contains "Slave ID 1"
  assert_output_contains "9600"
}

@test "discover finds multiple devices" {
  run start_test_emulator "fixtures/emulators/port2-multi-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV3 \
    --driver @ya-modbus/driver-xymd1 \
    --strategy quick \
    --max-devices 1

  assert_success
  assert_output_contains "Found"
  assert_output_contains "device"
}

@test "discover outputs JSON format" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --driver @ya-modbus/driver-ex9em \
    --strategy quick \
    --max-devices 1 \
    --silent \
    --format json

  assert_success
  echo "$output" | jq -e '.[0].slaveId == 1'
  echo "$output" | jq -e '.[0].baudRate == 9600'
}

@test "discover with verbose shows progress" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --driver @ya-modbus/driver-ex9em \
    --strategy quick \
    --max-devices 1 \
    --verbose

  assert_success
  assert_output_contains "Testing"
}

@test "discover with silent suppresses progress" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --driver @ya-modbus/driver-ex9em \
    --strategy quick \
    --max-devices 1 \
    --silent \
    --format json

  assert_success
  # Output should only be JSON, no progress messages
  echo "$output" | jq -e 'type == "array"'
}

@test "discover fails without --port" {
  run node "$CLI_BIN" discover \
    --driver @ya-modbus/driver-ex9em

  assert_failure
  assert_output_contains "port"
}

@test "discover with thorough strategy (slow test)" {
  skip "Thorough discovery takes 6+ hours - run manually"

  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run timeout 300 node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --strategy thorough \
    --max-devices 1

  # May timeout, which is expected for thorough strategy
  [ "$status" -eq 0 ] || [ "$status" -eq 124 ]
}
