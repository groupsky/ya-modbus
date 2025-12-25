import type { Transport } from '@ya-modbus/driver-types'
import ModbusRTU from 'modbus-serial'

import { withRetry } from './retry.js'

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

  const transport: Transport = {
    async readHoldingRegisters(address: number, count: number): Promise<Buffer> {
      return withRetry(async () => {
        const result = await client.readHoldingRegisters(address, count)
        return result.buffer
      })
    },

    async readInputRegisters(address: number, count: number): Promise<Buffer> {
      return withRetry(async () => {
        const result = await client.readInputRegisters(address, count)
        return result.buffer
      })
    },

    async readCoils(address: number, count: number): Promise<Buffer> {
      return withRetry(async () => {
        const result = await client.readCoils(address, count)
        return result.buffer
      })
    },

    async readDiscreteInputs(address: number, count: number): Promise<Buffer> {
      return withRetry(async () => {
        const result = await client.readDiscreteInputs(address, count)
        return result.buffer
      })
    },

    async writeSingleRegister(address: number, value: number): Promise<void> {
      return withRetry(async () => {
        await client.writeRegister(address, value)
      })
    },

    async writeMultipleRegisters(address: number, values: Buffer): Promise<void> {
      return withRetry(async () => {
        await client.writeRegisters(address, values)
      })
    },

    async writeSingleCoil(address: number, value: boolean): Promise<void> {
      return withRetry(async () => {
        await client.writeCoil(address, value)
      })
    },

    async writeMultipleCoils(address: number, values: Buffer): Promise<void> {
      return withRetry(async () => {
        // Convert Buffer to boolean array
        const bools: boolean[] = []
        for (let i = 0; i < values.length * 8; i++) {
          const byteIndex = Math.floor(i / 8)
          const bitIndex = i % 8
          const byte = values[byteIndex] as number // byteIndex < values.length due to loop condition
          bools.push((byte & (1 << bitIndex)) !== 0)
        }
        await client.writeCoils(address, bools)
      })
    },

    async close(): Promise<void> {
      return new Promise<void>((resolve) => {
        client.close(resolve)
      })
    },
  }

  return transport
}
