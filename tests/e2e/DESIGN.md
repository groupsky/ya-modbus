# E2E Infrastructure Testing Design

## Overview

Infrastructure-level end-to-end testing for ya-modbus using real services, shell scripts, and BATS testing framework. Tests run mqtt-bridge, CLI tools, and device-profiler against real emulated Modbus devices.

## Philosophy

- **Real over Mocked**: Use real services (MQTT broker, emulators) not mocks
- **Simple over Complex**: Shell scripts and BATS, not complex frameworks
- **Stable over Fancy**: Proven tools over cutting-edge
- **Local-first**: Easy to run locally, then in CI

## Technology Stack

| Tool                | Purpose                | Why                                         |
| ------------------- | ---------------------- | ------------------------------------------- |
| **BATS**            | Shell/CLI testing      | Simple, actively maintained, great for CLIs |
| **Docker Compose**  | Service orchestration  | Standard tool, easy multi-service setup     |
| **nektos/act**      | Local workflow testing | Test GitHub Actions without pushing         |
| **socat**           | Virtual serial ports   | Lightweight, no kernel modules needed       |
| **Aedes/Mosquitto** | MQTT broker            | Lightweight MQTT broker for testing         |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              GitHub Actions / Local Runner              │
│  - Installs socat, BATS                                 │
│  - Runs docker-compose up                               │
│  - Executes BATS tests                                  │
│  - Collects logs                                        │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Docker Compose Environment                 │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ MQTT Broker  │  │ Emulator 1   │  │ Emulator 2   │  │
│  │ (Mosquitto)  │  │ (ex9em)      │  │ (xymd1+      │  │
│  │              │  │ 1 device     │  │ or-we-516)   │  │
│  │ Port: 1883   │  │ SlaveID: 1   │  │ 2 devices    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                           │                 │            │
│                           └────────┬────────┘            │
│                                    │                     │
│                                    ▼                     │
│                    ┌─────────────────────────┐          │
│                    │   Virtual Serial Ports  │          │
│                    │   (via socat on host)   │          │
│                    │   /tmp/ttyV0 ↔ /tmp/ttyV1│         │
│                    │   /tmp/ttyV2 ↔ /tmp/ttyV3│         │
│                    └─────────────────────────┘          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    BATS Test Suite                       │
│                                                          │
│  1. Start mqtt-bridge (connects to emulators via        │
│     virtual serial ports)                                │
│  2. Verify bridge publishes to MQTT                     │
│  3. Test CLI read/write commands                        │
│  4. Test device-profiler discover command               │
│  5. Verify data correctness                             │
│  6. Cleanup                                             │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
tests/e2e/
├── DESIGN.md                            # This file
├── README.md                            # User documentation
├── docker-compose.yml                   # Service orchestration
├── run-tests.sh                         # Main test runner script
├── setup/
│   ├── create-virtual-ports.sh          # Create socat port pairs
│   └── cleanup.sh                       # Cleanup all resources
├── fixtures/
│   ├── emulators/
│   │   ├── port1-single-device.json     # Single device emulator config
│   │   └── port2-multi-device.json      # Multi-device emulator config
│   ├── bridge-config.json               # mqtt-bridge configuration
│   └── mosquitto.conf                   # MQTT broker config
├── tests/
│   ├── helpers.bash                     # Shared BATS helpers
│   ├── 01-environment.bats              # Test environment setup
│   ├── 02-emulator.bats                 # Test emulator functionality
│   └── 99-cleanup.bats                  # Cleanup tests
└── vendor/
    └── bats-core/                       # BATS testing framework (git submodule)
```

## Current Implementation

The infrastructure currently provides:

- Environment validation tests (01-environment.bats)
- Emulator functionality tests (02-emulator.bats)
- Cleanup verification tests (99-cleanup.bats)

The infrastructure supports additional test scenarios including MQTT bridge integration, CLI command testing, and device profiler functionality.

## Test Scenario Examples

These examples illustrate how the infrastructure can be used for integration testing.

### Scenario 1: MQTT Bridge with Single Device

**Setup:**

- Virtual serial port pair: `/tmp/ttyV0` ↔ `/tmp/ttyV1`
- Emulator on `/tmp/ttyV0`: ex9em device (slave ID 1)
- mqtt-bridge connects to `/tmp/ttyV1`

**Tests:**

1. Bridge starts successfully
2. Bridge connects to MQTT broker
3. Bridge discovers device on serial port
4. Bridge publishes data to `modbus/ex9em-1/data`
5. Data values match emulator configuration
6. Status messages published correctly

### Scenario 2: MQTT Bridge with Multiple Devices

**Setup:**

- Virtual serial port pair: `/tmp/ttyV2` ↔ `/tmp/ttyV3`
- Emulator on `/tmp/ttyV2`:
  - xymd1 device (slave ID 1)
  - or-we-516 device (slave ID 2)
- mqtt-bridge connects to `/tmp/ttyV3`

**Tests:**

1. Bridge correctly polls multiple devices
2. Device data published to separate topics
3. No bus collisions or mutex issues
4. Both devices respond within timeout

### Scenario 3: CLI Read/Write Commands

**Setup:**

- Use emulator from Scenario 1

**Tests:**

1. `ya-modbus read` reads correct values
2. `ya-modbus write` updates registers
3. `ya-modbus list-devices` shows available drivers
4. Error handling for invalid commands
5. Help text displays correctly

### Scenario 4: Device Discovery

**Setup:**

- Emulator with known device on serial port

**Tests:**

1. `ya-modbus discover` finds device
2. Correct slave ID identified
3. Correct baud rate detected
4. Device type identified (if possible)

## BATS Test Structure

### Test File Example: `tests/02-mqtt-bridge.bats`

```bash
#!/usr/bin/env bats

