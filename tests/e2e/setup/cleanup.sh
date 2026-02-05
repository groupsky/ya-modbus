#!/usr/bin/env bash
#
# Cleanup all E2E test resources
#
# Usage: ./cleanup.sh
#

set -euo pipefail

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

# Kill process from PID file
kill_from_pidfile() {
  local pid_file=$1

  if [ ! -f "$pid_file" ]; then
    return 0
  fi

  local pid=$(cat "$pid_file")

  if kill -0 "$pid" 2>/dev/null; then
    log_info "Killing process $pid"
    kill "$pid" 2>/dev/null || true
    sleep 0.5

    # Force kill if still running
    if kill -0 "$pid" 2>/dev/null; then
      log_warn "Process $pid didn't die gracefully, force killing"
      kill -9 "$pid" 2>/dev/null || true
    fi
  fi

  rm -f "$pid_file"
}

# Main execution
main() {
  log_info "Cleaning up E2E test resources..."

  # Kill socat processes
  if [ -d "$PID_DIR" ]; then
    log_info "Killing socat processes..."
    for pid_file in "$PID_DIR"/socat-*.pid; do
      [ -f "$pid_file" ] || continue
      kill_from_pidfile "$pid_file"
    done
    rmdir "$PID_DIR" 2>/dev/null || true
  fi

  # Kill emulator processes
  log_info "Killing emulator processes..."
  for pid_file in /tmp/emulator-*.pid; do
    [ -f "$pid_file" ] || continue
    kill_from_pidfile "$pid_file"
  done

  # Kill mqtt-bridge processes
  log_info "Killing mqtt-bridge processes..."
  pkill -f "ya-modbus-bridge" || true

  # Remove virtual port symlinks
  log_info "Removing virtual port symlinks..."
  rm -f /tmp/ttyV* 2>/dev/null || true

  # Remove log files
  log_info "Removing log files..."
  rm -f /tmp/socat-*.log 2>/dev/null || true
  rm -f /tmp/emulator-*.log 2>/dev/null || true
  rm -f /tmp/bridge-*.log 2>/dev/null || true

  # Remove temporary files
  rm -f /tmp/mqtt-messages-*.txt 2>/dev/null || true

  log_info "Cleanup completed successfully"
}

main "$@"
