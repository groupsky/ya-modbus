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
