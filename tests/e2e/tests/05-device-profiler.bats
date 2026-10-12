#!/usr/bin/env bats
#
# Device profiler tests
# These tests verify register scanning functionality using the ya-modbus-profile command
#

load helpers

bats_require_minimum_version 1.5.0

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

@test "rejects slave ID outside the Modbus range" {
  # Slave ID 999 is invalid, so the profiler must stop before connecting
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 999 \
    --type holding \
    --start 0 \
    --end 5 \
    --batch 10

  assert_failure
  assert_output_contains "Invalid slave ID: 999. Must be between 1 and 247"
}

@test "completes scan with unused slave ID showing errors" {
  # Start emulator (slave ID 1)
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  # Scan with a valid slave ID that has no device (2) - completes but shows FAIL status
  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 2 \
    --type holding \
    --start 0 \
    --end 1 \
    --batch 2 \
    --timeout 200

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
# Parameter Validation Tests
# ==========================================
# Invalid values are rejected before any connection is made, so these tests
# do not need an emulator. The timeout stops the test if a scan loops forever.

@test "rejects slave ID 0" {
  run timeout 10 node "$PROFILER_BIN" --port /tmp/ttyV1 --slave-id 0

  assert_failure
  assert_output_contains "Invalid slave ID: 0. Must be between 1 and 247"
}

@test "rejects slave ID 248" {
  run timeout 10 node "$PROFILER_BIN" --port /tmp/ttyV1 --slave-id 248

  assert_failure
  assert_output_contains "Invalid slave ID: 248. Must be between 1 and 247"
}

@test "rejects start address greater than end address" {
  run timeout 10 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --start 100 \
    --end 50

  assert_failure
  assert_output_contains "Invalid address range: start .100. is greater than end .50."
}

@test "rejects end address above 65535" {
  run timeout 10 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --end 65536

  assert_failure
  assert_output_contains "Invalid end address: 65536. Must be between 0 and 65535"
}

@test "rejects batch size 0 instead of looping forever" {
  run timeout 10 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --batch 0

  assert_failure
  assert_output_contains "Invalid batch size: 0. Must be between 1 and 125"
}

@test "rejects negative batch size" {
  run timeout 10 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --batch -1

  assert_failure
  assert_output_contains "Invalid batch size: -1. Must be between 1 and 125"
}

@test "rejects batch size above the Modbus limit" {
  run timeout 10 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --batch 200

  assert_failure
  assert_output_contains "Invalid batch size: 200. Must be between 1 and 125"
}

@test "rejects non-numeric batch size" {
  run timeout 10 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --batch abc

  assert_failure
  assert_output_contains "Expected a whole number"
}

@test "rejects timeout 0" {
  run timeout 10 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --timeout 0

  assert_failure
  assert_output_contains "Invalid timeout: 0. Must be between 1 and 2147483647"
}

@test "rejects timeout above the Node.js timer limit" {
  run timeout 10 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --timeout 3000000000

  assert_failure
  assert_output_contains "Invalid timeout: 3000000000. Must be between 1 and 2147483647"
}

@test "rejects baud rate 0" {
  run timeout 10 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --baud 0

  assert_failure
  assert_output_contains "Invalid baud rate: 0. Must be greater than 0"
}

@test "scans the maximum batch size of 125 registers" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --start 0 \
    --end 124 \
    --batch 125

  assert_success
  assert_output_contains "Scan complete!"
}

@test "scans the maximum register address 65535" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --start 65535 \
    --end 65535 \
    --batch 10

  assert_success
  assert_output_contains "Scanning holding registers from 65535 to 65535"
  assert_output_contains "Scan complete!"
}

@test "scans a large address range of 1001 registers" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run timeout 60 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --start 0 \
    --end 1000 \
    --batch 100

  assert_success
  assert_output_contains "Scan complete!"
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

