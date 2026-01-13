#!/usr/bin/env tsx
import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-ex9em'
import { createRTUTransport } from '@ya-modbus/transport'

const port = process.argv[2] ?? '/dev/ttyUSB0'
const slaveId = parseInt(process.argv[3] ?? String(DEFAULT_CONFIG.defaultAddress), 10)

// Create transport with factory default settings
const transport = await createRTUTransport({
  port,
  baudRate: DEFAULT_CONFIG.baudRate,
  parity: DEFAULT_CONFIG.parity,
  dataBits: DEFAULT_CONFIG.dataBits,
  stopBits: DEFAULT_CONFIG.stopBits,
  slaveId,
  timeout: 1000,
})

try {
  // Create driver
  const driver = await createDriver({ transport })

  // Read single data point
  const voltage = await driver.readDataPoint('voltage')
  console.log(`Voltage: ${String(voltage)}V`)

  // Read multiple data points (single transaction)
  const values = await driver.readDataPoints([
    'voltage',
    'current',
    'active_power',
    'total_active_energy',
  ])
  console.log(values)

  // Change device address (requires device restart)
  await driver.writeDataPoint('device_address', 5)
  console.log('Device address changed to 5')

  // Change baud rate (requires device restart)
  await driver.writeDataPoint('baud_rate', 4800)
  console.log('Baud rate changed to 4800')
} finally {
  await transport.close()
}
