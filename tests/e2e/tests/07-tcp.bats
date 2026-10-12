#!/usr/bin/env bats
#
# Modbus TCP tests
# These tests verify that the CLI (--host and --tcp-port) and the device profiler
# (--port host:port) talk to a device over Modbus TCP. The device is the
# emulator, listening on a loopback TCP port.
#
# Rejecting --port together with --host is covered in 04-cli.bats.
#

load helpers

setup() {
  EMULATOR_PID=""
  CLI_BIN="$(get_project_root)/packages/cli/dist/esm/bin/ya-modbus.js"
  PROFILER_BIN="$(get_project_root)/packages/device-profiler/dist/esm/bin/profile.js"
  TCP_FIXTURE="fixtures/emulators/tcp-single-device.json"
  SLOW_TCP_FIXTURE="fixtures/emulators/tcp-slow-device.json"
  clean_test_artifacts
}

teardown() {
  if [ -n "$EMULATOR_PID" ]; then
    stop_test_emulator "$EMULATOR_PID"
  fi
  clean_test_artifacts
}

# ==========================================
# Emulator Fixture Tests
# ==========================================

@test "TCP emulator accepts connections on its port" {
  run start_tcp_emulator "$TCP_FIXTURE"
  assert_success
  EMULATOR_PID="$output"

  run nc -z 127.0.0.1 "$TCP_EMULATOR_PORT"
  assert_success
}

# ==========================================
# CLI Read Tests
# ==========================================

@test "read command reads a data point over TCP" {
  run start_tcp_emulator "$TCP_FIXTURE"
  assert_success
  EMULATOR_PID="$output"

  run timeout 10 node "$CLI_BIN" read \
    --host 127.0.0.1 \
    --tcp-port "$TCP_EMULATOR_PORT" \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point voltage

  assert_success
  assert_output_contains "Voltage"
  assert_output_contains "230\.0.*V"
  assert_output_contains "Performance:"
}

@test "read command reads data points over TCP in JSON format" {
  run start_tcp_emulator "$TCP_FIXTURE"
  assert_success
  EMULATOR_PID="$output"

  run timeout 10 node "$CLI_BIN" read \
    --host 127.0.0.1 \
    --tcp-port "$TCP_EMULATOR_PORT" \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point voltage current \
    --format json

  assert_success
  assert_output_json '
    .connection.host == "127.0.0.1"
    and (.dataPoints | map({id, value}) == [{"id": "voltage", "value": 230}, {"id": "current", "value": 52}])
    and .performance.errors == 0
  '
}

@test "read command uses the port given with --tcp-port" {
  # The fixture listens on another port; the custom port must reach the connection
  run start_tcp_emulator "$TCP_FIXTURE" 15503
  assert_success
  EMULATOR_PID="$output"

  run timeout 10 node "$CLI_BIN" read \
    --host 127.0.0.1 \
    --tcp-port 15503 \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point voltage

  assert_success
  assert_output_contains "230.0"
}

@test "read command connects to port 502 when --tcp-port is not given" {
  if nc -z 127.0.0.1 502 2>/dev/null; then
    skip "port 502 is in use on this machine"
  fi

  # The emulator is on another port, so the default port 502 must be refused
  run start_tcp_emulator "$TCP_FIXTURE"
  assert_success
  EMULATOR_PID="$output"

  run timeout 10 node "$CLI_BIN" read \
    --host 127.0.0.1 \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point voltage

  assert_failure
  assert_output_contains "ECONNREFUSED 127\.0\.0\.1:502"
}

# ==========================================
# CLI Write Tests
# ==========================================

@test "write command changes a data point over TCP and read returns the new value" {
  run start_tcp_emulator "$TCP_FIXTURE"
  assert_success
  EMULATOR_PID="$output"

  run timeout 10 node "$CLI_BIN" read \
    --host 127.0.0.1 \
    --tcp-port "$TCP_EMULATOR_PORT" \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point device_address \
    --format json
  assert_success
  assert_output_json '.dataPoints[0].value == 1'

  run timeout 10 node "$CLI_BIN" write \
    --host 127.0.0.1 \
    --tcp-port "$TCP_EMULATOR_PORT" \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point device_address \
    --value 7 \
    --yes
  assert_success
  assert_output_contains "Successfully wrote 7 to device_address"

  # A separate connection must see the written value
  run timeout 10 node "$CLI_BIN" read \
    --host 127.0.0.1 \
    --tcp-port "$TCP_EMULATOR_PORT" \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point device_address \
    --format json
  assert_success
  assert_output_json '.dataPoints[0].value == 7'
}

# ==========================================
# CLI Connection Error Tests
# ==========================================

@test "read command fails with connection refused when nothing listens on the TCP port" {
  # No emulator is started, so the port is closed. The timeout would end a hang
  # with status 124 and no output, which the assertions below reject.
  run timeout 10 node "$CLI_BIN" read \
    --host 127.0.0.1 \
    --tcp-port "$TCP_EMULATOR_PORT" \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point voltage

  [ "$status" -eq 1 ]
  assert_output_contains "ECONNREFUSED 127\.0\.0\.1:$TCP_EMULATOR_PORT"
}