@test "prints the scan as JSON with --format json" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --start 0 \
    --end 5 \
    --batch 10 \
    --format json

  assert_success
  # The whole output is one JSON document: no progress or table text
  # Register 0 contains voltage: 2300
  assert_output_json '.scan.type == "holding" and .connection.port == "/tmp/ttyV1" and .summary.total == 6 and .summary.failed == 0 and .results[0].value == 2300'
}

@test "prints the scan as YAML with --format yaml" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --start 0 \
    --end 5 \
    --batch 10 \
    --format yaml

  assert_success
  assert_output_contains "^timestamp: "
  assert_output_contains "connection:"
  assert_output_contains "port: /tmp/ttyV1"
  assert_output_contains "  - address: 0"
  # Register 0 contains voltage: 2300
  assert_output_contains "value: 2300"
  assert_output_contains "total: 6"
  # No progress or table text
  assert_output_not_contains "Progress:"
  assert_output_not_contains "Scan complete!"
}

@test "rejects an unknown output format" {
  run timeout 10 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --format xml

  assert_failure
  assert_output_contains "Allowed choices are table, json, yaml"
}

# ==========================================
# Output File Tests
# ==========================================
# With --output, stdout stays empty and a one-line summary goes to stderr.
# "run --separate-stderr" keeps the two streams apart.

@test "writes JSON to the file named by --output" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  local file="$BATS_TEST_TMPDIR/scan.json"

  run --separate-stderr timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --start 0 \
    --end 5 \
    --batch 10 \
    --output "$file"

  assert_success
  # Nothing on stdout, a summary line on stderr
  [ -z "$output" ]
  [[ "$stderr" == "Wrote 6 registers (6 ok, 0 failed) to $file" ]]
  # The file holds one JSON document without progress text
  # Register 0 contains voltage: 2300
  jq -e '.scan.type == "holding" and .summary.total == 6 and .results[0].value == 2300' "$file"
}

@test "writes YAML to a file with a .yaml extension" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  local file="$BATS_TEST_TMPDIR/scan.yaml"

  run --separate-stderr timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --start 0 \
    --end 5 \
    --batch 10 \
    --output "$file"

  assert_success
  [ -z "$output" ]
  assert_file_contains "$file" "^timestamp: "
  assert_file_contains "$file" "  - address: 0"
  # Register 0 contains voltage: 2300
  assert_file_contains "$file" "value: 2300"
  run grep -c -E "Progress|Scan complete" "$file"
  [ "$output" = "0" ]
}

@test "--format overrides the file extension" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  local file="$BATS_TEST_TMPDIR/scan.txt"

  run --separate-stderr timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --start 0 \
    --end 5 \
    --batch 10 \
    --format yaml \
    --output "$file"

  assert_success
  [ -z "$output" ]
  assert_file_contains "$file" "value: 2300"
}

@test "replaces an existing output file" {
  # Start emulator
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  local file="$BATS_TEST_TMPDIR/scan.json"
  echo "old content" > "$file"

  run timeout 30 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --start 0 \
    --end 1 \
    --batch 10 \
    --output "$file"

  assert_success
  jq -e '.summary.total == 2' "$file"
}

@test "rejects an output file name that does not tell the format" {
  local file="$BATS_TEST_TMPDIR/scan.txt"

  run timeout 10 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --output "$file"

  assert_failure
  assert_output_contains "Cannot tell the output format from"
  assert_output_contains "set --format json or --format yaml"
  [ ! -e "$file" ]
}

@test "rejects the table format for an output file" {
  local file="$BATS_TEST_TMPDIR/scan.json"

  run timeout 10 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --format table \
    --output "$file"

  assert_failure
  assert_output_contains "The table format cannot be written to a file"
  [ ! -e "$file" ]
}

@test "rejects an output file in a missing directory before scanning" {
  # No emulator is running: the check must fail before any connection is made
  local file="$BATS_TEST_TMPDIR/missing-directory/scan.json"

  run timeout 10 node "$PROFILER_BIN" \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --output "$file"

  assert_failure
  assert_output_contains "Cannot write to $file"
  assert_output_contains "ENOENT"
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
