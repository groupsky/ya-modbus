#!/usr/bin/env tsx
import { createDriver } from '@ya-modbus/driver-xymd1'
import { createRTUTransport } from '@ya-modbus/transport'

const port = process.argv[2] ?? '/dev/ttyUSB0'
const slaveId = parseInt(process.argv[3] ?? '1', 10)

// Create transport
const transport = await createRTUTransport({
  port,
  slaveId,
  baudRate: 9600,
  parity: 'even',
  dataBits: 8,
  stopBits: 1,
  timeout: 1000,
})

try {
  // Create driver
  const driver = await createDriver({ transport, slaveId })

  // Read temperature and humidity
  const values = await driver.readDataPoints(['temperature', 'humidity'])
  console.log(values) // { temperature: 24.5, humidity: 65.2 }

  // Read device configuration
  const address = await driver.readDataPoint('device_address')
  const baudRate = await driver.readDataPoint('baud_rate')
  console.log(`Device: address=${String(address)}, baudRate=${String(baudRate)}`)

  // Configure device address (takes effect after device restart)
  await driver.writeDataPoint('device_address', 2)
  // Configure baud rate (takes effect after device restart)
  await driver.writeDataPoint('baud_rate', 19200)
  console.log('Configuration updated (restart device to apply)')

  // Calibrate temperature sensor
  await driver.writeDataPoint('temperature_correction', -1.5)
  // Calibrate humidity sensor
  await driver.writeDataPoint('humidity_correction', 2.0)
  console.log('Calibration applied')
} finally {
  await transport.close()
}