@test "write command fails with connection refused when nothing listens on the TCP port" {
  run timeout 10 node "$CLI_BIN" write \
    --host 127.0.0.1 \
    --tcp-port "$TCP_EMULATOR_PORT" \
    --slave-id 1 \
    --driver @ya-modbus/driver-ex9em \
    --data-point device_address \
    --value 7 \
    --yes

  [ "$status" -eq 1 ]
  assert_output_contains "ECONNREFUSED 127\.0\.0\.1:$TCP_EMULATOR_PORT"
}

# ==========================================
# Device Profiler Tests
# ==========================================

@test "profiler scans registers over TCP" {
  run start_tcp_emulator "$TCP_FIXTURE"
  assert_success
  EMULATOR_PID="$output"

  # Registers 0-5 all exist in the fixture
  run timeout 30 node "$PROFILER_BIN" \
    --port "127.0.0.1:$TCP_EMULATOR_PORT" \
    --slave-id 1 \
    --type holding \
    --start 0 \
    --end 5 \
    --batch 10

  assert_success
  assert_output_contains "Scan complete!"
  assert_output_contains "OK"
  # Register 0 holds the voltage: 2300 decimal = 0x08FC
  assert_output_contains "08FC"
  assert_output_not_contains "FAIL"
}

@test "profiler scan over TCP in JSON format reports the register values" {
  run start_tcp_emulator "$TCP_FIXTURE"
  assert_success
  EMULATOR_PID="$output"

  run timeout 30 node "$PROFILER_BIN" \
    --port "127.0.0.1:$TCP_EMULATOR_PORT" \
    --slave-id 1 \
    --start 0 \
    --end 2 \
    --batch 3 \
    --format json

  assert_success
  assert_output_json '
    .connection.port == "127.0.0.1:'"$TCP_EMULATOR_PORT"'"
    and (.results | map(.value) == [2300, 520, 500])
    and .summary.failed == 0
  '
}

@test "profiler rejects an invalid TCP port number" {
  local port
  for port in 0 65536 -1 abc; do
    run timeout 10 node "$PROFILER_BIN" --port "127.0.0.1:$port" --slave-id 1

    assert_failure
    assert_output_contains "Invalid port number: $port\. Must be between 1 and 65535"
  done
}

@test "profiler rejects a TCP address without host or port" {
  local address
  for address in "127.0.0.1:" ":$TCP_EMULATOR_PORT"; do
    run timeout 10 node "$PROFILER_BIN" --port "$address" --slave-id 1

    assert_failure
    assert_output_contains "Invalid TCP address format\. Expected host:port"
  done
}

@test "profiler fails with connection refused when nothing listens on the TCP port" {
  run timeout 10 node "$PROFILER_BIN" \
    --port "127.0.0.1:$TCP_EMULATOR_PORT" \
    --slave-id 1

  [ "$status" -eq 1 ]
  assert_output_contains "ECONNREFUSED 127\.0\.0\.1:$TCP_EMULATOR_PORT"
}

# ==========================================
# Device Profiler Timeout Tests
# ==========================================

# The slow device answers every request after 1500 ms.

@test "profiler reports Timed out and completes the scan when the device answers after --timeout" {
  run start_tcp_emulator "$SLOW_TCP_FIXTURE"
  assert_success
  EMULATOR_PID="$output"

  run timeout 30 node "$PROFILER_BIN" \
    --port "127.0.0.1:$TCP_EMULATOR_PORT" \
    --slave-id 1 \
    --type holding \
    --start 0 \
    --end 1 \
    --batch 2 \
    --timeout 100

  assert_success
  assert_output_contains "Scan complete!"
  assert_output_contains "FAIL"
  assert_output_contains "Timed out"
  assert_output_not_contains "OK"
}

@test "profiler classifies a late answer as a timeout and gives up before the device answers" {
  run start_tcp_emulator "$SLOW_TCP_FIXTURE"
  assert_success
  EMULATOR_PID="$output"

  run timeout 30 node "$PROFILER_BIN" \
    --port "127.0.0.1:$TCP_EMULATOR_PORT" \
    --slave-id 1 \
    --type holding \
    --start 0 \
    --end 1 \
    --batch 2 \
    --timeout 100 \
    --format json

  assert_success
  assert_output_json '
    .summary.total == 2
    and .summary.failed == 2
    and (.results | all(.success == false and .errorType == "timeout" and .timing >= 100 and .timing < 1500))
  '
}

@test "profiler waits for a slow device when --timeout is longer than its delay" {
  run start_tcp_emulator "$SLOW_TCP_FIXTURE"
  assert_success
  EMULATOR_PID="$output"

  run timeout 30 node "$PROFILER_BIN" \
    --port "127.0.0.1:$TCP_EMULATOR_PORT" \
    --slave-id 1 \
    --type holding \
    --start 0 \
    --end 0 \
    --batch 1 \
    --timeout 3000 \
    --format json

  assert_success
  # The read succeeds and its timing shows the wait for the 1500 ms answer
  assert_output_json '
    .results[0].success == true
    and .results[0].value == 2300
    and .results[0].timing >= 1400
  '
}
