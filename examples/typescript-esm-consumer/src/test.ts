#!/usr/bin/env node

/**
 * TypeScript ESM Consumer Test
 *
 * Verifies that ya-modbus packages can be consumed in TypeScript ESM projects
 * with full type safety.
 */

import { readScaledUInt16BE, createEnumValidator } from '@ya-modbus/driver-sdk'
import { createTransport, createRTUTransport } from '@ya-modbus/transport'
import { createDriver as createXYMD1Driver, DEFAULT_CONFIG } from '@ya-modbus/driver-xymd1'
import type { DataType, DeviceDriver } from '@ya-modbus/driver-types'

async function main() {
  console.log('Testing TypeScript ESM imports...\n')

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

  // Test driver package exports with type annotations
  const createDriverTyped: typeof createXYMD1Driver = createXYMD1Driver

  if (typeof createDriverTyped !== 'function') {
    console.error('❌ Failed: createDriver is not a function')
    process.exit(1)
  }

  if (!DEFAULT_CONFIG) {
    console.error('❌ Failed: DEFAULT_CONFIG not found')
    process.exit(1)
  }

  console.log('✓ Driver package exports work with types')

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
  console.log('\nExported values:')
  console.log('  createTransport:', typeof createTransport)
  console.log('  createRTUTransport:', typeof createRTUTransport)
  console.log('  readScaledUInt16BE:', typeof readScaledUInt16BE)
  console.log('  createXYMD1Driver:', typeof createXYMD1Driver)
  console.log('  DEFAULT_CONFIG:', typeof DEFAULT_CONFIG)
  console.log('  Created driver.readDataPoint:', typeof driver.readDataPoint)
  console.log('  Created driver.name:', driver.name)
  console.log('  dataType value:', dataType)

  console.log('\n✅ All TypeScript ESM imports successful with full type safety!')
}

main().catch((error: Error) => {
  console.error('❌ Test failed:', error.message)
  process.exit(1)
})
