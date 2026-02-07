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
    sleep 0.1
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
    sleep 0.1
    elapsed=$((elapsed + 1))
  done

  echo "Timeout waiting for port: $host:$port" >&2
  return 1
}

# Start MQTT subscriber in background
start_mqtt_subscriber() {
  local topic=${1:-"modbus/#"}
  local output_file=${2:-"/tmp/mqtt-messages-$$.txt"}
  local compose_file="docker-compose.yml"

  # Use a unique client ID so we can verify connection in mosquitto logs
  local client_id="bats-subscriber-$$"
  mosquitto_sub -h localhost -p 1883 -t "$topic" -i "$client_id" -v > "$output_file" 2>&1 &
  local pid=$!

  # Wait for subscriber to connect by polling broker logs
  # Polling is more reliable than logs --follow which can cause broken pipe with grep -q
  local timeout=300
  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if docker compose -f "$compose_file" logs mqtt 2>/dev/null | grep -q "New client connected.*as $client_id"; then
      break
    fi
    sleep 0.1
    elapsed=$((elapsed + 1))
  done

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

  # Wait for emulator to be ready by checking log file
  local timeout=50
  local elapsed=0
  local emulator_ready=0

  while [ $elapsed -lt $timeout ]; do
    # Check if process is still alive
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Emulator process died during startup" >&2
      cat "$log_file" >&2
      return 1
    fi

    # Check log file for startup completion or listen message
    if [ -f "$log_file" ] && grep -q -E "(started|listening|ready)" "$log_file" 2>/dev/null; then
      emulator_ready=1
      break
    fi

    sleep 0.1
    elapsed=$((elapsed + 1))
  done

  # If no readiness signal found but process is alive, give it a brief moment
  if [ $emulator_ready -eq 0 ] && kill -0 "$pid" 2>/dev/null; then
    sleep 0.5
  fi

  # Final check if still running
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

    # Wait for process to be fully reaped (not even a zombie)
    local timeout=30
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
      if ! kill -0 "$pid" 2>/dev/null; then
        break
      fi
      # Check if it's a zombie process
      if [ -f "/proc/$pid/stat" ]; then
        local state=$(awk '{print $3}' "/proc/$pid/stat" 2>/dev/null)
        if [ "$state" = "Z" ]; then
          # It's a zombie, which is acceptable - process has terminated
          break
        fi
      fi
      sleep 0.1
      elapsed=$((elapsed + 1))
    done

    # Force kill if still running (not a zombie)
    if kill -0 "$pid" 2>/dev/null; then
      # Check if it's a zombie before force killing
      if [ -f "/proc/$pid/stat" ]; then
        local state=$(awk '{print $3}' "/proc/$pid/stat" 2>/dev/null)
        if [ "$state" != "Z" ]; then
          kill -9 "$pid" 2>/dev/null || true
        fi
      else
        kill -9 "$pid" 2>/dev/null || true
      fi
    fi

    wait "$pid" 2>/dev/null || true
  fi

  rm -f "$pid_file"
}

# Check if Docker service is healthy
is_docker_service_healthy() {
  local service_name=$1

  docker compose -f docker-compose.yml ps "$service_name" 2>/dev/null | grep -q "healthy"
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
