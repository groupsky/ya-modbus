#!/usr/bin/env node

/**
 * TypeScript CommonJS Consumer Test
 *
 * Verifies that ya-modbus packages can be consumed in TypeScript CommonJS projects
 * with full type safety and without .default workarounds.
 */

import { program } from '@ya-modbus/cli'
import { scanRegisters } from '@ya-modbus/device-profiler'
import {
  createDriver as createEx9emDriver,
  DEFAULT_CONFIG as EX9EM_CONFIG,
} from '@ya-modbus/driver-ex9em'
import { loadDriver } from '@ya-modbus/driver-loader'
import { readScaledUInt16BE, createEnumValidator } from '@ya-modbus/driver-sdk'
import type { DataType, DeviceDriver } from '@ya-modbus/driver-types'
import { createDriver as createXYMD1Driver, DEFAULT_CONFIG } from '@ya-modbus/driver-xymd1'
import { ModbusEmulator } from '@ya-modbus/emulator'
import { createBridge } from '@ya-modbus/mqtt-bridge'
import { createTransport, createRTUTransport } from '@ya-modbus/transport'

async function main() {
  console.log('Testing TypeScript CommonJS imports...\n')

  // Test all packages imported
  const imports = {
    program,
    scanRegisters,
    createEx9emDriver,
    loadDriver,
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
  console.log('✓ All packages imported successfully with types (no .default needed)')

  // Test that runtime functions exist
  if (typeof readScaledUInt16BE !== 'function') {
    console.error('❌ Failed: readScaledUInt16BE is not a function')
    process.exit(1)
  }
  console.log('✓ Named exports from @ya-modbus/driver-sdk work with types')

  if (typeof createTransport !== 'function') {
    console.error('❌ Failed: createTransport is not a function')
    process.exit(1)
  }
  console.log('✓ Named exports from @ya-modbus/transport work with types')

  // Test driver package exports with type annotations (NO .default workaround needed)
  const createDriverTyped: typeof createXYMD1Driver = createXYMD1Driver

  if (typeof createDriverTyped !== 'function') {
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

  console.log('✓ Driver package exports work with types (no .default needed)')

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

  // Verify driver can be created (runtime config validation)
  const driver: DeviceDriver = await createXYMD1Driver({
    transport: {
      type: 'tcp',
      host: 'localhost',
      port: 502,
      timeout: 1000,
    },
    slaveId: 1,
  } as any) // Use 'as any' since transport config is runtime-validated

  if (!driver || typeof driver.readDataPoint !== 'function') {
    console.error('❌ Failed: driver.readDataPoint is not a function')
    process.exit(1)
  }
  console.log('✓ Driver factory function works correctly with types')

  // Test type-only imports
  const dataType: DataType = 'float'
  console.log('✓ Type-only imports work correctly')

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
  console.log('  dataType value:', dataType)

  console.log('\n✅ All TypeScript CommonJS imports successful with full type safety!')
  console.log('✅ No .default workaround required!')
  console.log('✅ All 10 packages loaded and verified!')
}

main().catch((error: Error) => {
  console.error('❌ Test failed:', error.message)
  process.exit(1)
})
