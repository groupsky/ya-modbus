#!/usr/bin/env bash
#
# Main test runner for E2E tests
#
# Usage: ./run-tests.sh [test-pattern]
#
# Examples:
#   ./run-tests.sh                    # Run all tests
#   ./run-tests.sh 02-mqtt-bridge     # Run specific test file
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}[INFO]${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*"
}

log_step() {
  echo -e "${BLUE}[STEP]${NC} $*"
}

# Check dependencies
check_dependencies() {
  local missing=0

  if ! command -v socat &> /dev/null; then
    log_error "socat is not installed"
    missing=1
  fi

  if ! command -v bats &> /dev/null; then
    log_error "bats is not installed"
    missing=1
  fi

  if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
    log_error "docker-compose is not installed"
    missing=1
  fi

  if ! command -v node &> /dev/null; then
    log_error "node is not installed"
    missing=1
  fi

  if [ $missing -eq 1 ]; then
    log_error "Missing dependencies. Please install them first."
    log_info "  socat: brew install socat (macOS) or apt-get install socat (Linux)"
    log_info "  bats: brew install bats-core (macOS) or apt-get install bats (Linux)"
    log_info "  docker: Follow official Docker installation guide"
    log_info "  node: Use nvm or official installer"
    exit 1
  fi

  log_info "All dependencies are installed"
}

# Setup test environment
setup() {
  log_step "Setting up test environment..."

  # Start Docker services
  log_info "Starting MQTT broker..."
  docker-compose -f "$SCRIPT_DIR/docker-compose.yml" up -d

  # Wait for MQTT broker to be healthy
  log_info "Waiting for MQTT broker to be ready..."
  local timeout=30
  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if docker-compose -f "$SCRIPT_DIR/docker-compose.yml" ps | grep -q "healthy"; then
      log_info "MQTT broker is ready"
      break
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  if [ $elapsed -ge $timeout ]; then
    log_error "Timeout waiting for MQTT broker"
    docker-compose -f "$SCRIPT_DIR/docker-compose.yml" logs
    return 1
  fi

  # Create virtual serial ports
  log_info "Creating virtual serial ports..."
  "$SCRIPT_DIR/setup/create-virtual-ports.sh"

  log_info "Test environment ready"
}

# Cleanup test environment
cleanup() {
  log_step "Cleaning up test environment..."

  # Cleanup resources
  "$SCRIPT_DIR/setup/cleanup.sh"

  # Stop Docker services
  log_info "Stopping Docker services..."
  docker-compose -f "$SCRIPT_DIR/docker-compose.yml" down -v

  log_info "Cleanup complete"
}

# Run tests
run_tests() {
  local test_pattern=${1:-}

  log_step "Running E2E tests..."

  if [ -n "$test_pattern" ]; then
    log_info "Running tests matching pattern: $test_pattern"
    bats "$SCRIPT_DIR/tests/"*"$test_pattern"*.bats
  else
    log_info "Running all tests..."
    bats "$SCRIPT_DIR/tests/"*.bats
  fi
}

# Main execution
main() {
  log_info "Ya-Modbus E2E Test Runner"
  log_info "=========================="
  echo

  # Check dependencies
  check_dependencies
  echo

  # Trap cleanup on exit
  trap cleanup EXIT INT TERM

  # Setup environment
  setup
  echo

  # Run tests
  run_tests "$@"
  local exit_code=$?

  echo
  if [ $exit_code -eq 0 ]; then
    log_info "All tests passed! ✓"
  else
    log_error "Some tests failed! ✗"
  fi

  return $exit_code
}

main "$@"
