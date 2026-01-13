#!/usr/bin/env tsx
/**
 * Example: Reading sensor data via RTU transport
 *
 * Usage:
 *   npx tsx example-rtu.ts [port]
 *
 * Arguments:
 *   port  Serial port path (default: /dev/ttyUSB0)
 */

import { createRTUTransport } from '@ya-modbus/transport'

import { createDriver } from '@ya-modbus/driver-xymd1'

const port = process.argv[2] ?? '/dev/ttyUSB0'

const transport = await createRTUTransport({
  port,
  baudRate: 9600,
  parity: 'even',
  dataBits: 8,
  stopBits: 1,
  slaveId: 1,
  timeout: 1000,
})

try {
  const driver = await createDriver({ transport, slaveId: 1 })

  // Read temperature and humidity
  const values = await driver.readDataPoints(['temperature', 'humidity'])
  console.log(values)
  // { temperature: 24.5, humidity: 65.2 }

  // Read device configuration
  const address = await driver.readDataPoint('device_address')
  const baudRate = await driver.readDataPoint('baud_rate')
  console.log(`Device: address=${String(address)}, baudRate=${String(baudRate)}`)
} finally {
  await transport.close()
}
