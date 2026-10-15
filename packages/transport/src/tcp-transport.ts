import type { Transport } from '@ya-modbus/driver-types'
import ModbusRTU from 'modbus-serial'

import { configureClient, connectTCP } from './client-config.js'
import { ModbusConnection } from './connection.js'
import { createModbusTransport } from './create-modbus-transport.js'
import { withRequestContext } from './request-context.js'
import type { RetryLogger } from './retry.js'

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
  /** Response timeout in milliseconds, also used as the connect timeout (default: 1000) */
  timeout?: number | undefined
  /** Maximum retry attempts (default: 3, use 1 to disable retries) */
  maxRetries?: number | undefined
  /** Optional callback to log retry attempts for debugging */
  logger?: RetryLogger | undefined
}

/**
 * Create a TCP transport
 *
 * When the connection is lost, requests reject with a ConnectionLostError and the
 * connection is reopened on a later request (see ModbusConnection).
 *
 * @param config - TCP configuration
 * @returns Transport implementation for TCP
 */
export async function createTCPTransport(config: TCPConfig): Promise<Transport> {
  const port = config.port ?? 502
  const open = async (): Promise<ModbusRTU> => {
    const client = new ModbusRTU()

    // Connect to TCP server
    await connectTCP(client, config.host, port, config.timeout)

    configureClient(client, config.slaveId, config.timeout)
    return client
  }

  const connection = new ModbusConnection(await open(), `${config.host}:${port}`, open)
  return withRequestContext(
    createModbusTransport(connection, config.maxRetries, config.logger),
    `${config.host}:${port}, slave ${config.slaveId}`
  )
}
