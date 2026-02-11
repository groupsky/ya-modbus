import type { Transport } from '@ya-modbus/driver-types'
import type ModbusRTU from 'modbus-serial'

import { withRetry, type RetryLogger } from './retry.js'

/**
 * Create a Transport implementation from a ModbusRTU client
 *
 * This factory wraps all modbus-serial client methods with retry logic
 * and converts them to the Transport interface expected by device drivers.
 *
 * @param client - Configured ModbusRTU client instance
 * @param maxRetries - Maximum retry attempts (default: 3, use 1 for discovery to disable retries)
 * @param logger - Optional callback to log retry attempts for debugging
 * @returns Transport implementation
 */
export function createModbusTransport(
  client: ModbusRTU,
  maxRetries: number = 3,
  logger?: RetryLogger
): Transport {
  return {
    async readHoldingRegisters(address: number, count: number): Promise<Buffer> {
      return withRetry(
        async () => {
          const result = await client.readHoldingRegisters(address, count)
          return result.buffer
        },
        maxRetries,
        logger
      )
    },

    async readInputRegisters(address: number, count: number): Promise<Buffer> {
      return withRetry(
        async () => {
          const result = await client.readInputRegisters(address, count)
          return result.buffer
        },
        maxRetries,
        logger
      )
    },

    async readCoils(address: number, count: number): Promise<Buffer> {
      return withRetry(
        async () => {
          const result = await client.readCoils(address, count)
          return result.buffer
        },
        maxRetries,
        logger
      )
    },

    async readDiscreteInputs(address: number, count: number): Promise<Buffer> {
      return withRetry(
        async () => {
          const result = await client.readDiscreteInputs(address, count)
          return result.buffer
        },
        maxRetries,
        logger
      )
    },

    async writeSingleRegister(address: number, value: number): Promise<void> {
      return withRetry(
        async () => {
          await client.writeRegister(address, value)
        },
        maxRetries,
        logger
      )
    },

    async writeMultipleRegisters(address: number, values: Buffer): Promise<void> {
      return withRetry(
        async () => {
          await client.writeRegisters(address, values)
        },
        maxRetries,
        logger
      )
    },

    async writeSingleCoil(address: number, value: boolean): Promise<void> {
      return withRetry(
        async () => {
          await client.writeCoil(address, value)
        },
        maxRetries,
        logger
      )
    },

    async writeMultipleCoils(address: number, values: Buffer): Promise<void> {
      return withRetry(
        async () => {
          // Convert Buffer to boolean array
          const bools: boolean[] = []
          for (let i = 0; i < values.length * 8; i++) {
            const byteIndex = Math.floor(i / 8)
            const bitIndex = i % 8
            const byte = values[byteIndex] as number // byteIndex < values.length due to loop condition
            bools.push((byte & (1 << bitIndex)) !== 0)
          }
          await client.writeCoils(address, bools)
        },
        maxRetries,
        logger
      )
    },

    setSlaveId(slaveId: number): void {
      client.setID(slaveId)
    },

    async close(): Promise<void> {
      return new Promise<void>((resolve) => {
        client.close(resolve)
      })
    },
  }
}
