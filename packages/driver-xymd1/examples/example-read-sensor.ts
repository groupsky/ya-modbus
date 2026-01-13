/**
 * Example: Reading temperature and humidity from XYMD1 sensor
 *
 * This example demonstrates how to read sensor data from an XYMD1
 * temperature and humidity sensor using the driver API.
 */

import assert from 'node:assert'

import { createDriver } from '@ya-modbus/driver-xymd1'
import { withEmulator } from '@ya-modbus/emulator'

// Run example with emulator providing simulated sensor values
await withEmulator(
  {
    // Input registers 1 and 2 contain temperature×10 and humidity×10
    input: { 1: 245, 2: 652 },
  },
  async ({ transport }) => {
    // --- Snippet for README: Reading Sensor Data ---
    const driver = await createDriver({ transport, slaveId: 1 })

    const values = await driver.readDataPoints(['temperature', 'humidity'])

    assert.deepStrictEqual(values, { temperature: 24.5, humidity: 65.2 })
    // --- End snippet ---
  }
)
