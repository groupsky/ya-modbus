#!/usr/bin/env bash
#
# Create virtual serial port pairs using socat
#
# Usage: ./create-virtual-ports.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="/tmp/ya-modbus-test-pids"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Check if socat is installed
if ! command -v socat &> /dev/null; then
  log_error "socat is not installed. Please install it first."
  log_info "  macOS: brew install socat"
  log_info "  Ubuntu/Debian: sudo apt-get install socat"
  exit 1
fi

# Create PID directory
mkdir -p "$PID_DIR"

# Create virtual port pair
# Args: name, port1, port2
create_port_pair() {
  local name=$1
  local port1=$2
  local port2=$3
  local pid_file="$PID_DIR/socat-$name.pid"
  local log_file="/tmp/socat-$name.log"

  # Check if ports already exist
  if [ -L "$port1" ] || [ -L "$port2" ]; then
    log_warn "Ports $port1 or $port2 already exist, skipping creation"
    return 0
  fi

  log_info "Creating virtual port pair: $port1 <-> $port2"

  # Start socat in background
  socat -d -d \
    pty,rawer,echo=0,link="$port1",perm=0666 \
    pty,rawer,echo=0,link="$port2",perm=0666 \
    > "$log_file" 2>&1 &

  local pid=$!
  echo "$pid" > "$pid_file"

  # Wait for ports to be created
  local timeout=100
  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if [ -L "$port1" ] && [ -L "$port2" ]; then
      log_info "Port pair created successfully (PID: $pid)"
      return 0
    fi
    sleep 0.1
    elapsed=$((elapsed + 1))
  done

  log_error "Timeout waiting for ports to be created"
  kill "$pid" 2>/dev/null || true
  rm -f "$pid_file"
  return 1
}

# Main execution
main() {
  log_info "Creating virtual serial port pairs for E2E tests..."

  # Port pair 1: For single device test (ex9em)
  create_port_pair "port1" "/tmp/ttyV0" "/tmp/ttyV1"

  # Port pair 2: For multiple devices test (xymd1 + or-we-516)
  create_port_pair "port2" "/tmp/ttyV2" "/tmp/ttyV3"

  log_info "All virtual port pairs created successfully"
  log_info "Port pairs:"
  log_info "  Port 1: /tmp/ttyV0 <-> /tmp/ttyV1 (single device)"
  log_info "  Port 2: /tmp/ttyV2 <-> /tmp/ttyV3 (multiple devices)"
  log_info ""
  log_info "PID files stored in: $PID_DIR"
  log_info "Log files stored in: /tmp/socat-*.log"
}

main "$@"
