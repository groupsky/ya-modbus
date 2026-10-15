import type { Transport } from '@ya-modbus/driver-types'
import type { Mutex } from 'async-mutex'
import type ModbusRTU from 'modbus-serial'

import { toConnection, type ModbusConnection } from './connection.js'
import { LastRequest } from './last-request.js'
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
 * With an `interDeviceDelay` and a LastRequest shared by the transports on the connection, a
 * request waits after a request to another slave. Some meters do not answer a request that
 * comes too soon after another meter's reply.
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
   * @param interDeviceDelay - Pause in milliseconds before a request to this slave when the
   *   previous request on the connection went to another slave, counted from the end of that
   *   request (default: 0, no pause)
   * @param lastRequest - Last request on the connection, the same for all transports that share
   *   the mutex. interDeviceDelay needs it.
   */
  constructor(
    private readonly slaveId: number,
    client: ModbusConnection | ModbusRTU,
    private readonly mutex: Mutex,
    private readonly maxRetries: number = 3,
    private readonly logger?: RetryLogger,
    private readonly interDeviceDelay: number = 0,
    private readonly lastRequest: LastRequest = new LastRequest()
  ) {
    this.connection = toConnection(client)
  }

  async readHoldingRegisters(address: number, count: number): Promise<Buffer> {
    return this.request(async (client) => {
      const result = await client.readHoldingRegisters(address, count)
      return result.buffer
    })
  }

  async readInputRegisters(address: number, count: number): Promise<Buffer> {
    return this.request(async (client) => {
      const result = await client.readInputRegisters(address, count)
      return result.buffer
    })
  }

  async readCoils(address: number, count: number): Promise<Buffer> {
    return this.request(async (client) => {
      const result = await client.readCoils(address, count)
      return result.buffer
    })
  }

  async readDiscreteInputs(address: number, count: number): Promise<Buffer> {
    return this.request(async (client) => {
      const result = await client.readDiscreteInputs(address, count)
      return result.buffer
    })
  }

  async writeSingleRegister(address: number, value: number): Promise<void> {
    return this.request(async (client) => {
      await client.writeRegister(address, value)
    })
  }

  async writeMultipleRegisters(address: number, values: Buffer): Promise<void> {
    return this.request(async (client) => {
      await client.writeRegisters(address, values)
    })
  }

  async writeSingleCoil(address: number, value: boolean): Promise<void> {
    return this.request(async (client) => {
      await client.writeCoil(address, value)
    })
  }

  async writeMultipleCoils(address: number, values: Buffer): Promise<void> {
    return this.request(async (client) => {
      // Convert Buffer to boolean array
      const bools: boolean[] = []
      for (let i = 0; i < values.length * 8; i++) {
        const byteIndex = Math.floor(i / 8)
        const bitIndex = i % 8
        const byte = values[byteIndex] as number
        bools.push((byte & (1 << bitIndex)) !== 0)
      }
      await client.writeCoils(address, bools)
    })
  }

  /**
   * Close the underlying client connection.
   *
   * IMPORTANT: This method does not use mutex protection. Calling this while
   * operations are in progress may cause connection errors.
   *
   * Do NOT call close() on a transport from TransportManager: the client is
   * shared across multiple devices on the same bus. Use
   * TransportManager.releaseTransport() when a device is removed, and
   * TransportManager.closeAll() at shutdown.
   */
  async close(): Promise<void> {
    // Don't use mutex for close operation
    return this.connection.close()
  }

  /**
   * Run a request to this slave while no other request uses the bus: wait for the pause after
   * a request to another slave, then send it with retries
   */
  private request<T>(send: (client: ModbusRTU) => Promise<T>): Promise<T> {
    return this.mutex.runExclusive(async () => {
      await this.lastRequest.waitBefore(this.slaveId, this.interDeviceDelay)
      try {
        return await withRetry(
          () =>
            this.connection.run(async (client) => {
              client.setID(this.slaveId)
              return send(client)
            }),
          this.maxRetries,
          this.logger
        )
      } finally {
        this.lastRequest.ended(this.slaveId)
      }
    })
  }
}
