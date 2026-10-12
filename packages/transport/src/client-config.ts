/**
 * Settings shared by the modbus-serial clients that the transports create
 */

import type ModbusRTU from 'modbus-serial'

/** Default response timeout for Modbus operations in milliseconds */
export const DEFAULT_TIMEOUT_MS = 1000

/**
 * Apply the slave ID and response timeout to a modbus-serial client
 *
 * @param client - ModbusRTU client instance
 * @param slaveId - Modbus slave ID
 * @param timeout - Response timeout in milliseconds (default: DEFAULT_TIMEOUT_MS)
 */
export function configureClient(client: ModbusRTU, slaveId: number, timeout?: number): void {
  client.setID(slaveId)
  client.setTimeout(timeout ?? DEFAULT_TIMEOUT_MS)
}

/**
 * Connect a modbus-serial client to a Modbus TCP server, and give up after `timeout` ms when
 * the host does not answer
 *
 * Without a timeout, the connect waits for the TCP timeout of the system (about 2 minutes on
 * Linux). modbus-serial uses the `timeout` option as the socket timeout, so a connect that
 * takes longer fails with 'TCP Connection Timed Out'. After the connect, the socket keeps
 * the timeout, but then it does not close the socket.
 *
 * @param client - New modbus-serial client
 * @param host - TCP host (IP address or hostname)
 * @param port - TCP port
 * @param timeout - Connect timeout in milliseconds (default: DEFAULT_TIMEOUT_MS)
 */
export async function connectTCP(
  client: ModbusRTU,
  host: string,
  port: number,
  timeout = DEFAULT_TIMEOUT_MS
): Promise<void> {
  try {
    await client.connectTCP(host, { port, timeout })
  } catch (error) {
    // After a timeout the socket still tries to connect. A connection that it opens later
    // would stay open with nothing using it.
    client.destroy(() => undefined)
    throw error
  }
}
