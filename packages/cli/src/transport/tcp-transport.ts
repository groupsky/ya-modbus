import type { Transport } from '@ya-modbus/driver-types'
import ModbusRTU from 'modbus-serial'

import { createModbusTransport } from './create-modbus-transport.js'

/**
 * TCP transport configuration
 */
export interface TCPConfig {
  /** TCP host (IP address or hostname) */
  host: string
  /** TCP port (default: 502) */
  port?: number | undefined
  /** Modbus slave ID (1-247) */
  slaveId: number
  /** Response timeout in milliseconds (default: 1000) */
  timeout?: number | undefined
}

/**
 * Create a TCP transport
 *
 * @param config - TCP configuration
 * @returns Transport implementation for TCP
 */
export async function createTCPTransport(config: TCPConfig): Promise<Transport> {
  const client = new ModbusRTU()

  // Connect to TCP server
  await client.connectTCP(config.host, { port: config.port ?? 502 })

  // Set slave ID
  client.setID(config.slaveId)

  // Set timeout
  client.setTimeout(config.timeout ?? 1000)

  return createModbusTransport(client)
}
