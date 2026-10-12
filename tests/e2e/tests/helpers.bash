#!/usr/bin/env bash
#
# Helper functions for BATS tests
#

# Wait for a file/link to exist
wait_for_file() {
  local file=$1
  local timeout=${2:-300}  # Default 3 seconds with 10ms sleep
  local elapsed=0

  while [ $elapsed -lt $timeout ]; do
    if [ -e "$file" ]; then
      return 0
    fi
    sleep 0.01
    elapsed=$((elapsed + 1))
  done

  echo "Timeout waiting for file: $file" >&2
  return 1
}

# Wait for a port to be listening
wait_for_port() {
  local host=${1:-localhost}
  local port=$2
  local timeout=${3:-300}  # Default 3 seconds with 10ms sleep
  local elapsed=0

  while [ $elapsed -lt $timeout ]; do
    if nc -z "$host" "$port" 2>/dev/null; then
      return 0
    fi
    sleep 0.01
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
  if ! wait_for 5 'docker compose -f "'"$compose_file"'" logs mqtt 2>/dev/null | grep -q "New client connected.*as '"$client_id"'"'; then
    echo "MQTT subscriber did not connect within timeout" >&2
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Subscriber process died" >&2
    fi
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

# Background process helpers
#
# The emulator and the mqtt-bridge run as background processes whose output is
# captured in a log file. Both are managed by the generic helpers below. Files
# are named after a prefix ("emulator" or "bridge"); all except the temp log
# also contain the process ID:
#
#   /tmp/<prefix>-temp-XXXXXX.log    captured output (unique name from mktemp)
#   /tmp/<prefix>-<pid>.log          symlink to the captured output
#   /tmp/<prefix>-<pid>.pid          PID file
#   /tmp/<prefix>-<pid>-logfile.txt  path of the captured output, used for cleanup
#
# LOG FILE APPROACH:
# Tests need to read logs via PID-based filename (/tmp/<prefix>-$pid.log), but we
# don't know the PID until AFTER starting the background process. Shell redirection
# must be specified BEFORE the command runs, creating a chicken-and-egg problem.
#
# SOLUTION:
# 1. Create temp log with guaranteed unique name using mktemp
# 2. Start the process with output redirected to temp log
# 3. Capture PID from background process
# 4. Create symlink from /tmp/<prefix>-$pid.log -> temp log
# 5. Store temp log path for cleanup
#
# This ensures the log file is immediately writable and later accessible via PID.

# Check if a process is a zombie (terminated but not yet reaped)
_is_zombie() {
  local pid=$1

  [ -f "/proc/$pid/stat" ] || return 1
  [ "$(awk '{print $3}' "/proc/$pid/stat" 2>/dev/null)" = "Z" ]
}

# Start a background process and wait until its log shows it is ready
#
# Arguments:
#   $1 - prefix: Name used for the process files and in messages ("emulator", "bridge")
#   $2 - ready_pattern: Pattern (grep -E) in the process log that marks a successful start
#   $3... - Command and arguments to run
#
# Returns:
#   Prints PID of the started process to stdout
#   Returns 0 on success, 1 on failure (dumps the process log to stderr when the
#   process did not become ready)
#
_start_background_process() {
  local prefix=$1
  local ready_pattern=$2
  shift 2

  # Create guaranteed-unique temp log file
  local temp_log
  temp_log=$(mktemp "/tmp/$prefix-temp-XXXXXX.log") || {
    echo "Failed to create temp log file" >&2
    return 1
  }

  "$@" > "$temp_log" 2>&1 &
  local pid=$!

  # Create symlink for PID-based access
  local log_file="/tmp/$prefix-$pid.log"
  if ! ln -sf "$temp_log" "$log_file"; then
    echo "Warning: Failed to create log symlink" >&2
  fi

  # Store metadata for cleanup
  echo "$pid" > "/tmp/$prefix-$pid.pid"
  echo "$temp_log" > "/tmp/$prefix-$pid-logfile.txt"

  # Wait for the process to be ready by checking log file
  if ! wait_for 5 '[ -f "$temp_log" ] && grep -qE "$ready_pattern" "$temp_log" 2>/dev/null'; then
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "$prefix process died during startup" >&2
    else
      echo "$prefix startup message not found within timeout" >&2
    fi
    cat "$temp_log" >&2
    return 1
  fi

  echo "$pid"
  return 0
}

# Stop a background process started by _start_background_process
#
# Stops the process and cleans up all associated files (PID file, log symlink,
# and temporary log file).
#
# Arguments:
#   $1 - prefix: Name used for the process files ("emulator", "bridge")
#   $2 - pid: Process ID of the process to stop
#
_stop_background_process() {
  local prefix=$1
  local pid=$2
  local pid_file="/tmp/$prefix-$pid.pid"
  local log_file_ref="/tmp/$prefix-$pid-logfile.txt"

  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true

    # Wait for process to terminate (a zombie has terminated and is acceptable)
    local timeout=300  # 3 seconds with 10ms sleep
    local elapsed=0
    while [ $elapsed -lt $timeout ]; do
      if ! kill -0 "$pid" 2>/dev/null || _is_zombie "$pid"; then
        break
      fi
      sleep 0.01
      elapsed=$((elapsed + 1))
    done

    # Force kill if still running (not a zombie)
    if kill -0 "$pid" 2>/dev/null && ! _is_zombie "$pid"; then
      kill -9 "$pid" 2>/dev/null || true
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
  rm -f "/tmp/$prefix-$pid.log"
}

# Assert that the log of a background process contains a pattern
#
# Reads /tmp/<prefix>-$pid.log and verifies it contains the pattern using
# extended regex matching (grep -E).
#
# Arguments:
#   $1 - prefix: Name used for the process files ("emulator", "bridge")
#   $2 - pid: Process ID of the process
#   $3 - expected: Pattern to search for (supports grep extended regex)
#
# Returns:
#   0 if pattern found
#   1 if log file not found or pattern not found (dumps full log to stderr)
#
_assert_process_log_contains() {
  local prefix=$1
  local pid=$2
  local expected=$3
  local log_file="/tmp/$prefix-$pid.log"

  if [ ! -f "$log_file" ]; then
    echo "$prefix log file not found: $log_file" >&2
    return 1
  fi

  if ! grep -qE "$expected" "$log_file"; then
    echo "Expected $prefix log to contain: $expected" >&2
    echo "$prefix log contents:" >&2
    cat "$log_file" >&2
    return 1
  fi
}

# Start emulator in background using CLI
#
# Starts the ya-modbus emulator in the background with output redirected to a log file
# (see "Background process helpers" for the log file approach).
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

  local args=(--config "$config_file")
  if [ -n "$verbose_flag" ]; then
    args+=("$verbose_flag")
  fi

  _start_background_process emulator "Emulator started successfully" \
    node "$project_root/packages/emulator/dist/esm/bin/ya-modbus-emulator.js" "${args[@]}"
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
  _stop_background_process emulator "$1"
}