load helpers

setup_file() {
  # Run once before all tests in this file
  ensure_services_running
  create_virtual_port_pair "test1" "/tmp/ttyV0" "/tmp/ttyV1"
  start_emulator "ex9em" "/tmp/ttyV0" "1"

  # Wait for emulator to be ready
  wait_for_port "/tmp/ttyV0" 30
}

teardown_file() {
  # Run once after all tests in this file
  cleanup_virtual_ports
  stop_emulator "ex9em"
}

setup() {
  # Run before each test
  MQTT_MESSAGES_FILE="$(mktemp)"

  # Subscribe to MQTT topics
  mosquitto_sub -h localhost -t 'modbus/#' -v > "$MQTT_MESSAGES_FILE" &
  MQTT_SUB_PID=$!
  sleep 1
}

teardown() {
  # Run after each test
  kill "$MQTT_SUB_PID" 2>/dev/null || true
  rm -f "$MQTT_MESSAGES_FILE"
}

@test "mqtt-bridge starts successfully" {
  run timeout 10 ya-modbus-bridge run \
    --mqtt-url "mqtt://localhost:1883" \
    --config tests/e2e/fixtures/bridge-config.json

  [ "$status" -eq 0 ] || [ "$status" -eq 124 ]  # 0=success, 124=timeout
}

@test "mqtt-bridge publishes device data to MQTT" {
  # Start bridge in background
  ya-modbus-bridge run \
    --mqtt-url "mqtt://localhost:1883" \
    --config tests/e2e/fixtures/bridge-config.json &
  BRIDGE_PID=$!

  # Wait for data to be published
  sleep 5

  # Check MQTT messages
  run grep "modbus/ex9em-1/data" "$MQTT_MESSAGES_FILE"
  [ "$status" -eq 0 ]

  # Verify data contains expected values
  run grep '"voltage_l1":230' "$MQTT_MESSAGES_FILE"
  [ "$status" -eq 0 ]

  # Cleanup
  kill "$BRIDGE_PID"
}

@test "mqtt-bridge handles device disconnection gracefully" {
  # Start bridge
  ya-modbus-bridge run \
    --mqtt-url "mqtt://localhost:1883" \
    --config tests/e2e/fixtures/bridge-config.json &
  BRIDGE_PID=$!

  sleep 2

  # Stop emulator to simulate disconnection
  stop_emulator "ex9em"

  # Wait and check for error messages
  sleep 3
  run grep "modbus/ex9em-1/errors" "$MQTT_MESSAGES_FILE"
  [ "$status" -eq 0 ]

  # Cleanup
  kill "$BRIDGE_PID"
  start_emulator "ex9em" "/tmp/ttyV0" "1"
}
```

### Helper Functions: `tests/helpers.bash`

```bash
#!/usr/bin/env bash

# Wait for a port to be created
wait_for_port() {
  local port=$1
  local timeout=${2:-30}
  local elapsed=0

  while [ $elapsed -lt $timeout ]; do
    if [ -L "$port" ]; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  return 1
}

# Create virtual serial port pair
create_virtual_port_pair() {
  local name=$1
  local port1=$2
  local port2=$3

  socat -d -d \
    pty,rawer,echo=0,link="$port1",perm=0666 \
    pty,rawer,echo=0,link="$port2",perm=0666 \
    > "/tmp/socat-$name.log" 2>&1 &

  echo $! > "/tmp/socat-$name.pid"

  wait_for_port "$port1" 10
  wait_for_port "$port2" 10
}

# Cleanup virtual ports
cleanup_virtual_ports() {
  for pidfile in /tmp/socat-*.pid; do
    [ -f "$pidfile" ] || continue
    pid=$(cat "$pidfile")
    kill "$pid" 2>/dev/null || true
    rm -f "$pidfile"
  done

  rm -f /tmp/ttyV*
}

# Start emulator container
start_emulator() {
  local driver=$1
  local port=$2
  local slave_id=$3

  # Implementation depends on how emulator is packaged
  # Could be Docker container or Node.js script
}

# Stop emulator
stop_emulator() {
  local driver=$1
  # Implementation
}

# Ensure services are running
ensure_services_running() {
  # Check if MQTT broker is running
  if ! nc -z localhost 1883; then
    echo "MQTT broker not running"
    return 1
  fi
}

