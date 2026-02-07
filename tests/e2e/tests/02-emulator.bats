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
  [ -f "../../packages/emulator/dist/esm/bin/ya-modbus-emulator.js" ]
}

@test "emulator config files exist" {
  [ -f "fixtures/emulators/port1-single-device.json" ]
  [ -f "fixtures/emulators/port2-multi-device.json" ]
}

@test "can start emulator with single device" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success

  EMULATOR_PID="$output"

  # Verify process is running
  run kill -0 "$EMULATOR_PID"
  assert_success
}

@test "can start emulator with multiple devices" {
  run start_test_emulator "fixtures/emulators/port2-multi-device.json"
  assert_success

  EMULATOR_PID="$output"

  # Verify process is running
  run kill -0 "$EMULATOR_PID"
  assert_success
}

@test "emulator creates PID file" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success

  EMULATOR_PID="$output"

  [ -f "/tmp/emulator-$EMULATOR_PID.pid" ]
}

@test "emulator can be stopped gracefully" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success

  EMULATOR_PID="$output"

  # Stop emulator
  stop_test_emulator "$EMULATOR_PID"

  # Wait for process to be fully reaped (not even a zombie)
  local timeout=30
  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if ! kill -0 "$EMULATOR_PID" 2>/dev/null; then
      break
    fi
    # Check if it's a zombie process
    if [ -f "/proc/$EMULATOR_PID/stat" ]; then
      local state=$(awk '{print $3}' "/proc/$EMULATOR_PID/stat" 2>/dev/null)
      if [ "$state" = "Z" ]; then
        # It's a zombie, which is acceptable - process has terminated
        break
      fi
    fi
    sleep 0.1
    elapsed=$((elapsed + 1))
  done

  # Verify process is either gone or a zombie (both mean it terminated)
  if kill -0 "$EMULATOR_PID" 2>/dev/null; then
    # Still exists, check if it's a zombie
    if [ -f "/proc/$EMULATOR_PID/stat" ]; then
      local state=$(awk '{print $3}' "/proc/$EMULATOR_PID/stat" 2>/dev/null)
      [ "$state" = "Z" ] || return 1
    else
      return 1
    fi
  fi
}

@test "emulator logs are created" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success

  EMULATOR_PID="$output"

  # Check log file exists
  [ -f "/tmp/emulator-$$.log" ] || [ -f "/tmp/emulator-$EMULATOR_PID.log" ]
}
