#!/usr/bin/env tsx
import { RegisterType, scanRegisters } from '@ya-modbus/device-profiler'
import type { Transport } from '@ya-modbus/driver-types'

// Example function showing programmatic usage
export async function scanDevice(transport: Transport): Promise<void> {
  await scanRegisters({
    transport,
    type: RegisterType.Holding,
    startAddress: 0,
    endAddress: 100,
    batchSize: 10,
    onProgress: (current, total) => {
      console.log(`${current}/${total}`)
    },
    onResult: (result) => {
      console.log(result)
    },
  })
}
