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
#
# Starts the ya-modbus emulator in the background with output redirected to a log file.
# The log file is created with a unique temporary name first, then symlinked to a
# PID-based name for easy access by tests.
#
# LOG FILE APPROACH:
# Tests need to read logs via PID-based filename (/tmp/emulator-$pid.log), but we
# don't know the PID until AFTER starting the background process. Shell redirection
# must be specified BEFORE the command runs, creating a chicken-and-egg problem.
#
# SOLUTION:
# 1. Create temp log with guaranteed unique name using mktemp
# 2. Start emulator with output redirected to temp log
# 3. Capture PID from background process
# 4. Create symlink from /tmp/emulator-$pid.log -> temp log
# 5. Store temp log path for cleanup
#
# This ensures the log file is immediately writable and later accessible via PID.
#
# Arguments:
#   $1 - config_file: Path to emulator configuration file
#   $2 - verbose_flag: Optional "--verbose" flag to enable verbose logging
#
# Returns:
#   Prints PID of started emulator to stdout
#   Returns 0 on success, 1 on failure
#
# Example:
#   run start_test_emulator "config.json"
#   run start_test_emulator "config.json" "--verbose"
#
start_test_emulator() {
  local config_file=$1
  local verbose_flag=${2:-""}
  local project_root
  project_root=$(get_project_root)

  # Create guaranteed-unique temp log file
  local temp_log
  temp_log=$(mktemp /tmp/emulator-temp-XXXXXX.log) || {
    echo "Failed to create temp log file" >&2
    return 1
  }

  # Start emulator with output redirected to temp log
  # Use proper quoting for optional verbose flag
  if [ -n "$verbose_flag" ]; then
    node "$project_root/packages/emulator/dist/esm/bin/ya-modbus-emulator.js" \
      --config "$config_file" \
      "$verbose_flag" \
      > "$temp_log" 2>&1 &
  else
    node "$project_root/packages/emulator/dist/esm/bin/ya-modbus-emulator.js" \
      --config "$config_file" \
      > "$temp_log" 2>&1 &
  fi
  local pid=$!

  # Create symlink for PID-based access
  local log_file="/tmp/emulator-$pid.log"
  if ! ln -sf "$temp_log" "$log_file"; then
    echo "Warning: Failed to create log symlink" >&2
  fi

  # Store metadata for cleanup
  echo "$pid" > "/tmp/emulator-$pid.pid"
  echo "$temp_log" > "/tmp/emulator-$pid-logfile.txt"

  # Wait for emulator to be ready by checking log file
  local timeout=50
  local elapsed=0
  local emulator_ready=0

  while [ $elapsed -lt $timeout ]; do
    # Check if process is still alive
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Emulator process died during startup" >&2
      cat "$temp_log" >&2
      return 1
    fi

    # Check log file for "Emulator started successfully" message
    if [ -f "$temp_log" ] && grep -q "Emulator started successfully" "$temp_log" 2>/dev/null; then
      emulator_ready=1
      break
    fi

    sleep 0.1
    elapsed=$((elapsed + 1))
  done

  # If readiness not detected but process alive, it may have started without logging
  if [ $emulator_ready -eq 0 ] && kill -0 "$pid" 2>/dev/null; then
    echo "Warning: Emulator running but startup message not found in logs" >&2
  fi

  # Final check if still running
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "Failed to start emulator" >&2
    cat "$temp_log" >&2
    return 1
  fi

  echo "$pid"
  return 0
}

# Stop emulator
#
# Stops the emulator process and cleans up all associated files (PID file,
# log symlink, and temporary log file).
#
# Arguments:
#   $1 - pid: Process ID of the emulator to stop
#
stop_test_emulator() {
  local pid=$1
  local pid_file="/tmp/emulator-$pid.pid"
  local log_file_ref="/tmp/emulator-$pid-logfile.txt"

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

  # Clean up temp log file (read path from reference file)
  if [ -f "$log_file_ref" ]; then
    local temp_log
    temp_log=$(cat "$log_file_ref" 2>/dev/null)
    if [ -n "$temp_log" ]; then
      rm -f "$temp_log" 2>/dev/null || true
    fi
    rm -f "$log_file_ref"
  fi

  # Clean up PID file and symlink
  rm -f "$pid_file"
  rm -f "/tmp/emulator-$pid.log"
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

# Assert emulator log contains expected pattern
#
# Reads the emulator log file for the given PID and verifies it contains
# the specified pattern using extended regex matching (grep -E).
#
# The log file is accessed via the symlink at /tmp/emulator-$pid.log which
# points to the actual temp log file created by start_test_emulator.
#
# Arguments:
#   $1 - pid: Process ID of the emulator
#   $2 - expected: Pattern to search for (supports grep extended regex)
#
# Returns:
#   0 if pattern found
#   1 if log file not found or pattern not found (dumps full log to stderr)
#
# Examples:
#   assert_emulator_log_contains "$EMULATOR_PID" "\[VERBOSE\] READ"
#   assert_emulator_log_contains "$EMULATOR_PID" "func=0x03"
#   assert_emulator_log_contains "$EMULATOR_PID" "slave=1"
#
# Note: Brackets and special regex characters must be escaped with backslash
#       when using grep -E. For example, to match literal "[VERBOSE]" use "\[VERBOSE\]"
#
assert_emulator_log_contains() {
  local pid=$1
  local expected=$2
  local log_file="/tmp/emulator-$pid.log"

  if [ ! -f "$log_file" ]; then
    echo "Emulator log file not found: $log_file" >&2
    return 1
  fi

  if ! grep -qE "$expected" "$log_file"; then
    echo "Expected emulator log to contain: $expected" >&2
    echo "Emulator log contents:" >&2
    cat "$log_file" >&2
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
  rm -f /tmp/emulator-*.pid 2>/dev/null || true
  rm -f /tmp/emulator-*-logfile.txt 2>/dev/null || true
  rm -f /tmp/emulator-temp-*.log 2>/dev/null || true
  rm -f /tmp/bridge-*.log 2>/dev/null || true
}