# TCP port of the emulator started by start_tcp_emulator
#
# A high port below the Linux ephemeral port range (32768-60999): it needs no
# privileges, it is not the MQTT broker port (1883), and outgoing connections of
# the tools under test never pick it. Test files run one after another and the
# emulator is stopped before the next test, so they can share the port.
TCP_EMULATOR_PORT=15502

# Start emulator with a Modbus TCP transport in background
#
# Works like start_test_emulator, but listens on a TCP port. The port comes from
# the optional argument, so the config file does not need to match it. The
# emulator is stopped with stop_test_emulator.
#
# Arguments:
#   $1 - config_file: Path to emulator configuration file with a TCP transport
#   $2 - port: Optional TCP port (default: TCP_EMULATOR_PORT)
#
# Returns:
#   Prints PID of started emulator to stdout
#   Returns 0 on success, 1 on failure
#
# Example:
#   run start_tcp_emulator "fixtures/emulators/tcp-single-device.json"
#   run start_tcp_emulator "fixtures/emulators/tcp-single-device.json" 15503
#
start_tcp_emulator() {
  local config_file=$1
  local port=${2:-$TCP_EMULATOR_PORT}

  # The emulator reads its port from the config file only, so write a copy with
  # the requested port. BATS removes the per-test directory after the test.
  local tcp_config="$BATS_TEST_TMPDIR/emulator-tcp-$port.json"
  if ! jq --argjson port "$port" '.transport.port = $port' "$config_file" > "$tcp_config"; then
    echo "Failed to create emulator config for TCP port $port from $config_file" >&2
    return 1
  fi

  start_test_emulator "$tcp_config"
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

# Assert output contains pattern
#
# Arguments:
#   $1 - expected: Pattern to find in output (bash extended regex, so escape
#        special characters such as ( ) [ ] . with a backslash to match them literally)
#
assert_output_contains() {
  local expected=$1

  if [[ ! "$output" =~ $expected ]]; then
    echo "Expected output to contain: $expected" >&2
    echo "Actual output: $output" >&2
    return 1
  fi
}

# Assert output does not contain pattern
#
# Arguments:
#   $1 - unexpected: Pattern that must not appear in output (bash extended regex)
#
assert_output_not_contains() {
  local unexpected=$1

  # [[ =~ ]] returns 0 for a match, 1 for no match and 2 for an invalid pattern
  local match_status=0
  [[ "$output" =~ $unexpected ]] || match_status=$?

  if [ "$match_status" -eq 2 ]; then
    echo "Invalid pattern: $unexpected" >&2
    return 1
  fi

  if [ "$match_status" -eq 0 ]; then
    echo "Expected output not to contain: $unexpected" >&2
    echo "Actual output: $output" >&2
    return 1
  fi
}

# Assert output is JSON that satisfies a jq expression
#
# Validates the whole output with a single jq call. Combine several checks
# with "and" in one expression instead of calling this helper repeatedly.
#
# Arguments:
#   $1 - filter: jq expression that must evaluate to the boolean true
#
# Examples:
#   assert_output_json 'type == "array" and length == 1'
#   assert_output_json 'has("defaultConfig") and .defaultConfig.baudRate == 9600'
#
assert_output_json() {
  local filter=$1

  if ! echo "$output" | jq -e "($filter) == true" >/dev/null; then
    echo "Expected output to be JSON matching: $filter" >&2
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

# Assert file contains string on specific topic
#
# Verifies that a specific MQTT topic has messages containing the expected string
#
# Arguments:
#   $1 - file: Path to MQTT messages file (topic + space + payload format)
#   $2 - topic: MQTT topic to check
#   $3 - expected: Pattern to search for in messages on that topic
#
assert_topic_contains() {
  local file=$1
  local topic=$2
  local expected=$3

  if [ ! -f "$file" ]; then
    echo "File not found: $file" >&2
    return 1
  fi

  # Extract messages for specific topic and check content
  if ! grep "^$topic " "$file" | grep -q "$expected"; then
    echo "Expected topic '$topic' to contain: $expected" >&2
    echo "Messages on topic '$topic':" >&2
    grep "^$topic " "$file" >&2 || echo "(no messages on this topic)" >&2
    return 1
  fi
}

# Assert JSON field value in topic message
#
# Extracts the most recent message from a specific MQTT topic, parses it as JSON,
# and validates a field matches the expected value. Uses jq for JSON parsing.
#
# Arguments:
#   $1 - file: Path to MQTT messages file (topic + space + payload format)
#   $2 - topic: MQTT topic to extract message from
#   $3 - field_path: jq field path (e.g., ".data.voltage", ".deviceId", ".timestamp")
#   $4 - expected: Expected value (or type like "number", "string", "object")
#
# Returns:
#   0 if field matches expected value
#   1 if file not found, topic has no messages, JSON invalid, or value mismatch
#
# Examples:
#   assert_json_field "$FILE" "modbus/ex9em-1/data" ".deviceId" "ex9em-1"
#   assert_json_field "$FILE" "modbus/ex9em-1/data" ".data.voltage" 230
#   assert_json_field "$FILE" "modbus/ex9em-1/data" ".timestamp" "number"
#
assert_json_field() {
  local file=$1
  local topic=$2
  local field_path=$3
  local expected=$4

  if [ ! -f "$file" ]; then
    echo "File not found: $file" >&2
    return 1
  fi

  # Extract most recent message from topic (last occurrence)
  local message
  message=$(grep "^$topic " "$file" | tail -1 | cut -d' ' -f2-)

  if [ -z "$message" ]; then
    echo "No messages found on topic: $topic" >&2
    return 1
  fi

  # Validate JSON before processing to avoid parse errors from concurrent writes
  if ! echo "$message" | jq empty 2>/dev/null; then
    echo "Invalid or incomplete JSON in topic '$topic' (likely concurrent write)" >&2
    echo "Message: $message" >&2
    return 1
  fi

  # Handle type checking (number, string, object, array, boolean, null)
  if [[ "$expected" =~ ^(number|string|object|array|boolean|null)$ ]]; then
    if ! echo "$message" | jq -e "$field_path | type == \"$expected\"" >/dev/null 2>&1; then
      echo "Expected $field_path to be type '$expected' in topic '$topic'" >&2
      echo "Message: $message" >&2
      echo "Field value: $(echo "$message" | jq "$field_path" 2>&1)" >&2
      return 1
    fi
  else
    # Value comparison
    if ! echo "$message" | jq -e "$field_path == $expected" >/dev/null 2>&1; then
      echo "Expected $field_path to equal '$expected' in topic '$topic'" >&2
      echo "Message: $message" >&2
      echo "Field value: $(echo "$message" | jq "$field_path" 2>&1)" >&2
      return 1
    fi
  fi

  return 0
}

# Assert JSON field exists in topic message
#
# Validates that a specific JSON field path exists in the most recent message
# from an MQTT topic, regardless of its value.
#
# Arguments:
#   $1 - file: Path to MQTT messages file
#   $2 - topic: MQTT topic to check
#   $3 - field_path: jq field path (e.g., ".data.voltage")
#
# Returns:
#   0 if field exists
#   1 if file not found, topic has no messages, or field is missing/null
#
# Examples:
#   assert_json_field_exists "$FILE" "modbus/ex9em-1/data" ".data"
#   assert_json_field_exists "$FILE" "modbus/ex9em-1/data" ".timestamp"
#
assert_json_field_exists() {
  local file=$1
  local topic=$2
  local field_path=$3

  if [ ! -f "$file" ]; then
    echo "File not found: $file" >&2
    return 1
  fi

  local message
  message=$(grep "^$topic " "$file" | tail -1 | cut -d' ' -f2-)

  if [ -z "$message" ]; then
    echo "No messages found on topic: $topic" >&2
    return 1
  fi

  # Validate JSON before processing to avoid parse errors from concurrent writes
  if ! echo "$message" | jq empty 2>/dev/null; then
    echo "Invalid or incomplete JSON in topic '$topic' (likely concurrent write)" >&2
    echo "Message: $message" >&2
    return 1
  fi

  if ! echo "$message" | jq -e "$field_path != null" >/dev/null 2>&1; then
    echo "Expected field $field_path to exist in topic '$topic'" >&2
    echo "Message: $message" >&2
    return 1
  fi

  return 0
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
  _assert_process_log_contains emulator "$1" "$2"
}

# Wait for a condition to become true
#
# Polls a command/assertion until it succeeds or timeout is reached.
# Sleeps 10ms between attempts for fast test execution.
#
# Arguments:
#   $1 - timeout_seconds: Maximum time to wait in seconds (e.g., 5 for 5 seconds)
#   $2 - check_command: Command/assertion to execute (will be eval'd)
#
# Returns:
#   0 if condition became true within timeout
#   1 if timeout reached
#
# Examples:
#   wait_for 5 'assert_file_contains "$FILE" "expected"'
#   wait_for 10 '[ -f "/tmp/ready.txt" ]'
#
wait_for() {
  local timeout_seconds=$1
  local check_command=$2
  local sleep_interval=0.01
  local iterations=$((timeout_seconds * 100))  # 100 iterations per second (10ms each)
  local elapsed=0

  while [ $elapsed -lt $iterations ]; do
    if eval "$check_command" 2>/dev/null; then
      return 0
    fi
    sleep $sleep_interval
    elapsed=$((elapsed + 1))
  done

  # Timeout reached - run command one more time to show error
  eval "$check_command"
  return 1
}

# Get project root directory
get_project_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$script_dir/../.." && pwd
}

# Log pattern that shows the mqtt-bridge started and loaded its devices
BRIDGE_READY_PATTERN='(✓ Loaded device:|Bridge started successfully)'

# Start mqtt-bridge in background
#
# Starts the ya-modbus mqtt-bridge in the background with output redirected to a log file
# (see "Background process helpers" for the log file approach).
#
# Arguments:
#   $1 - config_file: Path to bridge configuration file
#
# Returns:
#   Prints PID of started bridge to stdout
#   Returns 0 on success, 1 on failure
#
start_mqtt_bridge() {
  local config_file=$1
  local project_root
  project_root=$(get_project_root)

  # Start bridge using official CLI (now supports device loading from config)
  # Look for "✓ Loaded device:" to ensure devices are actually loaded
  _start_background_process bridge "$BRIDGE_READY_PATTERN" \
    "$project_root/packages/mqtt-bridge/dist/esm/bin/ya-modbus-bridge.js" \
    run \
    --config "$config_file"
}

# Stop mqtt-bridge
#
# Stops the bridge process and cleans up all associated files (PID file,
# log symlink, and temporary log file).
#
# Arguments:
#   $1 - pid: Process ID of the bridge to stop
#
stop_mqtt_bridge() {
  _stop_background_process bridge "$1"
}

# Assert bridge is running and healthy
#
# Checks that bridge process is alive and logs show successful startup
#
# Arguments:
#   $1 - pid: Process ID of the bridge
#
assert_bridge_running() {
  local pid=$1
  local log_file="/tmp/bridge-$pid.log"

  # Check process is alive
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "Bridge process is not running (PID: $pid)" >&2
    if [ -f "$log_file" ]; then
      echo "Bridge log:" >&2
      cat "$log_file" >&2
    fi
    return 1
  fi

  # Check logs show successful startup
  if [ -f "$log_file" ] && grep -qE "$BRIDGE_READY_PATTERN" "$log_file"; then
    return 0
  fi

  echo "Bridge is running but startup not confirmed in logs" >&2
  return 1
}

# Assert bridge log contains expected pattern
#
# Arguments:
#   $1 - pid: Process ID of the bridge
#   $2 - expected: Pattern to search for (supports grep extended regex)
#
assert_bridge_log_contains() {
  _assert_process_log_contains bridge "$1" "$2"
}

# Clean test artifacts
clean_test_artifacts() {
  rm -f /tmp/mqtt-messages-*.txt 2>/dev/null || true

  local prefix
  for prefix in emulator bridge; do
    rm -f /tmp/"$prefix"-*.log 2>/dev/null || true
    rm -f /tmp/"$prefix"-*.pid 2>/dev/null || true
    rm -f /tmp/"$prefix"-*-logfile.txt 2>/dev/null || true
    rm -f /tmp/"$prefix"-temp-*.log 2>/dev/null || true
  done
}
