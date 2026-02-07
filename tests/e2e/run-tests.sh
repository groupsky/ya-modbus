#!/usr/bin/env bash
#
# Main test runner for E2E tests
#
# Usage: ./run-tests.sh [OPTIONS] [test-pattern]
#
# Options:
#   --timing, -t        Show timing information for each test
#   --verbose, -v       Verbose output (show all test output)
#   --tap              Use TAP format output
#   --help, -h         Show this help message
#
# Examples:
#   ./run-tests.sh                    # Run all tests
#   ./run-tests.sh --timing           # Run all tests with timing
#   ./run-tests.sh -t -v 02-emulator  # Run emulator tests with timing and verbose output
#   ./run-tests.sh --tap              # Run all tests in TAP format
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BATS_BIN="$SCRIPT_DIR/vendor/bats-core/bin/bats"

# Parse flags
BATS_FLAGS=()
TEST_PATTERN=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --timing|-t)
      BATS_FLAGS+=(--timing)
      shift
      ;;
    --verbose|-v)
      BATS_FLAGS+=(--show-output-of-passing-tests)
      shift
      ;;
    --tap)
      BATS_FLAGS+=(--tap)
      shift
      ;;
    --help|-h)
      sed -n '2,/^$/p' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    -*)
      echo "Unknown option: $1" >&2
      echo "Use --help for usage information" >&2
      exit 1
      ;;
    *)
      TEST_PATTERN="$1"
      shift
      ;;
  esac
done

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

  # Check for bats - either from submodule or system installation
  if [ ! -x "$BATS_BIN" ]; then
    log_warn "bats submodule not found, initializing..."
    if ! git submodule update --init --recursive "$SCRIPT_DIR/vendor/bats-core" &> /dev/null; then
      log_error "Failed to initialize bats submodule"
      missing=1
    fi
  fi

  if ! command -v docker &> /dev/null; then
    log_error "docker is not installed"
    missing=1
  elif ! docker compose version &> /dev/null; then
    log_error "docker compose is not available"
    missing=1
  fi

  if ! command -v node &> /dev/null; then
    log_error "node is not installed"
    missing=1
  fi

  if [ $missing -eq 1 ]; then
    log_error "Missing dependencies. Please install them first."
    log_info "  socat: brew install socat (macOS) or apt-get install socat (Linux)"
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
  docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d

  # Wait for MQTT broker to be healthy
  log_info "Waiting for MQTT broker to be ready..."
  local timeout=300
  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps | grep -q "healthy"; then
      log_info "MQTT broker is ready"
      break
    fi
    sleep 0.1
    elapsed=$((elapsed + 1))
  done

  if [ $elapsed -ge $timeout ]; then
    log_error "Timeout waiting for MQTT broker"
    docker compose -f "$SCRIPT_DIR/docker-compose.yml" logs
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
  docker compose -f "$SCRIPT_DIR/docker-compose.yml" down -v

  log_info "Cleanup complete"
}

# Run tests
run_tests() {
  log_step "Running E2E tests..."

  # Build BATS command with flags
  local bats_cmd=("$BATS_BIN" "${BATS_FLAGS[@]}")

  if [ -n "$TEST_PATTERN" ]; then
    log_info "Running tests matching pattern: $TEST_PATTERN"
    if [ ${#BATS_FLAGS[@]} -gt 0 ]; then
      log_info "BATS flags: ${BATS_FLAGS[*]}"
    fi
    "${bats_cmd[@]}" "$SCRIPT_DIR/tests/"*"$TEST_PATTERN"*.bats
  else
    log_info "Running all tests..."
    if [ ${#BATS_FLAGS[@]} -gt 0 ]; then
      log_info "BATS flags: ${BATS_FLAGS[*]}"
    fi
    "${bats_cmd[@]}" "$SCRIPT_DIR/tests/"*.bats
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
  run_tests
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
