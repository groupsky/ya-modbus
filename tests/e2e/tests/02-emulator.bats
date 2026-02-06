#!/usr/bin/env bats
#
# Emulator tests
# These tests verify that the Modbus emulator works correctly
#

load helpers

setup() {
  EMULATOR_PID=""
  clean_test_artifacts
}

teardown() {
  if [ -n "$EMULATOR_PID" ]; then
    stop_test_emulator "$EMULATOR_PID"
  fi
  clean_test_artifacts
}

@test "emulator CLI binary exists" {
  [ -f "packages/emulator/dist/esm/bin/ya-modbus-emulator.js" ]
}

@test "emulator config files exist" {
  [ -f "tests/e2e/fixtures/emulators/port1-single-device.json" ]
  [ -f "tests/e2e/fixtures/emulators/port2-multi-device.json" ]
}

@test "can start emulator with single device" {
  run start_test_emulator "tests/e2e/fixtures/emulators/port1-single-device.json"
  assert_success

  EMULATOR_PID="$output"

  # Verify process is running
  run kill -0 "$EMULATOR_PID"
  assert_success
}

@test "can start emulator with multiple devices" {
  run start_test_emulator "tests/e2e/fixtures/emulators/port2-multi-device.json"
  assert_success

  EMULATOR_PID="$output"

  # Verify process is running
  run kill -0 "$EMULATOR_PID"
  assert_success
}

@test "emulator creates PID file" {
  run start_test_emulator "tests/e2e/fixtures/emulators/port1-single-device.json"
  assert_success

  EMULATOR_PID="$output"

  [ -f "/tmp/emulator-$EMULATOR_PID.pid" ]
}

@test "emulator can be stopped gracefully" {
  run start_test_emulator "tests/e2e/fixtures/emulators/port1-single-device.json"
  assert_success

  EMULATOR_PID="$output"

  # Stop emulator
  stop_test_emulator "$EMULATOR_PID"

  # Verify process is not running
  run kill -0 "$EMULATOR_PID"
  assert_failure
}

@test "emulator logs are created" {
  run start_test_emulator "tests/e2e/fixtures/emulators/port1-single-device.json"
  assert_success

  EMULATOR_PID="$output"

  # Check log file exists
  [ -f "/tmp/emulator-$$.log" ] || [ -f "/tmp/emulator-$EMULATOR_PID.log" ]
}
