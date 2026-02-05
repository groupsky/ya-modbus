#!/usr/bin/env bats
#
# Environment and setup tests
# These tests verify that the test environment is properly configured
#

load helpers

@test "socat is installed" {
  run which socat
  assert_success
}

@test "docker-compose is installed" {
  run docker-compose --version
  assert_success
}

@test "node is installed and correct version" {
  run node --version
  assert_success

  # Check Node.js version is 20, 22, or 24
  [[ "$output" =~ v(20|22|24) ]]
}

@test "mosquitto_sub client is available" {
  run which mosquitto_sub
  assert_success
}

@test "MQTT broker is running" {
  run docker-compose -f tests/e2e/docker-compose.yml ps mqtt
  assert_success
  assert_output_contains "ya-modbus-test-mqtt"
}

@test "MQTT broker is healthy" {
  run is_docker_service_healthy mqtt
  assert_success
}

@test "MQTT broker is listening on port 1883" {
  run wait_for_port localhost 1883 10
  assert_success
}

@test "can connect to MQTT broker" {
  run timeout 5 mosquitto_sub -h localhost -p 1883 -t "test/topic" -C 1 &
  local sub_pid=$!

  sleep 1

  run mosquitto_pub -h localhost -p 1883 -t "test/topic" -m "test message"
  assert_success

  wait "$sub_pid" || true
}

@test "virtual serial port pair 1 exists" {
  [ -L "/tmp/ttyV0" ]
  [ -L "/tmp/ttyV1" ]
}

@test "virtual serial port pair 2 exists" {
  [ -L "/tmp/ttyV2" ]
  [ -L "/tmp/ttyV3" ]
}

@test "virtual serial ports are connected" {
  # Write to one port, read from the other
  echo "test" > /tmp/ttyV0 &
  sleep 0.5

  run timeout 2 cat /tmp/ttyV1
  assert_output_contains "test"
}

@test "project packages are built" {
  local project_root
  project_root=$(get_project_root)

  [ -d "$project_root/packages/emulator/dist" ]
  [ -d "$project_root/packages/mqtt-bridge/dist" ]
  [ -d "$project_root/packages/cli/dist" ]
}

@test "emulator can be imported" {
  run node -e "import('@ya-modbus/emulator').then(() => console.log('ok'))"
  assert_success
  assert_output_contains "ok"
}
