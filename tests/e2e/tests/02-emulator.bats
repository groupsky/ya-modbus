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

  # Stop emulator (includes waiting for graceful shutdown or zombie state)
  stop_test_emulator "$EMULATOR_PID"

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

@test "stopping emulator removes PID file, log symlink and captured log" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  local temp_log
  temp_log=$(readlink "/tmp/emulator-$EMULATOR_PID.log")
  [ -f "$temp_log" ]
  [ -f "/tmp/emulator-$EMULATOR_PID.pid" ]

  stop_test_emulator "$EMULATOR_PID"

  [ ! -e "$temp_log" ]
  [ ! -e "/tmp/emulator-$EMULATOR_PID.pid" ]
  [ ! -e "/tmp/emulator-$EMULATOR_PID-logfile.txt" ]
  [ ! -L "/tmp/emulator-$EMULATOR_PID.log" ]
}

@test "stopping emulator force-kills a process that ignores SIGTERM" {
  # The process ends by itself after 30 seconds, so a failing test cannot leak it.
  # It creates the ready file after it started to ignore SIGTERM.
  local ready_file="$BATS_TEST_TMPDIR/stubborn-ready"
  bash -c 'trap "" TERM; touch "$1"; for _ in $(seq 600); do sleep 0.05; done' _ "$ready_file" &
  local stubborn_pid=$!
  wait_for_file "$ready_file"

  local started=$SECONDS
  stop_test_emulator "$stubborn_pid"
  local elapsed=$((SECONDS - started))

  run kill -0 "$stubborn_pid"
  assert_failure
  # Without the force kill, stop waits until the process ends by itself (30 seconds)
  [ "$elapsed" -lt 15 ]
}

@test "start_test_emulator fails and shows the log when emulator exits during startup" {
  run start_test_emulator "fixtures/emulators/does-not-exist.json"
  assert_failure
  assert_output_contains "process died during startup"
  assert_output_contains "ENOENT"
}

@test "assert_emulator_log_contains fails when pattern is not in the log" {
  echo "emulator log line" > /tmp/emulator-424242.log

  run assert_emulator_log_contains 424242 "missing pattern"
  assert_failure
  assert_output_contains "Expected emulator log to contain: missing pattern"
  assert_output_contains "emulator log line"
}

@test "assert_emulator_log_contains fails when the log file does not exist" {
  run assert_emulator_log_contains 424242 "anything"
  assert_failure
  assert_output_contains "log file not found"
}
