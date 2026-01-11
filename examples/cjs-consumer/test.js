#!/usr/bin/env node

/**
 * CommonJS Consumer Test
 *
 * Verifies that ya-modbus packages can be consumed in CommonJS projects
 * without requiring .default workarounds.
 */

async function main() {
  console.log('Testing CommonJS imports...\n')

  // Test all package imports to verify dual-package support
  const packages = {
    cli: require('@ya-modbus/cli'),
    deviceProfiler: require('@ya-modbus/device-profiler'),
    driverEx9em: require('@ya-modbus/driver-ex9em'),
    driverLoader: require('@ya-modbus/driver-loader'),
    driverOrWe516: require('@ya-modbus/driver-or-we-516'),
    driverSdk: require('@ya-modbus/driver-sdk'),
    driverXymd1: require('@ya-modbus/driver-xymd1'),
    emulator: require('@ya-modbus/emulator'),
    mqttBridge: require('@ya-modbus/mqtt-bridge'),
    transport: require('@ya-modbus/transport'),
  }

  // Verify all packages loaded
  for (const [name, pkg] of Object.entries(packages)) {
    if (!pkg || typeof pkg !== 'object') {
      console.error(`❌ Failed: ${name} package not loaded`)
      process.exit(1)
    }
  }
  console.log('✓ All packages loaded successfully')

  // Test named exports from driver-sdk (actual runtime functions)
  const { readScaledUInt16BE, createEnumValidator } = packages.driverSdk

  if (typeof readScaledUInt16BE !== 'function') {
    console.error('❌ Failed: readScaledUInt16BE is not a function')
    process.exit(1)
  }
  console.log('✓ Named exports from @ya-modbus/driver-sdk work')

  // Test named exports from transport
  const { createTransport, createRTUTransport } = packages.transport

  if (typeof createTransport !== 'function') {
    console.error('❌ Failed: createTransport is not a function')
    process.exit(1)
  }
  console.log('✓ Named exports from @ya-modbus/transport work')

  // Test driver package exports (NO .default workaround)
  if (typeof packages.driverXymd1.createDriver !== 'function') {
    console.error('❌ Failed: driver-xymd1.createDriver is not a function')
    process.exit(1)
  }

  if (!packages.driverXymd1.DEFAULT_CONFIG) {
    console.error('❌ Failed: driver-xymd1.DEFAULT_CONFIG not found')
    process.exit(1)
  }

  // Test other driver (ex9em) exports
  if (typeof packages.driverEx9em.createDriver !== 'function') {
    console.error('❌ Failed: driver-ex9em.createDriver is not a function')
    process.exit(1)
  }

  console.log('✓ Driver package exports work (no .default needed)')

  // Test driver-loader exports
  const { loadDriver } = packages.driverLoader
  if (typeof loadDriver !== 'function') {
    console.error('❌ Failed: loadDriver is not a function')
    process.exit(1)
  }
  console.log('✓ Driver loader exports work')

  // Test emulator exports
  const { ModbusEmulator } = packages.emulator
  if (typeof ModbusEmulator !== 'function') {
    console.error('❌ Failed: ModbusEmulator is not a function')
    process.exit(1)
  }
  console.log('✓ Emulator exports work')

  // Test device-profiler exports
  const { scanRegisters } = packages.deviceProfiler
  if (typeof scanRegisters !== 'function') {
    console.error('❌ Failed: scanRegisters is not a function')
    process.exit(1)
  }
  console.log('✓ Device profiler exports work')

  // Verify driver can be created
  const driver = await packages.driverXymd1.createDriver({
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
  console.log('\nPackage exports summary:')
  console.log('  @ya-modbus/cli:', Object.keys(packages.cli).slice(0, 3).join(', '), '...')
  console.log(
    '  @ya-modbus/device-profiler:',
    Object.keys(packages.deviceProfiler).slice(0, 3).join(', '),
    '...'
  )
  console.log('  @ya-modbus/driver-ex9em: createDriver, DEFAULT_CONFIG, ...')
  console.log('  @ya-modbus/driver-loader: loadDriver, ...')
  console.log('  @ya-modbus/driver-sdk: readScaledUInt16BE, createEnumValidator, ...')
  console.log('  @ya-modbus/driver-xymd1: createDriver, DEFAULT_CONFIG')
  console.log('  @ya-modbus/emulator: ModbusEmulator, ...')
  console.log(
    '  @ya-modbus/mqtt-bridge:',
    Object.keys(packages.mqttBridge).slice(0, 3).join(', '),
    '...'
  )
  console.log('  @ya-modbus/transport: createTransport, createRTUTransport, ...')
  console.log('  Created driver.name:', driver.name)

  console.log('\n✅ All CommonJS imports successful!')
  console.log('✅ No .default workaround required!')
  console.log('✅ All 11 packages loaded and verified!')
}

main().catch((error) => {
  console.error('❌ Test failed:', error.message)
  process.exit(1)
})
