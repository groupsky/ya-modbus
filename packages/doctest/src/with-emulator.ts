/**
 * Helper for running code against the Modbus emulator
 *
 * Provides a simple wrapper that sets up an emulator with configured
 * registers and provides a transport for driver communication.
 */

import type { Transport } from '@ya-modbus/driver-types'
import { ModbusEmulator } from '@ya-modbus/emulator'

import { createClientTransport } from './client-transport.js'

export interface EmulatorConfig {
  /** Slave ID for the emulated device (default: 1) */
  slaveId?: number
  /** Initial holding register values: { address: value } */
  holding?: Record<number, number>
  /** Initial input register values: { address: value } */
  input?: Record<number, number>
}

export interface EmulatorContext {
  /** Transport connected to the emulator */
  transport: Transport
  /** The emulator instance (for advanced usage) */
  emulator: ModbusEmulator
}

/**
 * Run a function with an emulator-backed transport
 *
 * Sets up a Modbus emulator with the specified registers, provides a
 * transport that can be used with drivers, and cleans up automatically.
 *
 * @example
 * ```typescript
 * import { withEmulator } from '@ya-modbus/doctest'
 * import { createDriver } from '@ya-modbus/driver-xymd1'
 * import assert from 'node:assert'
 *
 * await withEmulator(
 *   { input: { 1: 245, 2: 652 } },
 *   async ({ transport }) => {
 *     const driver = await createDriver({ transport, slaveId: 1 })
 *     const values = await driver.readDataPoints(['temperature', 'humidity'])
 *     assert.deepStrictEqual(values, { temperature: 24.5, humidity: 65.2 })
 *   }
 * )
 * ```
 */
export async function withEmulator<T>(
  config: EmulatorConfig,
  fn: (context: EmulatorContext) => Promise<T>
): Promise<T> {
  const slaveId = config.slaveId ?? 1

  const emulator = new ModbusEmulator({ transport: 'memory' })

  emulator.addDevice({
    slaveId,
    registers: {
      holding: config.holding ?? {},
      input: config.input ?? {},
    },
  })

  await emulator.start()

  try {
    const memTransport = emulator.getTransport() as unknown as {
      sendRequest(slaveId: number, request: Buffer): Promise<Buffer>
    }
    const transport = createClientTransport(memTransport, slaveId)

    return await fn({ transport, emulator })
  } finally {
    await emulator.stop()
  }
}
