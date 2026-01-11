#!/usr/bin/env node

/**
 * ES Module Consumer Test
 *
 * Verifies that ya-modbus packages can be consumed in ESM projects
 * with native import statements.
 */

import { program } from '@ya-modbus/cli'
import { scanRegisters } from '@ya-modbus/device-profiler'
import {
  createDriver as createEx9emDriver,
  DEFAULT_CONFIG as EX9EM_CONFIG,
} from '@ya-modbus/driver-ex9em'
import { loadDriver } from '@ya-modbus/driver-loader'
import { createDriver as createOrWe516Driver } from '@ya-modbus/driver-or-we-516'
import { readScaledUInt16BE, createEnumValidator } from '@ya-modbus/driver-sdk'
import { createDriver as createXYMD1Driver, DEFAULT_CONFIG } from '@ya-modbus/driver-xymd1'
import { ModbusEmulator } from '@ya-modbus/emulator'
import { createBridge } from '@ya-modbus/mqtt-bridge'
import { createTransport, createRTUTransport } from '@ya-modbus/transport'

async function main() {
  console.log('Testing ES Module imports...\n')

  // Test all packages loaded
  const imports = {
    program,
    scanRegisters,
    createEx9emDriver,
    loadDriver,
    createOrWe516Driver,
    readScaledUInt16BE,
    createXYMD1Driver,
    ModbusEmulator,
    createBridge,
    createTransport,
  }

  for (const [name, value] of Object.entries(imports)) {
    if (value === undefined) {
      console.error(`❌ Failed: ${name} is undefined`)
      process.exit(1)
    }
  }
  console.log('✓ All packages imported successfully')

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

  // Test other driver (ex9em) exports
  if (typeof createEx9emDriver !== 'function') {
    console.error('❌ Failed: createEx9emDriver is not a function')
    process.exit(1)
  }

  console.log('✓ Driver package exports work')

  // Test driver-loader exports
  if (typeof loadDriver !== 'function') {
    console.error('❌ Failed: loadDriver is not a function')
    process.exit(1)
  }
  console.log('✓ Driver loader exports work')

  // Test emulator exports
  if (typeof ModbusEmulator !== 'function') {
    console.error('❌ Failed: ModbusEmulator is not a function')
    process.exit(1)
  }
  console.log('✓ Emulator exports work')

  // Test device-profiler exports
  if (typeof scanRegisters !== 'function') {
    console.error('❌ Failed: scanRegisters is not a function')
    process.exit(1)
  }
  console.log('✓ Device profiler exports work')

  // Test CLI exports
  if (typeof program !== 'object') {
    console.error('❌ Failed: program is not an object')
    process.exit(1)
  }
  console.log('✓ CLI exports work')

  // Test MQTT bridge exports
  if (typeof createBridge !== 'function') {
    console.error('❌ Failed: createBridge is not a function')
    process.exit(1)
  }
  console.log('✓ MQTT bridge exports work')

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
  console.log('\nPackage exports summary:')
  console.log('  @ya-modbus/cli: program')
  console.log('  @ya-modbus/device-profiler: scanRegisters, ...')
  console.log('  @ya-modbus/driver-ex9em: createDriver, DEFAULT_CONFIG')
  console.log('  @ya-modbus/driver-loader: loadDriver, ...')
  console.log('  @ya-modbus/driver-sdk: readScaledUInt16BE, createEnumValidator, ...')
  console.log('  @ya-modbus/driver-xymd1: createDriver, DEFAULT_CONFIG')
  console.log('  @ya-modbus/emulator: ModbusEmulator, ...')
  console.log('  @ya-modbus/mqtt-bridge: createBridge, ...')
  console.log('  @ya-modbus/transport: createTransport, createRTUTransport, ...')
  console.log('  Created driver.name:', driver.name)

  console.log('\n✅ All ES Module imports successful!')
  console.log('✅ All 11 packages loaded and verified!')
}

main().catch((error) => {
  console.error('❌ Test failed:', error.message)
  process.exit(1)
})
