#!/usr/bin/env tsx
import { createDriver, DEFAULT_CONFIG } from '@ya-modbus/driver-or-we-516'
import { createRTUTransport } from '@ya-modbus/transport'

const port = process.argv[2] ?? '/dev/ttyUSB0'
const slaveId = parseInt(process.argv[3] ?? String(DEFAULT_CONFIG.defaultAddress), 10)

// Create transport with default configuration
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

  // Read voltages and frequency
  const values = await driver.readDataPoints([
    'voltage_l1',
    'voltage_l2',
    'voltage_l3',
    'frequency',
  ])
  console.log(values)

  // Read total active energy
  const energy = await driver.readDataPoint('active_energy_total')
  console.log(`Total energy: ${String(energy)} kWh`)

  // Read all power values
  const power = await driver.readDataPoints([
    'active_power_total',
    'reactive_power_total',
    'apparent_power_total',
    'power_factor_total',
  ])
  console.log(power)

  // Change device address from 1 to 5
  await driver.writeDataPoint('device_address', 5)
  console.log('Device address changed to 5')

  // Set baud rate to 4800
  await driver.writeDataPoint('baud_rate', 4800)
  console.log('Baud rate changed to 4800')

  // Set S0 output rate (impulses per kWh)
  await driver.writeDataPoint('s0_output_rate', 1000.0)
  console.log('S0 output rate set to 1000')

  // Set combined code for bidirectional energy calculation
  await driver.writeDataPoint('combined_code', 5)
  console.log('Combined code set to 5')
} finally {
  await transport.close()
}
