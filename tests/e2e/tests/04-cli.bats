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
    --strategy quick \
    --max-devices 2

  assert_success
  assert_output_contains "Found 2 device"
  assert_output_contains "Slave ID 1"
  assert_output_contains "Slave ID 2"
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

@test "read command logs verbose READ operation to emulator" {
  # Start emulator with verbose logging enabled
  run start_test_emulator "fixtures/emulators/port1-single-device.json" "--verbose"
  assert_success
  EMULATOR_PID="$output"

  # Read voltage data point from EX9EM device
  run node "$CLI_BIN" read \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point voltage

  assert_success

  # Verify emulator logged the READ operation
  # EX9EM driver reads all 11 data registers in one operation starting at addr 0x0000
  assert_emulator_log_contains "$EMULATOR_PID" "\[VERBOSE\] READ"
  assert_emulator_log_contains "$EMULATOR_PID" "slave=1"
  assert_emulator_log_contains "$EMULATOR_PID" "func=0x03"
  assert_emulator_log_contains "$EMULATOR_PID" "addr=0x0000"
  assert_emulator_log_contains "$EMULATOR_PID" "count=11"
  # Verify voltage value is present (2300 decimal = 0x08FC hex = 230.0V when scaled /10)
  assert_emulator_log_contains "$EMULATOR_PID" "0x08FC"
}

@test "read multiple data points logs READ with multiple values" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json" "--verbose"
  assert_success
  EMULATOR_PID="$output"

  # Read voltage and current from EX9EM device
  run node "$CLI_BIN" read \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point voltage current

  assert_success

  # Verify READ operation logged with both values
  assert_emulator_log_contains "$EMULATOR_PID" "\[VERBOSE\] READ"
  assert_emulator_log_contains "$EMULATOR_PID" "addr=0x0000"
  # Verify voltage (register 0: 2300 = 0x08FC = 230.0V) and current (register 1: 520 = 0x0208 = 52.0A)
  assert_emulator_log_contains "$EMULATOR_PID" "0x08FC"
  assert_emulator_log_contains "$EMULATOR_PID" "0x0208"
}

@test "write command logs verbose WRITE operation to emulator" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json" "--verbose"
  assert_success
  EMULATOR_PID="$output"

  # Write device_address configuration parameter (register 43 = 0x002B)
  run node "$CLI_BIN" write \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point device_address \
    --value 5 \
    --yes

  assert_success

  # Verify emulator logged the WRITE operation
  # Transport layer uses func 0x10 (Write Multiple Registers) even for single register writes
  assert_emulator_log_contains "$EMULATOR_PID" "\[VERBOSE\] WRITE"
  assert_emulator_log_contains "$EMULATOR_PID" "slave=1"
  assert_emulator_log_contains "$EMULATOR_PID" "func=0x10"
  assert_emulator_log_contains "$EMULATOR_PID" "addr=0x002B"
  assert_emulator_log_contains "$EMULATOR_PID" "count=1"
  # Verify value written (5 decimal = 0x0005 hex)
  assert_emulator_log_contains "$EMULATOR_PID" "0x0005"
}

@test "write with verify logs both WRITE and READ operations" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json" "--verbose"
  assert_success
  EMULATOR_PID="$output"

  # Write with verification enabled
  run node "$CLI_BIN" write \
    --port /tmp/ttyV1 \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point device_address \
    --value 10 \
    --yes \
    --verify

  assert_success

  # Verify WRITE operation logged (10 decimal = 0x000A hex)
  assert_emulator_log_contains "$EMULATOR_PID" "\[VERBOSE\] WRITE"
  assert_emulator_log_contains "$EMULATOR_PID" "addr=0x002B"
  assert_emulator_log_contains "$EMULATOR_PID" "values=\[0x000A\]"

  # Verify READ operation also logged (--verify flag triggers read-back)
  assert_emulator_log_contains "$EMULATOR_PID" "\[VERBOSE\] READ"
}

# ==========================================
# Discover command filter tests
# ==========================================

@test "discover with --id filter accepts single value" {
  run start_test_emulator "fixtures/emulators/port2-multi-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV3 \
    --id 2 \
    --strategy quick \
    --max-devices 5 \
    --silent \
    --format json

  assert_success
  # Should find slave ID 2 (possibly with multiple parity combinations)
  echo "$output" | jq -e '[.[] | .slaveId] | unique | length == 1'
  echo "$output" | jq -e '.[0].slaveId == 2'
}

@test "discover with --id range filter" {
  run start_test_emulator "fixtures/emulators/port2-multi-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV3 \
    --id 1-2 \
    --strategy quick \
    --max-devices 10 \
    --silent \
    --format json

  assert_success
  # Should find both slave IDs
  echo "$output" | jq -e '[.[] | .slaveId] | unique | sort == [1, 2]'
}

@test "discover with comma-separated --id values" {
  run start_test_emulator "fixtures/emulators/port2-multi-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV3 \
    --id 1,2 \
    --strategy quick \
    --max-devices 10 \
    --silent \
    --format json

  assert_success
  # Should find both slave IDs
  echo "$output" | jq -e '[.[] | .slaveId] | unique | sort == [1, 2]'
}

