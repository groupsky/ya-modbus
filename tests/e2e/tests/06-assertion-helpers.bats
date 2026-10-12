#!/usr/bin/env bats
#
# Assertion helper tests
# These tests verify that the output assertion helpers fail when they should,
# so a passing test elsewhere is not a false positive
#

load helpers

@test "assert_output_not_contains passes when the pattern is absent" {
  output="Discovery complete"

  run assert_output_not_contains "Testing"
  assert_success
}

@test "assert_output_not_contains fails when the pattern is present" {
  output="Testing 10 parameter combinations"

  run assert_output_not_contains "Testing"
  assert_failure
  assert_output_contains "Expected output not to contain: Testing"
  assert_output_contains "Actual output: Testing 10 parameter combinations"
}

@test "assert_output_json passes when the expression is true" {
  output='[{"slaveId": 1, "baudRate": 9600}]'

  run assert_output_json 'type == "array" and length == 1 and .[0].baudRate == 9600'
  assert_success
}

@test "assert_output_json fails when the expression is false" {
  output='[{"slaveId": 1, "baudRate": 9600}]'

  run assert_output_json 'type == "array" and .[0].baudRate == 19200'
  assert_failure
  assert_output_contains "Expected output to be JSON matching: type == \"array\" and"
  assert_output_contains "Actual output: .*\"slaveId\": 1"
}

@test "assert_output_json fails when the output is not JSON" {
  output="Starting discovery... []"

  run assert_output_json 'type == "array"'
  assert_failure
  assert_output_contains "Expected output to be JSON matching: type == \"array\""
}

@test "assert_output_json fails when the expression does not evaluate to true" {
  output='[{"slaveId": 1}]'

  run assert_output_json '.[0].slaveId'
  assert_failure
  assert_output_contains "Expected output to be JSON matching: .\[0\].slaveId"
}

@test "assert_output_not_contains fails when the pattern is not a valid regex" {
  output="Found device"

  run assert_output_not_contains "Found device("
  assert_failure
  assert_output_contains "Invalid pattern: Found device\("
}
