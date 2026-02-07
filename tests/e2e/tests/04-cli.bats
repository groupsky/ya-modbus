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
}

@test "read command shows help text" {
  run node "$CLI_BIN" read --help
  assert_success
  assert_output_contains "read"
}

@test "write command shows help text" {
  run node "$CLI_BIN" write --help
  assert_success
  assert_output_contains "write"
}

@test "list-devices command shows help text" {
  run node "$CLI_BIN" list-devices --help
  assert_success
  assert_output_contains "list-devices"
}

@test "read command fails with invalid slave ID" {
  run node "$CLI_BIN" read \
    --port /tmp/ttyV1 \
    --slave-id 999 \
    --driver @ya-modbus/driver-ex9em \
    --data-point voltage
  assert_failure
}

@test "read command fails without port or host" {
  run node "$CLI_BIN" read \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point voltage
  assert_failure
}

@test "read command fails without data point" {
  run node "$CLI_BIN" read \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em
  assert_failure
}

@test "can read voltage from ex9em device" {
  skip "Known issue: RTU read operations return exception 4 (see issue #248)"
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
  assert_output_contains "230"
}

@test "can read multiple data points from ex9em device" {
  skip "Known issue: RTU read operations return exception 4 (see issue #248)"
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
  assert_output_contains "voltage"
  assert_output_contains "current"
  assert_output_contains "frequency"
}

@test "can read data in JSON format" {
  skip "Known issue: RTU read operations return exception 4 (see issue #248)"
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
  assert_output_contains '"voltage"'
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
}

@test "list-devices command shows ex9em driver" {
  run node "$CLI_BIN" list-devices \
    --driver @ya-modbus/driver-ex9em

  assert_success
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
  assert_output_contains '"devices": null'
}
