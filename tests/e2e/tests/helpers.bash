#!/usr/bin/env bash
#
# Helper functions for BATS tests
#

# Wait for a file/link to exist
wait_for_file() {
  local file=$1
  local timeout=${2:-30}
  local elapsed=0

  while [ $elapsed -lt $timeout ]; do
    if [ -e "$file" ]; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  echo "Timeout waiting for file: $file" >&2
  return 1
}

# Wait for a port to be listening
wait_for_port() {
  local host=${1:-localhost}
  local port=$2
  local timeout=${3:-30}
  local elapsed=0

  while [ $elapsed -lt $timeout ]; do
    if nc -z "$host" "$port" 2>/dev/null; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  echo "Timeout waiting for port: $host:$port" >&2
  return 1
}

# Start MQTT subscriber in background
start_mqtt_subscriber() {
  local topic=${1:-"modbus/#"}
  local output_file=${2:-"/tmp/mqtt-messages-$$.txt"}

  mosquitto_sub -h localhost -p 1883 -t "$topic" -v > "$output_file" 2>&1 &
  local pid=$!

  # Give it a moment to connect
  sleep 1

  # Check if still running
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "Failed to start MQTT subscriber" >&2
    return 1
  fi

  echo "$pid"
  return 0
}

# Stop MQTT subscriber
stop_mqtt_subscriber() {
  local pid=$1

  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
  fi
}

# Start emulator in background using CLI
start_test_emulator() {
  local config_file=$1
  local log_file="/tmp/emulator-$$.log"
  local project_root
  project_root=$(get_project_root)

  # Use the built emulator CLI
  node "$project_root/packages/emulator/dist/esm/bin/ya-modbus-emulator.js" \
    --config "$config_file" \
    --quiet \
    > "$log_file" 2>&1 &
  local pid=$!

  echo "$pid" > "/tmp/emulator-$pid.pid"

  # Wait a moment for emulator to start
  sleep 2

  # Check if still running
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "Failed to start emulator" >&2
    cat "$log_file" >&2
    return 1
  fi

  echo "$pid"
  return 0
}

# Stop emulator
stop_test_emulator() {
  local pid=$1
  local pid_file="/tmp/emulator-$pid.pid"

  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    sleep 1

    # Force kill if still running
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi

    wait "$pid" 2>/dev/null || true
  fi

  rm -f "$pid_file"
}

# Check if Docker service is healthy
is_docker_service_healthy() {
  local service_name=$1

  docker-compose -f tests/e2e/docker-compose.yml ps "$service_name" 2>/dev/null | grep -q "healthy"
}

# Assert command success
assert_success() {
  if [ "$status" -ne 0 ]; then
    echo "Expected success but got status $status" >&2
    echo "Output: $output" >&2
    return 1
  fi
}

# Assert command failure
assert_failure() {
  if [ "$status" -eq 0 ]; then
    echo "Expected failure but got success" >&2
    echo "Output: $output" >&2
    return 1
  fi
}

# Assert output contains string
assert_output_contains() {
  local expected=$1

  if [[ ! "$output" =~ $expected ]]; then
    echo "Expected output to contain: $expected" >&2
    echo "Actual output: $output" >&2
    return 1
  fi
}

# Assert file contains string
assert_file_contains() {
  local file=$1
  local expected=$2

  if [ ! -f "$file" ]; then
    echo "File not found: $file" >&2
    return 1
  fi

  if ! grep -q "$expected" "$file"; then
    echo "Expected file to contain: $expected" >&2
    echo "File contents:" >&2
    cat "$file" >&2
    return 1
  fi
}

# Get project root directory
get_project_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$script_dir/../.." && pwd
}

# Clean test artifacts
clean_test_artifacts() {
  rm -f /tmp/mqtt-messages-*.txt 2>/dev/null || true
  rm -f /tmp/emulator-*.log 2>/dev/null || true
  rm -f /tmp/bridge-*.log 2>/dev/null || true
}