# BATS assertion helpers (load from bats-support/bats-assert if available)
assert_success() {
  if [ "$status" -ne 0 ]; then
    echo "Expected success but got status $status"
    echo "Output: $output"
    return 1
  fi
}

assert_output_contains() {
  local expected=$1
  if [[ ! "$output" =~ $expected ]]; then
    echo "Expected output to contain: $expected"
    echo "Actual output: $output"
    return 1
  fi
}
```

## Docker Compose Setup

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  mqtt:
    image: eclipse-mosquitto:2
    ports:
      - '1883:1883'
    volumes:
      - ./fixtures/mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
    healthcheck:
      test: ['CMD', 'mosquitto_sub', '-t', '$$SYS/#', '-C', '1', '-i', 'healthcheck', '-W', '3']
      interval: 5s
      timeout: 3s
      retries: 3

  # Note: Emulators run on host because they need access to virtual serial ports
  # Virtual serial ports are created by setup scripts on the host
```

**Note:** The emulators need to run on the host (not in Docker) because they need access to the virtual serial ports created by socat on the host. Docker containers don't have direct access to host's `/tmp/ttyV*` devices without complex configuration.

Alternative: Run emulators in Docker with device mapping, but this requires privileged mode and is more complex.

## GitHub Actions Workflow

### `.github/workflows/e2e-tests.yml`

```yaml
name: E2E Integration Tests

on:
  schedule:
    # Run at 2:30 AM UTC daily (avoid top of hour)
    - cron: '30 2 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  check-changes:
    runs-on: ubuntu-latest
    outputs:
      has_changes: ${{ steps.check.outputs.has_changes }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check for changes since last run
        id: check
        run: |
          # Get last commit timestamp
          last_commit=$(git log -1 --format=%ct)
          current=$(date +%s)
          hours_ago=$(( (current - last_commit) / 3600 ))

          # Run if changes in last 24 hours or manual trigger
          if [ $hours_ago -lt 24 ] || [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "has_changes=true" >> $GITHUB_OUTPUT
            echo "Changes detected or manual trigger - running tests"
          else
            echo "has_changes=false" >> $GITHUB_OUTPUT
            echo "No changes in last 24 hours - skipping tests"
          fi

  e2e-tests:
    needs: check-changes
    if: needs.check-changes.outputs.has_changes == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build packages
        run: npm run build

      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y socat bats mosquitto-clients

      - name: Start Docker services
        run: |
          cd tests/e2e
          docker-compose up -d

          # Wait for services to be healthy
          timeout 30 sh -c 'until docker-compose ps | grep -q healthy; do sleep 1; done'

      - name: Run E2E tests
        run: |
          cd tests/e2e
          ./run-tests.sh

      - name: Collect logs on failure
        if: failure()
        run: |
          mkdir -p logs
          docker-compose -f tests/e2e/docker-compose.yml logs > logs/docker.log
          cp /tmp/socat-*.log logs/ || true
          cp /tmp/emulator-*.log logs/ || true

      - name: Upload logs
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-test-logs
          path: logs/

      - name: Cleanup
        if: always()
        run: |
          cd tests/e2e
          ./setup/cleanup.sh
          docker-compose down -v
```

## Running Tests Locally

### Prerequisites

```bash
# Install BATS
brew install bats-core  # macOS
# or
sudo apt-get install bats  # Ubuntu/Debian

# Install socat
brew install socat  # macOS
# or
sudo apt-get install socat  # Ubuntu/Debian

# Install Docker & Docker Compose
# (Follow official Docker installation guide)
```

### Run Tests

```bash
# Run all E2E tests
cd tests/e2e
./run-tests.sh

# Run specific test file
bats tests/02-mqtt-bridge.bats

# Run with verbose output
bats -t tests/02-mqtt-bridge.bats

# Test locally before pushing
act -j e2e-tests  # Using nektos/act
```

### Cleanup

```bash
cd tests/e2e
./setup/cleanup.sh
```

## Test Environment Variables

```bash
# Optional environment variables
export MQTT_URL="mqtt://localhost:1883"
export TEST_TIMEOUT=30
export VERBOSE=1  # Enable verbose logging
export KEEP_LOGS=1  # Don't delete logs after test
```

## Performance Targets

| Metric           | Target             |
| ---------------- | ------------------ |
| Full test suite  | < 5 minutes        |
| Test setup time  | < 30 seconds       |
| Individual test  | < 1 minute         |
| CI run frequency | Daily (if changes) |

## Error Handling

### Test Failures

- All test failures should be clear and actionable
- Include relevant log snippets in failure messages
- Upload full logs as artifacts

### Cleanup Guarantees

- Always cleanup in `teardown` functions
- Use `trap` in shell scripts for cleanup
- Docker Compose `down -v` removes all containers and volumes
- Kill all socat processes
- Remove all temporary files

### Timeout Handling

- Set reasonable timeouts for all operations
- Use `timeout` command for long-running processes
- Fail fast on timeout, don't retry indefinitely

## References

- [BATS Documentation](https://bats-core.readthedocs.io/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [nektos/act](https://github.com/nektos/act)
- [GitHub Actions Scheduled Workflows](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
