/**
 * Helper for running code against a Modbus TCP emulator
 *
 * Sets up a TCP server with the emulator and provides connection details to the callback.
 */

import { ModbusEmulator } from '../emulator.js'
import { TcpTransport } from '../transports/tcp.js'

export interface TcpEmulatorConfig {
  /** Slave ID for the emulated device (default: 1) */
  slaveId?: number
  /** Initial holding register values: { address: value } */
  holding?: Record<number, number>
  /** Initial input register values: { address: value } */
  input?: Record<number, number>
  /** TCP port (default: 0 for dynamic allocation) */
  port?: number
  /** TCP host (default: '127.0.0.1') */
  host?: string
}

export interface TcpEmulatorContext {
  /** Host address of the TCP server */
  host: string
  /** Port the TCP server is listening on */
  port: number
  /** The emulator instance (for advanced usage) */
  emulator: ModbusEmulator
}

/**
 * Run a function with a TCP emulator
 *
 * Sets up a Modbus TCP emulator, starts it, and provides connection details
 * that can be used with createTCPTransport.
 *
 * @example
 * ```typescript
 * import { withTcpEmulator } from '@ya-modbus/emulator'
 * import { createTCPTransport } from '@ya-modbus/transport'
 * import { createDriver } from '@ya-modbus/driver-xymd1'
 *
 * await withTcpEmulator(
 *   { input: { 1: 245, 2: 652 } },
 *   async ({ host, port }) => {
 *     const transport = await createTCPTransport({
 *       host,
 *       port,
 *       slaveId: 1,
 *     })
 *     const driver = await createDriver({ transport, slaveId: 1 })
 *     const values = await driver.readDataPoints(['temperature', 'humidity'])
 *     console.log(values) // { temperature: 24.5, humidity: 65.2 }
 *     await transport.close()
 *   }
 * )
 * ```
 */
export async function withTcpEmulator<T>(
  config: TcpEmulatorConfig,
  fn: (context: TcpEmulatorContext) => Promise<T>
): Promise<T> {
  const slaveId = config.slaveId ?? 1
  const port = config.port ?? 0
  const host = config.host ?? '127.0.0.1'

  // Create emulator with TCP transport
  const emulator = new ModbusEmulator({
    transport: 'tcp',
    port,
    host,
  })

  // Add device with initial register values
  const device = emulator.addDevice({ slaveId })

  // Initialize holding registers
  if (config.holding) {
    for (const [addr, value] of Object.entries(config.holding)) {
      device.setHoldingRegister(Number(addr), value)
    }
  }

  // Initialize input registers
  if (config.input) {
    for (const [addr, value] of Object.entries(config.input)) {
      device.setInputRegister(Number(addr), value)
    }
  }

  // Start the emulator
  await emulator.start()

  // Get actual port from transport
  const transport = emulator.getTransport()
  const actualPort = transport instanceof TcpTransport ? transport.getPort() : port

  try {
    return await fn({
      host,
      port: actualPort,
      emulator,
    })
  } finally {
    await emulator.stop()
  }
}