@test "discover with --parity filter accepts single value" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --driver @ya-modbus/driver-ex9em \
    --parity even \
    --strategy quick \
    --max-devices 5 \
    --silent \
    --format json

  assert_success
  # Should only find devices with even parity
  echo "$output" | jq -e '[.[] | .parity] | unique == ["even"]'
}

@test "discover with multiple --parity flags" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --driver @ya-modbus/driver-ex9em \
    --parity even \
    --parity none \
    --strategy quick \
    --max-devices 5 \
    --silent \
    --format json

  assert_success
  # Should find devices with either even or none parity
  echo "$output" | jq -e '[.[] | .parity] | unique | sort | . == ["even", "none"] or . == ["even"] or . == ["none"]'
}

@test "discover with comma-separated --parity values" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --driver @ya-modbus/driver-ex9em \
    --parity "none,even" \
    --strategy quick \
    --max-devices 5 \
    --silent \
    --format json

  assert_success
  # Should find devices with either none or even parity
  echo "$output" | jq -e '[.[] | .parity] | unique | sort | . == ["even", "none"] or . == ["even"] or . == ["none"]'
}

@test "discover with --baud-rate filter accepts single value" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --driver @ya-modbus/driver-ex9em \
    --baud-rate 9600 \
    --strategy quick \
    --max-devices 5 \
    --silent \
    --format json

  assert_success
  # Should only find devices with 9600 baud rate
  echo "$output" | jq -e '[.[] | .baudRate] | unique == [9600]'
}

@test "discover with multiple --baud-rate flags" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --driver @ya-modbus/driver-ex9em \
    --baud-rate 9600 \
    --baud-rate 19200 \
    --strategy quick \
    --max-devices 5 \
    --silent \
    --format json

  assert_success
  # Should find devices with either 9600 or 19200 baud rate
  echo "$output" | jq -e '[.[] | .baudRate] | unique | sort | . == [9600] or . == [9600, 19200] or . == [19200]'
}

@test "discover with comma-separated --baud-rate values" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --driver @ya-modbus/driver-ex9em \
    --baud-rate "9600,19200" \
    --strategy quick \
    --max-devices 5 \
    --silent \
    --format json

  assert_success
  # Should find devices with either 9600 or 19200 baud rate
  echo "$output" | jq -e '[.[] | .baudRate] | unique | sort | . == [9600] or . == [9600, 19200] or . == [19200]'
}

@test "discover with --baud-rate range syntax" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --driver @ya-modbus/driver-ex9em \
    --baud-rate "4800-19200" \
    --strategy quick \
    --max-devices 5 \
    --silent \
    --format json

  assert_success
  # Should find devices within the baud rate range
  echo "$output" | jq -e '[.[] | .baudRate] | all(. >= 4800 and . <= 19200)'
}

@test "discover with combined --id, --parity, and --baud-rate filters" {
  run start_test_emulator "fixtures/emulators/port2-multi-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV3 \
    --id 1 \
    --parity even \
    --baud-rate 9600 \
    --strategy quick \
    --max-devices 5 \
    --silent \
    --format json

  assert_success
  # All results should match the filters
  echo "$output" | jq -e '[.[] | .slaveId] | unique == [1]'
  echo "$output" | jq -e '[.[] | .parity] | unique == ["even"]'
  echo "$output" | jq -e '[.[] | .baudRate] | unique == [9600]'
}

@test "discover with invalid --parity value shows error" {
  run node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --driver @ya-modbus/driver-ex9em \
    --parity invalid

  assert_failure
  assert_output_contains "Invalid parity"
}

@test "discover with unsupported --baud-rate shows error" {
  run node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --driver @ya-modbus/driver-ex9em \
    --baud-rate 999999

  assert_failure
  assert_output_contains "Unsupported baud rate"
}

@test "discover with invalid --baud-rate range shows error" {
  run node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --driver @ya-modbus/driver-ex9em \
    --baud-rate "19200-9600"

  assert_failure
  assert_output_contains "Invalid range"
}

@test "discover filters are shown in output" {
  run start_test_emulator "fixtures/emulators/port1-single-device.json"
  assert_success
  EMULATOR_PID="$output"

  run node "$CLI_BIN" discover \
    --port /tmp/ttyV1 \
    --driver @ya-modbus/driver-ex9em \
    --id 1 \
    --parity even \
    --baud-rate 9600 \
    --strategy quick \
    --max-devices 1

  assert_success
  # Output should mention the filters
  assert_output_contains "Slave IDs: 1"
  assert_output_contains "Parities: even"
  assert_output_contains "Baud rates: 9600"
}

@test "discover help mentions new filter options" {
  run node "$CLI_BIN" discover --help

  assert_success
  assert_output_contains "--id"
  assert_output_contains "--parity"
  assert_output_contains "--baud-rate"
}
