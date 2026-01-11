#!/usr/bin/env node

/**
 * ES Module Consumer Test
 *
 * Verifies that ya-modbus packages can be consumed in ESM projects
 * with native import statements.
 */

import { readScaledUInt16BE, createEnumValidator } from '@ya-modbus/driver-sdk'
import { createTransport, createRTUTransport } from '@ya-modbus/transport'
import { createDriver as createXYMD1Driver, DEFAULT_CONFIG } from '@ya-modbus/driver-xymd1'

async function main() {
  console.log('Testing ES Module imports...\n')

  // Test named exports from driver-sdk (actual runtime functions)
  if (typeof readScaledUInt16BE !== 'function') {
    console.error('❌ Failed: readScaledUInt16BE is not a function')
    process.exit(1)
  }
  console.log('✓ Named exports from @ya-modbus/driver-sdk work')

  // Test named exports from transport
  if (typeof createTransport !== 'function') {
    console.error('❌ Failed: createTransport is not a function')
    process.exit(1)
  }
  console.log('✓ Named exports from @ya-modbus/transport work')

  // Test driver package exports
  if (typeof createXYMD1Driver !== 'function') {
    console.error('❌ Failed: createDriver is not a function')
    process.exit(1)
  }

  if (!DEFAULT_CONFIG) {
    console.error('❌ Failed: DEFAULT_CONFIG not found')
    process.exit(1)
  }

  console.log('✓ Driver package exports work')

  // Verify driver can be created
  const driver = await createXYMD1Driver({
    transport: {
      type: 'tcp',
      host: 'localhost',
      port: 502,
      timeout: 1000,
    },
  })

  if (!driver || typeof driver.readDataPoint !== 'function') {
    console.error('❌ Failed: driver.readDataPoint is not a function')
    process.exit(1)
  }
  console.log('✓ Driver factory function works correctly')

  // Test function values
  console.log('\nExported values:')
  console.log('  createTransport:', typeof createTransport)
  console.log('  createRTUTransport:', typeof createRTUTransport)
  console.log('  readScaledUInt16BE:', typeof readScaledUInt16BE)
  console.log('  createXYMD1Driver:', typeof createXYMD1Driver)
  console.log('  DEFAULT_CONFIG:', typeof DEFAULT_CONFIG)
  console.log('  Created driver.readDataPoint:', typeof driver.readDataPoint)
  console.log('  Created driver.name:', driver.name)

  console.log('\n✅ All ES Module imports successful!')
}

main().catch((error) => {
  console.error('❌ Test failed:', error.message)
  process.exit(1)
})
