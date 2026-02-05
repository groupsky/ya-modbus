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

- **BATS** - Bash testing framework

  ```bash
  # macOS
  brew install bats-core

  # Ubuntu/Debian
  sudo apt-get install bats
  ```

- **Docker & Docker Compose** - Service orchestration
  - Follow [official Docker installation guide](https://docs.docker.com/get-docker/)

- **Node.js** - For running emulators and tools
  - Version 20, 22, or 24 (see `.nvmrc`)

- **Mosquitto clients** - MQTT testing

  ```bash
  # macOS
  brew install mosquitto

  # Ubuntu/Debian
  sudo apt-get install mosquitto-clients
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
├── README.md                       # This file
├── DESIGN.md                       # Design documentation
├── run-tests.sh                    # Main test runner
├── docker-compose.yml              # MQTT broker service
├── setup/
│   ├── create-virtual-ports.sh     # Create socat port pairs
│   ├── start-emulator.js           # Start Modbus emulators
│   └── cleanup.sh                  # Cleanup all resources
├── fixtures/
│   ├── mosquitto.conf              # MQTT broker config
│   ├── bridge-config.json          # mqtt-bridge config
│   └── devices/                    # Device configurations
│       ├── ex9em-device1.json
│       ├── xymd1-device1.json
│       └── or-we-516-device2.json
└── tests/
    ├── helpers.bash                # Shared helper functions
    ├── 01-environment.bats         # Environment setup tests
    ├── 02-emulator.bats            # Emulator tests
    └── 99-cleanup.bats             # Cleanup verification
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

### Available Helper Functions

See `tests/helpers.bash` for all available helpers:

- `wait_for_file <file> [timeout]` - Wait for file to exist
- `wait_for_port <host> <port> [timeout]` - Wait for port to listen
- `start_mqtt_subscriber <topic> [output_file]` - Start MQTT subscriber
- `stop_mqtt_subscriber <pid>` - Stop MQTT subscriber
- `start_test_emulator <port> <device_configs...>` - Start emulator
- `stop_test_emulator <pid>` - Stop emulator
- `is_docker_service_healthy <service>` - Check Docker service health
- `assert_success` - Assert command succeeded
- `assert_failure` - Assert command failed
- `assert_output_contains <string>` - Assert output contains string
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
