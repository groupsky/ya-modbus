#!/usr/bin/env node

/**
 * CommonJS Consumer Test
 *
 * Verifies that ya-modbus packages can be consumed in CommonJS projects
 * without requiring .default workarounds.
 */

async function main() {
  console.log('Testing CommonJS imports...\n')

  // Test named exports from driver-sdk (actual runtime functions)
  const { readScaledUInt16BE, createEnumValidator } = require('@ya-modbus/driver-sdk')

  if (typeof readScaledUInt16BE !== 'function') {
    console.error('❌ Failed: readScaledUInt16BE is not a function')
    process.exit(1)
  }
  console.log('✓ Named exports from @ya-modbus/driver-sdk work')

  // Test named exports from transport
  const { createTransport, createRTUTransport } = require('@ya-modbus/transport')

  if (typeof createTransport !== 'function') {
    console.error('❌ Failed: createTransport is not a function')
    process.exit(1)
  }
  console.log('✓ Named exports from @ya-modbus/transport work')

  // Test driver package exports (NO .default workaround)
  const xymd1 = require('@ya-modbus/driver-xymd1')

  if (!xymd1 || typeof xymd1 !== 'object') {
    console.error('❌ Failed: driver-xymd1 exports not working')
    process.exit(1)
  }

  if (typeof xymd1.createDriver !== 'function') {
    console.error('❌ Failed: driver-xymd1.createDriver is not a function')
    process.exit(1)
  }

  if (!xymd1.DEFAULT_CONFIG) {
    console.error('❌ Failed: driver-xymd1.DEFAULT_CONFIG not found')
    process.exit(1)
  }

  console.log('✓ Driver package exports work (no .default needed)')

  // Verify driver can be created
  const driver = await xymd1.createDriver({
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
  console.log('  driver-xymd1.createDriver:', typeof xymd1.createDriver)
  console.log('  driver-xymd1.DEFAULT_CONFIG:', typeof xymd1.DEFAULT_CONFIG)
  console.log('  Created driver.readDataPoint:', typeof driver.readDataPoint)
  console.log('  Created driver.name:', driver.name)

  console.log('\n✅ All CommonJS imports successful!')
  console.log('✅ No .default workaround required!')
}

main().catch((error) => {
  console.error('❌ Test failed:', error.message)
  process.exit(1)
})
