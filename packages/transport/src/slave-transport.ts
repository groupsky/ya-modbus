import type { Transport } from '@ya-modbus/driver-types'
import type { Mutex } from 'async-mutex'
import type ModbusRTU from 'modbus-serial'

import { withRetry, type RetryLogger } from './retry.js'

/**
 * SlaveTransport wraps a shared ModbusRTU client with slave-specific addressing.
 *
 * Multiple SlaveTransport instances can share the same physical connection (serial port or TCP),
 * each communicating with a different slave device. The slave ID is set before each operation
 * to ensure requests are directed to the correct device.
 *
 * @example
 * ```typescript
 * const client = new ModbusRTU()
 * await client.connectRTUBuffered('/dev/ttyUSB0', { baudRate: 9600 })
 * const mutex = new Mutex()
 *
 * // Two devices on the same serial port
 * const device1 = new SlaveTransport(1, client, mutex, 3)
 * const device2 = new SlaveTransport(2, client, mutex, 3)
 *
 * // Each device talks to its own slave ID
 * await device1.readHoldingRegisters(0, 10) // Reads from slave 1
 * await device2.readHoldingRegisters(0, 10) // Reads from slave 2
 * ```
 */
export class SlaveTransport implements Transport {
  /**
   * @param slaveId - Modbus slave/unit ID for this device
   * @param client - Shared ModbusRTU client instance
   * @param mutex - Shared mutex for serializing operations on the bus
   * @param maxRetries - Maximum retry attempts for failed operations (default: 3)
   * @param logger - Optional callback to log retry attempts
   */
  constructor(
    private readonly slaveId: number,
    private readonly client: ModbusRTU,
    private readonly mutex: Mutex,
    private readonly maxRetries: number = 3,
    private readonly logger?: RetryLogger
  ) {}

  async readHoldingRegisters(address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        async () => {
          this.client.setID(this.slaveId)
          const result = await this.client.readHoldingRegisters(address, count)
          return result.buffer
        },
        this.maxRetries,
        this.logger
      )
    })
  }

  async readInputRegisters(address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        async () => {
          this.client.setID(this.slaveId)
          const result = await this.client.readInputRegisters(address, count)
          return result.buffer
        },
        this.maxRetries,
        this.logger
      )
    })
  }

  async readCoils(address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        async () => {
          this.client.setID(this.slaveId)
          const result = await this.client.readCoils(address, count)
          return result.buffer
        },
        this.maxRetries,
        this.logger
      )
    })
  }

  async readDiscreteInputs(address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        async () => {
          this.client.setID(this.slaveId)
          const result = await this.client.readDiscreteInputs(address, count)
          return result.buffer
        },
        this.maxRetries,
        this.logger
      )
    })
  }

  async writeSingleRegister(address: number, value: number): Promise<void> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        async () => {
          this.client.setID(this.slaveId)
          await this.client.writeRegister(address, value)
        },
        this.maxRetries,
        this.logger
      )
    })
  }

  async writeMultipleRegisters(address: number, values: Buffer): Promise<void> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        async () => {
          this.client.setID(this.slaveId)
          await this.client.writeRegisters(address, values)
        },
        this.maxRetries,
        this.logger
      )
    })
  }

  async writeSingleCoil(address: number, value: boolean): Promise<void> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        async () => {
          this.client.setID(this.slaveId)
          await this.client.writeCoil(address, value)
        },
        this.maxRetries,
        this.logger
      )
    })
  }

  async writeMultipleCoils(address: number, values: Buffer): Promise<void> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        async () => {
          this.client.setID(this.slaveId)
          // Convert Buffer to boolean array
          const bools: boolean[] = []
          for (let i = 0; i < values.length * 8; i++) {
            const byteIndex = Math.floor(i / 8)
            const bitIndex = i % 8
            const byte = values[byteIndex] as number
            bools.push((byte & (1 << bitIndex)) !== 0)
          }
          await this.client.writeCoils(address, bools)
        },
        this.maxRetries,
        this.logger
      )
    })
  }

  async close(): Promise<void> {
    // Don't use mutex for close operation
    return new Promise<void>((resolve) => {
      this.client.close(resolve)
    })
  }
}
