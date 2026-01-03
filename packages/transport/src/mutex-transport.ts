import type { Transport } from '@ya-modbus/driver-types'
import { Mutex } from 'async-mutex'

/**
 * Wraps a transport with mutex-based serialization.
 * All operations are executed sequentially to prevent bus collisions.
 *
 * Used for RTU transports where multiple devices share the same serial bus.
 */
export class MutexTransport implements Transport {
  constructor(
    private readonly transport: Transport,
    private readonly mutex: Mutex
  ) {}

  async readHoldingRegisters(address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(() => {
      return this.transport.readHoldingRegisters(address, count)
    })
  }

  async readInputRegisters(address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(() => {
      return this.transport.readInputRegisters(address, count)
    })
  }

  async readCoils(address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(() => {
      return this.transport.readCoils(address, count)
    })
  }

  async readDiscreteInputs(address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(() => {
      return this.transport.readDiscreteInputs(address, count)
    })
  }

  async writeSingleRegister(address: number, value: number): Promise<void> {
    await this.mutex.runExclusive(async () => {
      await this.transport.writeSingleRegister(address, value)
    })
  }

  async writeSingleCoil(address: number, value: boolean): Promise<void> {
    await this.mutex.runExclusive(async () => {
      await this.transport.writeSingleCoil(address, value)
    })
  }

  async writeMultipleRegisters(address: number, values: Buffer): Promise<void> {
    return this.mutex.runExclusive(() => {
      return this.transport.writeMultipleRegisters(address, values)
    })
  }

  async writeMultipleCoils(address: number, values: Buffer): Promise<void> {
    return this.mutex.runExclusive(() => {
      return this.transport.writeMultipleCoils(address, values)
    })
  }

  async close(): Promise<void> {
    // No mutex needed for close - just delegate
    return this.transport.close()
  }
}
