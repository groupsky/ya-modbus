#!/usr/bin/env bats
#
# Environment and setup tests
# These tests verify that the test environment is properly configured
#

load helpers

@test "socat is installed" {
  run which socat
  assert_success
}

@test "docker compose is installed" {
  run docker compose --version
  assert_success
}

@test "node is installed" {
  run node --version
  assert_success
}

@test "node version matches package.json engines" {
  local project_root
  project_root=$(get_project_root)

  # Read engines.node from package.json and check if current version matches
  run node -e "
    const pkg = require('$project_root/package.json');
    const nodeVersion = process.version.slice(1).split('.')[0];
    const engines = pkg.engines.node;

    // Parse engines.node (e.g., '20 || 22 || 24')
    const allowed = engines.split('||').map(v => v.trim());
    const matches = allowed.some(v => nodeVersion === v || nodeVersion.startsWith(v + '.'));

    if (!matches) {
      console.error(\`Node.js v\${nodeVersion} does not match engines requirement: \${engines}\`);
      process.exit(1);
    }
    console.log(\`✓ Node.js v\${nodeVersion} matches engines: \${engines}\`);
  "
  assert_success
}

@test "mosquitto_sub client is available" {
  run which mosquitto_sub
  assert_success
}

@test "MQTT broker is running" {
  run docker compose -f docker-compose.yml ps mqtt
  assert_success
  assert_output_contains "ya-modbus-test-mqtt"
}

@test "MQTT broker is healthy" {
  run is_docker_service_healthy mqtt
  assert_success
}

@test "MQTT broker is listening on port 1883" {
  run wait_for_port localhost 1883 10
  assert_success
}

@test "can connect and subscribe to MQTT broker" {
  # Subscribe and capture one message, with timeout
  local output_file="/tmp/mqtt-sub-test-$$.txt"

  # Use a specific client ID so we can verify connection in logs
  local client_id="bats-test-$$"
  mosquitto_sub -h localhost -p 1883 -t "test/topic" -i "$client_id" -C 1 > "$output_file" 2>&1 &
  local sub_pid=$!

  # Wait for subscription to be established by checking mosquitto logs
  local timeout=300
  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if docker compose -f docker-compose.yml logs mqtt 2>/dev/null | grep "New client connected" | grep -q "$client_id"; then
      break
    fi
    sleep 0.1
    elapsed=$((elapsed + 1))
  done

  # Verify subscriber is still running
  if ! kill -0 "$sub_pid" 2>/dev/null; then
    echo "Subscriber process died unexpectedly" >&2
    return 1
  fi

  # Publish test message
  run mosquitto_pub -h localhost -p 1883 -t "test/topic" -m "test message"
  assert_success

  # Wait for subscriber to receive message (or timeout)
  timeout=50
  elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if ! kill -0 "$sub_pid" 2>/dev/null; then
      break
    fi
    sleep 0.1
    elapsed=$((elapsed + 1))
  done

  # Kill subscriber if still running
  kill "$sub_pid" 2>/dev/null || true
  wait "$sub_pid" 2>/dev/null || true

  # Verify message was received
  run cat "$output_file"
  assert_output_contains "test message"

  rm -f "$output_file"
}

@test "virtual serial port pair 1 exists" {
  [ -L "/tmp/ttyV0" ]
  [ -L "/tmp/ttyV1" ]
}

@test "virtual serial port pair 2 exists" {
  [ -L "/tmp/ttyV2" ]
  [ -L "/tmp/ttyV3" ]
}

@test "virtual serial ports are connected" {
  # Create temporary file for reading
  local read_output="/tmp/port-test-$$"

  # Start reader first
  timeout 3 cat /tmp/ttyV1 > "$read_output" &
  local read_pid=$!

  # Give reader time to start and open the port
  sleep 0.5

  # Write to paired port
  if ! echo "test" > /tmp/ttyV0; then
    kill "$read_pid" 2>/dev/null || true
    rm -f "$read_output"
    return 1
  fi

  # Wait briefly for data to arrive
  sleep 0.1

  # Check if data was received, then kill the reader
  if [ -s "$read_output" ]; then
    # Data received, kill the reader immediately
    kill "$read_pid" 2>/dev/null || true
    wait "$read_pid" 2>/dev/null || true
  else
    # No data yet, wait for timeout
    wait "$read_pid" 2>/dev/null || true
  fi

  # Verify data was received
  run cat "$read_output"
  assert_output_contains "test"

  # Cleanup
  rm -f "$read_output"
}

@test "project packages are built" {
  local project_root
  project_root=$(get_project_root)

  [ -d "$project_root/packages/emulator/dist" ]
  [ -d "$project_root/packages/mqtt-bridge/dist" ]
  [ -d "$project_root/packages/cli/dist" ]
}

@test "emulator can be imported" {
  run node -e "import('@ya-modbus/emulator').then(() => console.log('ok'))"
  assert_success
  assert_output_contains "ok"
}
