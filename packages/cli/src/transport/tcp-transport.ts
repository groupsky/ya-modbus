import type { Transport } from '@ya-modbus/driver-types'
import ModbusRTU from 'modbus-serial'

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
 * Maximum number of retry attempts for transient failures
 */
const MAX_RETRIES = 3

/**
 * Delay between retry attempts in milliseconds
 */
const RETRY_DELAY_MS = 100

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = MAX_RETRIES): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt < maxRetries) {
        await sleep(RETRY_DELAY_MS)
      }
    }
  }

  // lastError is always defined here since we only reach this point after catching an error
  throw lastError as Error
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
