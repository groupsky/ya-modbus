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

  async readHoldingRegisters(slaveId: number, address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(() => {
      return this.transport.readHoldingRegisters(slaveId, address, count)
    })
  }

  async readInputRegisters(slaveId: number, address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(() => {
      return this.transport.readInputRegisters(slaveId, address, count)
    })
  }

  async readCoils(slaveId: number, address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(() => {
      return this.transport.readCoils(slaveId, address, count)
    })
  }

  async readDiscreteInputs(slaveId: number, address: number, count: number): Promise<Buffer> {
    return this.mutex.runExclusive(() => {
      return this.transport.readDiscreteInputs(slaveId, address, count)
    })
  }

  async writeRegister(slaveId: number, address: number, value: number): Promise<void> {
    await this.mutex.runExclusive(async () => {
      await this.transport.writeRegister(slaveId, address, value)
    })
  }

  async writeCoil(slaveId: number, address: number, value: boolean): Promise<void> {
    await this.mutex.runExclusive(async () => {
      await this.transport.writeCoil(slaveId, address, value)
    })
  }

  async writeMultipleRegisters(
    slaveId: number,
    address: number,
    values: Buffer
  ): Promise<void> {
    return this.mutex.runExclusive(() => {
      return this.transport.writeMultipleRegisters(slaveId, address, values)
    })
  }

  async writeMultipleCoils(slaveId: number, address: number, values: Buffer): Promise<void> {
    return this.mutex.runExclusive(() => {
      return this.transport.writeMultipleCoils(slaveId, address, values)
    })
  }

  async close(): Promise<void> {
    // No mutex needed for close - just delegate
    return this.transport.close()
  }
}
