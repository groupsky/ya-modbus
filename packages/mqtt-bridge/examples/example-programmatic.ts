#!/usr/bin/env tsx
import { createBridge } from '@ya-modbus/mqtt-bridge'

const bridge = createBridge({
  mqtt: {
    url: 'mqtt://localhost:1883',
    clientId: 'modbus-bridge',
  },
  topicPrefix: 'modbus',
})

await bridge.start()

// Publish to topic
await bridge.publish('device1/data', JSON.stringify({ temp: 25.5 }))

// Subscribe to topic
await bridge.subscribe('device1/cmd', (message) => {
  console.log('Received:', message.payload.toString())
})

// Add device
await bridge.addDevice({
  deviceId: 'device1',
  driver: 'ya-modbus-driver-example',
  connection: {
    type: 'tcp',
    host: '192.168.1.100',
    port: 502,
    slaveId: 1,
  },
})

// List devices
const devices = bridge.listDevices()
console.log('Devices:', devices)

// Stop bridge
await bridge.stop()
