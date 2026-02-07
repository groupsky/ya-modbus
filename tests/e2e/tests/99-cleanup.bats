#!/usr/bin/env bats
#
# Cleanup verification tests
# These tests run last to verify cleanup works properly
#

load helpers

@test "cleanup script exists and is executable" {
  [ -x "setup/cleanup.sh" ]
}

@test "cleanup script runs without errors" {
  run setup/cleanup.sh
  assert_success
}

@test "cleanup removes temporary files" {
  # Create some test files
  touch /tmp/mqtt-messages-test.txt
  touch /tmp/emulator-test.log

  # Run cleanup
  run setup/cleanup.sh
  assert_success

  # Verify files are removed
  [ ! -f /tmp/mqtt-messages-test.txt ]
  [ ! -f /tmp/emulator-test.log ]
}
