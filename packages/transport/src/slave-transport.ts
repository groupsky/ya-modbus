import type { Transport } from '@ya-modbus/driver-types'
import type { Mutex } from 'async-mutex'
import type ModbusRTU from 'modbus-serial'

import { toConnection, type ModbusConnection } from './connection.js'
import { withRetry, type RetryLogger } from './retry.js'

/**
 * SlaveTransport wraps a shared ModbusRTU client with slave-specific addressing.
 *
 * Multiple SlaveTransport instances can share the same physical connection (serial port or TCP),
 * each communicating with a different slave device. The slave ID is set before each operation
 * to ensure requests are directed to the correct device.
 *
 * Requests on a lost connection reject with a ConnectionLostError. When the shared
 * ModbusConnection can reopen its client, all devices on the connection use the new client.
 *
 * @example
 * ```typescript
 * const client = new ModbusRTU()
 * await client.connectRTUBuffered('/dev/ttyUSB0', { baudRate: 9600 })
 * const connection = new ModbusConnection(client, '/dev/ttyUSB0')
 * const mutex = new Mutex()
 *
 * // Two devices on the same serial port
 * const device1 = new SlaveTransport(1, connection, mutex, 3)
 * const device2 = new SlaveTransport(2, connection, mutex, 3)
 *
 * // Each device talks to its own slave ID
 * await device1.readHoldingRegisters(0, 10) // Reads from slave 1
 * await device2.readHoldingRegisters(0, 10) // Reads from slave 2
 * ```
 */
export class SlaveTransport implements Transport {
  private readonly connection: ModbusConnection

  /**
   * @param slaveId - Modbus slave/unit ID for this device
   * @param client - Shared connection, or a ModbusRTU client that is not shared with other transports
   * @param mutex - Shared mutex for serializing operations on the bus
   * @param maxRetries - Maximum retry attempts for failed operations (default: 3)
   * @param logger - Optional callback to log retry attempts
   */
  constructor(
    private readonly slaveId: number,
    client: ModbusConnection | ModbusRTU,
    private readonly mutex: Mutex,
    private readonly maxRetries: number = 3,
    private readonly logger?: RetryLogger
  ) {
    this.connection = toConnection(client)
  }

  async readHoldingRegisters(address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        () =>
          this.connection.run(async (client) => {
            client.setID(this.slaveId)
            const result = await client.readHoldingRegisters(address, count)
            return result.buffer
          }),
        this.maxRetries,
        this.logger
      )
    })
  }

  async readInputRegisters(address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        () =>
          this.connection.run(async (client) => {
            client.setID(this.slaveId)
            const result = await client.readInputRegisters(address, count)
            return result.buffer
          }),
        this.maxRetries,
        this.logger
      )
    })
  }

  async readCoils(address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        () =>
          this.connection.run(async (client) => {
            client.setID(this.slaveId)
            const result = await client.readCoils(address, count)
            return result.buffer
          }),
        this.maxRetries,
        this.logger
      )
    })
  }

  async readDiscreteInputs(address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        () =>
          this.connection.run(async (client) => {
            client.setID(this.slaveId)
            const result = await client.readDiscreteInputs(address, count)
            return result.buffer
          }),
        this.maxRetries,
        this.logger
      )
    })
  }

  async writeSingleRegister(address: number, value: number): Promise<void> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        () =>
          this.connection.run(async (client) => {
            client.setID(this.slaveId)
            await client.writeRegister(address, value)
          }),
        this.maxRetries,
        this.logger
      )
    })
  }

  async writeMultipleRegisters(address: number, values: Buffer): Promise<void> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        () =>
          this.connection.run(async (client) => {
            client.setID(this.slaveId)
            await client.writeRegisters(address, values)
          }),
        this.maxRetries,
        this.logger
      )
    })
  }

  async writeSingleCoil(address: number, value: boolean): Promise<void> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        () =>
          this.connection.run(async (client) => {
            client.setID(this.slaveId)
            await client.writeCoil(address, value)
          }),
        this.maxRetries,
        this.logger
      )
    })
  }

  async writeMultipleCoils(address: number, values: Buffer): Promise<void> {
    return this.mutex.runExclusive(async () => {
      return withRetry(
        () =>
          this.connection.run(async (client) => {
            client.setID(this.slaveId)
            // Convert Buffer to boolean array
            const bools: boolean[] = []
            for (let i = 0; i < values.length * 8; i++) {
              const byteIndex = Math.floor(i / 8)
              const bitIndex = i % 8
              const byte = values[byteIndex] as number
              bools.push((byte & (1 << bitIndex)) !== 0)
            }
            await client.writeCoils(address, bools)
          }),
        this.maxRetries,
        this.logger
      )
    })
  }

  /**
   * Close the underlying client connection.
   *
   * IMPORTANT: This method does not use mutex protection and should only
   * be called during shutdown via TransportManager.closeAll(). Calling
   * this while operations are in progress may cause connection errors.
   *
   * Individual SlaveTransport instances should NOT call close() directly
   * as the client is shared across multiple devices on the same bus.
   */
  async close(): Promise<void> {
    // Don't use mutex for close operation
    return this.connection.close()
  }
}
