#!/usr/bin/env bash

# Run all example projects to verify package compatibility
# This script is run in CI to ensure dual package support works correctly

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "================================"
echo "Running Package Compatibility Tests"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track failures
FAILED_EXAMPLES=()

run_example() {
  local example_dir=$1
  local example_name=$2

  echo -e "${BLUE}Testing: $example_name${NC}"
  echo "----------------------------"

  cd "$example_dir"

  # Install dependencies
  if ! npm install --silent > /dev/null 2>&1; then
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    FAILED_EXAMPLES+=("$example_name (install)")
    cd "$SCRIPT_DIR"
    return 1
  fi

  # Run test
  if npm test; then
    echo -e "${GREEN}✓ $example_name passed${NC}"
    echo ""
  else
    echo -e "${RED}✗ $example_name failed${NC}"
    FAILED_EXAMPLES+=("$example_name (test)")
    cd "$SCRIPT_DIR"
    return 1
  fi

  cd "$SCRIPT_DIR"
  return 0
}

# First, verify package coverage
echo -e "${BLUE}Running package coverage verification...${NC}"
echo ""
if ! node verify-coverage.js; then
  echo -e "${RED}✗ Package coverage verification failed${NC}"
  echo "================================"
  exit 1
fi
echo ""

# Run all examples
run_example "cjs-consumer" "CommonJS Consumer"
run_example "esm-consumer" "ESM Consumer"
run_example "typescript-esm-consumer" "TypeScript ESM Consumer"
run_example "typescript-cjs-consumer" "TypeScript CJS Consumer"

# Summary
echo "================================"
if [ ${#FAILED_EXAMPLES[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ All examples passed!${NC}"
  echo "================================"
  exit 0
else
  echo -e "${RED}✗ Some examples failed:${NC}"
  for failed in "${FAILED_EXAMPLES[@]}"; do
    echo -e "  ${RED}- $failed${NC}"
  done
  echo "================================"
  exit 1
fi
