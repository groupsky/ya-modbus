#!/usr/bin/env bats
#
# Device profiler tests
# These tests verify register scanning functionality using the ya-modbus-profile command
#

load helpers

setup() {
  EMULATOR_PID=""
  PROFILER_BIN="$(get_project_root)/packages/device-profiler/dist/esm/bin/profile.js"
  clean_test_artifacts
}

teardown() {
  if [ -n "$EMULATOR_PID" ]; then
    stop_test_emulator "$EMULATOR_PID"
  fi
  clean_test_artifacts
}

# ==========================================
# Binary Existence Tests
# ==========================================

@test "profiler binary exists" {
  [ -f "$PROFILER_BIN" ]
}

@test "profiler shows help text" {
  run node "$PROFILER_BIN" --help
  assert_success
  assert_output_contains "Profile Modbus devices by scanning register ranges"
  assert_output_contains "--port"
  assert_output_contains "--slave-id"
  assert_output_contains "--type"
}

# ==========================================
# Basic Register Scanning Tests
# ==========================================

@test "can scan holding registers on ex9em device" {
  # Start emulator with ex9em device (has holding registers at addresses 0-10, 42-43)
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Scan first 10 holding registers
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --type holding \
    --start 0 \
    --end 10 \
    --batch 5

  assert_success
  # Verify output contains scan results
  assert_output_contains "Progress:"
  assert_output_contains "Scan complete!"
  # Verify table output
  assert_output_contains "Address"
  assert_output_contains "Type"
  assert_output_contains "Status"
}

@test "successfully reads known holding registers with OK status" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Scan registers 0-5 (all exist in fixture)
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --type holding \
    --start 0 \
    --end 5 \
    --batch 10

  assert_success
  # Verify successful reads show OK status
  assert_output_contains "OK"
  # Verify hex values are displayed (register 0 contains voltage: 2300 decimal = 0x08FC)
  assert_output_contains "08FC"
}

@test "can scan with small batch size" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Scan with batch size of 2
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --type holding \
    --start 0 \
    --end 4 \
    --batch 2

  assert_success
  assert_output_contains "Scan complete!"
}

@test "can scan with large batch size" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Scan with batch size of 20
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --type holding \
    --start 0 \
    --end 10 \
    --batch 20

  assert_success
  assert_output_contains "Scan complete!"
}

# ==========================================
# Error Handling Tests
# ==========================================

@test "handles non-existent registers gracefully" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Scan registers that don't exist (500-510)
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --type holding \
    --start 500 \
    --end 510 \
    --batch 10

  assert_success
  # Should complete but show FAIL status or errors
  assert_output_contains "Scan complete!"
}

@test "completes scan with invalid slave ID showing errors" {
  # Start emulator (slave ID 1)
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Scan with wrong slave ID (999) - completes but shows FAIL status
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 999 \
    --type holding \
    --start 0 \
    --end 5 \
    --batch 10

  assert_success
  # Should complete scan but show FAIL statuses
  assert_output_contains "Scan complete!"
  assert_output_contains "FAIL"
}

@test "fails without required port parameter" {
  run node "$PROFILER_BIN" \
    --slave-id 1 \
    --type holding

  assert_failure
  assert_output_contains "required option"
}

@test "fails without required slave-id parameter" {
  run node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --type holding

  assert_failure
  assert_output_contains "required option"
}

# ==========================================
# Register Type Tests
# ==========================================

@test "can specify holding register type explicitly" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Scan holding registers explicitly
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --type holding \
    --start 0 \
    --end 5 \
    --batch 10

  assert_success
  assert_output_contains "holding"
  assert_output_contains "Scan complete!"
}

@test "can specify input register type" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Scan input registers (fixture has no input registers - tests error handling)
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --type input \
    --start 0 \
    --end 5 \
    --batch 10

  assert_success
  assert_output_contains "input"
  assert_output_contains "Scan complete!"
}

# ==========================================
# Serial Port Configuration Tests
# ==========================================

@test "can specify baud rate" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # NOTE: Virtual ports don't enforce baud rate, but command should accept it
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --type holding \
    --start 0 \
    --end 5 \
    --baud 9600 \
    --batch 10

  assert_success
  assert_output_contains "Scan complete!"
}

@test "can specify parity" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Scan with even parity
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --type holding \
    --start 0 \
    --end 5 \
    --parity even \
    --batch 10

  assert_success
  assert_output_contains "Scan complete!"
}

# ==========================================
# Output Format Tests
# ==========================================

@test "output includes progress information" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Scan registers
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --type holding \
    --start 0 \
    --end 10 \
    --batch 5

  assert_success
  # Verify progress messages
  assert_output_contains "Scanning holding registers from 0 to 10"
  assert_output_contains "Progress:"
}

@test "output includes summary table" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Scan a few registers
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --type holding \
    --start 0 \
    --end 3 \
    --batch 10

  assert_success
  # Verify table headers
  assert_output_contains "Address"
  assert_output_contains "Type"
  assert_output_contains "Status"
  assert_output_contains "Value"
  assert_output_contains "Timing"
}

# ==========================================
# Multiple Device Tests
# ==========================================

@test "can scan first device in multi-device setup" {
  # Start emulator with two devices
  run start_test_emulator "fixtures/emulators/port2-multi-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Scan device 1 (XYMD1)
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV3 \
    --slave-id 1 \
    --type holding \
    --start 0 \
    --end 5 \
    --batch 10

  assert_success
  assert_output_contains "Scan complete!"
}

@test "can scan second device in multi-device setup" {
  # Start emulator with two devices
  run start_test_emulator "fixtures/emulators/port2-multi-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Scan device 2 (OR-WE-516)
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV3 \
    --slave-id 2 \
    --type holding \
    --start 0 \
    --end 5 \
    --batch 10

  assert_success
  assert_output_contains "Scan complete!"
}

# ==========================================
# Resource Cleanup Tests
# ==========================================

@test "profiler cleans up resources after scan" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Run profiler
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --type holding \
    --start 0 \
    --end 5 \
    --batch 10

  assert_success

  # Verify emulator is still running (profiler shouldn't kill it)
  kill -0 "$EMULATOR_PID"
}
