# E2E Integration Tests

End-to-end integration tests for ya-modbus using real services and BATS testing framework.

## Prerequisites

### Required Tools

- **socat** - Virtual serial ports

  ```bash
  # macOS
  brew install socat

  # Ubuntu/Debian
  sudo apt-get install socat
  ```

- **BATS** - Bash testing framework (included as git submodule)
  - No system installation required
  - The test runner will automatically initialize the submodule if needed
  - Manual initialization: `git submodule update --init --recursive tests/e2e/vendor/bats-core`

- **Docker & Docker Compose** - Service orchestration
  - Follow [official Docker installation guide](https://docs.docker.com/get-docker/)

- **Node.js** - For running emulators and tools
  - Version 22.12+ or 24 (see `.nvmrc`)

- **Mosquitto clients** - MQTT testing

  ```bash
  # macOS
  brew install mosquitto

  # Ubuntu/Debian
  sudo apt-get install mosquitto-clients
  ```

- **netcat** - Port connectivity testing

  ```bash
  # macOS
  brew install netcat

  # Ubuntu/Debian
  sudo apt-get install netcat-openbsd
  ```

### Build Packages

Packages must be built before running tests:

```bash
npm run build
```

## Running Tests

### Quick Start

```bash
# Run all E2E tests
./tests/e2e/run-tests.sh

# Run specific test file
./tests/e2e/run-tests.sh 02-emulator

# Run tests with BATS directly
cd tests/e2e
bats tests/01-environment.bats
```

### Manual Setup

For development, you can set up the environment manually:

```bash
# Start MQTT broker
docker-compose -f tests/e2e/docker-compose.yml up -d

# Create virtual serial ports
./tests/e2e/setup/create-virtual-ports.sh

# Run tests
bats tests/e2e/tests/*.bats

# Cleanup
./tests/e2e/setup/cleanup.sh
docker-compose -f tests/e2e/docker-compose.yml down -v
```

## Test Structure

```
tests/e2e/
├── README.md                        # This file
├── DESIGN.md                        # Design documentation
├── run-tests.sh                     # Main test runner
├── docker-compose.yml               # MQTT broker service
├── setup/
│   ├── create-virtual-ports.sh      # Create socat port pairs
│   └── cleanup.sh                   # Cleanup all resources
├── fixtures/
│   ├── README.md                    # Register layouts of the fixtures
│   ├── emulators/
│   │   ├── port1-single-device.json     # Single device emulator config
│   │   ├── port1-single-device-alt.json # Single device with other register values
│   │   ├── port2-multi-device.json      # Multi-device emulator config
│   │   ├── tcp-single-device.json       # Single device emulator config (Modbus TCP)
│   │   └── tcp-slow-device.json         # Emulator on Modbus TCP that answers after 1500 ms
│   ├── mosquitto.conf               # MQTT broker config
│   ├── bridge-config.json           # mqtt-bridge config (single device)
│   └── bridge-config-multi-device.json # mqtt-bridge config (two devices)
├── tests/
│   ├── helpers.bash                 # Shared helper functions
│   ├── 01-environment.bats          # Environment setup tests
│   ├── 02-emulator.bats             # Emulator tests
│   ├── 03-mqtt-bridge.bats          # mqtt-bridge tests
│   ├── 04-cli.bats                  # CLI tests
│   ├── 05-device-profiler.bats      # Device profiler tests
│   ├── 06-assertion-helpers.bats    # Assertion helper tests
│   ├── 07-tcp.bats                  # Modbus TCP tests (CLI and device-profiler)
│   └── 99-cleanup.bats              # Cleanup verification
└── vendor/
    └── bats-core/                   # BATS framework (git submodule)
```

## Writing Tests

### Test File Template

```bash
#!/usr/bin/env bats

load helpers

setup() {
  # Run before each test
  EMULATOR_PID=""
  clean_test_artifacts
}

teardown() {
  # Run after each test
  if [ -n "$EMULATOR_PID" ]; then
    stop_test_emulator "$EMULATOR_PID"
  fi
  clean_test_artifacts
}

@test "description of what is being tested" {
  run command_to_test
  assert_success
  assert_output_contains "expected output"
}
```

### Comments for Hex Values

The emulator verbose log shows function codes, addresses and register values in hex, for example `func=0x03 addr=0x0000 count=11 values=[0x08FC, ...]`. Put a comment above each assertion, or above a group of assertions that check the same operation, so a reader does not need a calculator to see where the expected hex value comes from.

Add a comment when an assertion:

- checks a hex register value (`0x08FC`)
- refers to a register address or a function code (`addr=0x002B`, `func=0x10`)
- checks a scaled value (show the scaled value and the unit, and name the scaling factor when it is not obvious)

Format:

```bash
# {Description} ({decimal} decimal = 0x{HEX} hex [= {scaled value} {unit}])
assert_emulator_log_contains "$EMULATOR_PID" "0x{HEX}"
```

Rules:

- Write hex digits in upper case, with the width of the log: four digits for addresses and register values (`0x08FC`), two digits for function codes (`0x03`).
- Name the register when the comment explains a register value (`register 1: 520 = 0x0208`).
- Take the decimal values from [fixtures/README.md](fixtures/README.md), so the comment and the fixture agree.

Examples from `tests/04-cli.bats`:

```bash
# Verify voltage value is present (2300 decimal = 0x08FC hex = 230.0V when scaled /10)
assert_emulator_log_contains "$EMULATOR_PID" "0x08FC"

# Verify voltage (register 0: 2300 = 0x08FC = 230.0V) and current (register 1: 520 = 0x0208 = 52.0A)
assert_emulator_log_contains "$EMULATOR_PID" "0x08FC"
assert_emulator_log_contains "$EMULATOR_PID" "0x0208"

# Verify value written (5 decimal = 0x0005 hex)
assert_emulator_log_contains "$EMULATOR_PID" "0x0005"

# Verify WRITE operation logged (10 decimal = 0x000A hex)
assert_emulator_log_contains "$EMULATOR_PID" "\[VERBOSE\] WRITE"
assert_emulator_log_contains "$EMULATOR_PID" "addr=0x002B"
assert_emulator_log_contains "$EMULATOR_PID" "values=\[0x000A\]"
```

Reviewers do not need to convert values by hand, maintainers see what the test expects, and a wrong conversion is easy to find.

### Available Helper Functions

See `tests/helpers.bash` for all available helpers:

- `wait_for_file <file> [timeout]` - Wait for file to exist
- `wait_for_port <host> <port> [timeout]` - Wait for network port to listen
- `start_mqtt_subscriber <topic> [output_file]` - Start MQTT subscriber (returns PID)
- `stop_mqtt_subscriber <pid>` - Stop MQTT subscriber
- `start_test_emulator <config_file> [--verbose]` - Start emulator with config (returns PID), optionally with verbose logging
- `stop_test_emulator <pid>` - Stop emulator
- `start_tcp_emulator <config_file> [port]` - Start emulator with a Modbus TCP config (returns PID, stop with `stop_test_emulator`). Listens on `$TCP_EMULATOR_PORT` (15502) unless a port is given
- `assert_emulator_log_contains <pid> <pattern>` - Assert the emulator log contains pattern (extended regex, escape special characters such as `[` and `]`)
- `is_docker_service_healthy <service>` - Check Docker service health
- `assert_success` - Assert command succeeded
- `assert_failure` - Assert command failed
- `assert_output_contains <pattern>` - Assert output contains pattern (extended regex, escape special characters such as `(`, `)`, `[`, `]` and `.`)
- `assert_output_not_contains <pattern>` - Assert output does not contain pattern
- `assert_output_json <jq_filter>` - Assert output is JSON and the jq expression evaluates to true
- `assert_file_contains <file> <string>` - Assert file contains string
- `get_project_root` - Get project root directory
- `clean_test_artifacts` - Clean temporary files

## Debugging Tests

### View BATS Output

```bash
# Verbose output
bats -t tests/e2e/tests/01-environment.bats

# Show all output (including from commands)
bats --tap tests/e2e/tests/01-environment.bats
```

### Check Service Logs

```bash
# MQTT broker logs
docker-compose -f tests/e2e/docker-compose.yml logs mqtt

# Emulator logs
cat /tmp/emulator-*.log

# Socat logs
cat /tmp/socat-*.log
```

### Verify Environment

```bash
# Check virtual ports
ls -la /tmp/ttyV*

# Check MQTT broker
docker-compose -f tests/e2e/docker-compose.yml ps

# Check processes
ps aux | grep socat
ps aux | grep node
```

### Manual Testing

```bash
# Test MQTT connection
mosquitto_sub -h localhost -t 'test/#' -v

# In another terminal
mosquitto_pub -h localhost -t 'test/topic' -m 'hello'

# Test serial ports
echo "test" > /tmp/ttyV0 &
cat /tmp/ttyV1
```

## CI/CD

Tests run in GitHub Actions on a schedule (daily if there are changes).

See `.github/workflows/e2e-tests.yml` for the complete workflow.

### Running Locally with act

Test the GitHub Actions workflow locally:

```bash
# Install act
brew install act  # macOS
# or download from https://github.com/nektos/act

# Run workflow
act workflow_dispatch

# Run specific job
act -j e2e-tests
```

## Troubleshooting

### "socat: command not found"

Install socat:

```bash
brew install socat  # macOS
sudo apt-get install socat  # Linux
```

### "bats: command not found"

Install BATS:

```bash
brew install bats-core  # macOS
sudo apt-get install bats  # Linux
```

### "Timeout waiting for MQTT broker"

Check Docker:

```bash
docker-compose -f tests/e2e/docker-compose.yml ps
docker-compose -f tests/e2e/docker-compose.yml logs mqtt
```

### "Virtual ports not found"

Check socat is running:

```bash
ps aux | grep socat
ls -la /tmp/ttyV*
```

### "Emulator failed to start"

Check logs:

```bash
cat /tmp/emulator-*.log
```

Verify packages are built:

```bash
ls packages/emulator/dist
```

### Permission Denied on Serial Ports

Virtual ports should have 0666 permissions. Check:

```bash
ls -la /tmp/ttyV*
```

## Performance

Target times:

- Environment setup: < 30 seconds
- Individual test: < 1 minute
- Full test suite: < 5 minutes

## Contributing

When adding new tests:

1. Follow existing test file naming (##-description.bats)
2. Use helpers from `helpers.bash`
3. Include setup/teardown for resource cleanup
4. Add descriptive test names
5. Test both success and failure cases
6. Update this README if adding new features

## References

- [BATS Documentation](https://bats-core.readthedocs.io/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [socat Manual](http://www.dest-unreach.org/socat/doc/socat.html)
- [Mosquitto Documentation](https://mosquitto.org/man/mosquitto-8.html)
