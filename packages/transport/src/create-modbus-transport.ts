import type { Transport } from '@ya-modbus/driver-types'
import type ModbusRTU from 'modbus-serial'

import { toConnection, type ModbusConnection } from './connection.js'
import { withRetry, type RetryLogger } from './retry.js'

/**
 * Create a Transport implementation from a ModbusRTU client
 *
 * This factory wraps all modbus-serial client methods with retry logic
 * and converts them to the Transport interface expected by device drivers.
 * Requests on a lost connection reject with a ConnectionLostError (see ModbusConnection).
 *
 * @param client - Configured ModbusRTU client instance, or a ModbusConnection that can reopen it
 * @param maxRetries - Maximum retry attempts (default: 3, use 1 for discovery to disable retries)
 * @param logger - Optional callback to log retry attempts for debugging
 * @returns Transport implementation
 */
export function createModbusTransport(
  client: ModbusRTU | ModbusConnection,
  maxRetries: number = 3,
  logger?: RetryLogger
): Transport {
  const connection = toConnection(client)

  return {
    async readHoldingRegisters(address: number, count: number): Promise<Buffer> {
      return withRetry(
        () =>
          connection.run(async (modbus) => {
            const result = await modbus.readHoldingRegisters(address, count)
            return result.buffer
          }),
        maxRetries,
        logger
      )
    },

    async readInputRegisters(address: number, count: number): Promise<Buffer> {
      return withRetry(
        () =>
          connection.run(async (modbus) => {
            const result = await modbus.readInputRegisters(address, count)
            return result.buffer
          }),
        maxRetries,
        logger
      )
    },

    async readCoils(address: number, count: number): Promise<Buffer> {
      return withRetry(
        () =>
          connection.run(async (modbus) => {
            const result = await modbus.readCoils(address, count)
            return result.buffer
          }),
        maxRetries,
        logger
      )
    },

    async readDiscreteInputs(address: number, count: number): Promise<Buffer> {
      return withRetry(
        () =>
          connection.run(async (modbus) => {
            const result = await modbus.readDiscreteInputs(address, count)
            return result.buffer
          }),
        maxRetries,
        logger
      )
    },

    async writeSingleRegister(address: number, value: number): Promise<void> {
      return withRetry(
        () =>
          connection.run(async (modbus) => {
            await modbus.writeRegister(address, value)
          }),
        maxRetries,
        logger
      )
    },

    async writeMultipleRegisters(address: number, values: Buffer): Promise<void> {
      return withRetry(
        () =>
          connection.run(async (modbus) => {
            await modbus.writeRegisters(address, values)
          }),
        maxRetries,
        logger
      )
    },

    async writeSingleCoil(address: number, value: boolean): Promise<void> {
      return withRetry(
        () =>
          connection.run(async (modbus) => {
            await modbus.writeCoil(address, value)
          }),
        maxRetries,
        logger
      )
    },

    async writeMultipleCoils(address: number, values: Buffer): Promise<void> {
      return withRetry(
        () =>
          connection.run(async (modbus) => {
            // Convert Buffer to boolean array
            const bools: boolean[] = []
            for (let i = 0; i < values.length * 8; i++) {
              const byteIndex = Math.floor(i / 8)
              const bitIndex = i % 8
              const byte = values[byteIndex] as number // byteIndex < values.length due to loop condition
              bools.push((byte & (1 << bitIndex)) !== 0)
            }
            await modbus.writeCoils(address, bools)
          }),
        maxRetries,
        logger
      )
    },

    async close(): Promise<void> {
      return connection.close()
    },
  }
}
