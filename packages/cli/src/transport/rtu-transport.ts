import type { Transport } from '@ya-modbus/driver-types'
import ModbusRTU from 'modbus-serial'

/**
 * RTU transport configuration
 */
export interface RTUConfig {
  /** Serial port path (e.g., /dev/ttyUSB0, COM1) */
  port: string
  /** Baud rate */
  baudRate: 2400 | 4800 | 9600 | 19200 | 38400 | 115200
  /** Data bits */
  dataBits: 7 | 8
  /** Parity */
  parity: 'none' | 'even' | 'odd'
  /** Stop bits */
  stopBits: 1 | 2
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

      // Don't retry on the last attempt
      if (attempt < maxRetries) {
        await sleep(RETRY_DELAY_MS)
      }
    }
  }

  throw lastError
}

/**
 * Create an RTU transport
 *
 * @param config - RTU configuration
 * @returns Transport implementation for RTU
 */
export async function createRTUTransport(config: RTUConfig): Promise<Transport> {
  const client = new ModbusRTU()

  // Connect to serial port
  await client.connectRTUBuffered(config.port, {
    baudRate: config.baudRate,
    dataBits: config.dataBits,
    parity: config.parity,
    stopBits: config.stopBits,
  })

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
          bools.push((values[byteIndex]! & (1 << bitIndex)) !== 0)
        }
        await client.writeCoils(address, bools)
      })
    },
  }

  return transport
}
