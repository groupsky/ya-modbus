import type { Transport } from '@ya-modbus/driver-types'

/**
 * Wraps a Transport to automatically set the slave ID before each operation.
 *
 * This is essential when multiple devices share the same physical bus - each device
 * needs a different slave ID, but they all use the same underlying transport connection.
 *
 * The wrapper ensures that setSlaveId() is called before EVERY Modbus operation,
 * allowing safe concurrent use of a single transport for multiple slave devices.
 */
export class SlaveIdTransport implements Transport {
  constructor(
    private readonly transport: Transport,
    private readonly slaveId: number
  ) {}

  async readHoldingRegisters(address: number, count: number): Promise<Buffer> {
    this.transport.setSlaveId(this.slaveId)
    return this.transport.readHoldingRegisters(address, count)
  }

  async readInputRegisters(address: number, count: number): Promise<Buffer> {
    this.transport.setSlaveId(this.slaveId)
    return this.transport.readInputRegisters(address, count)
  }

  async readCoils(address: number, count: number): Promise<Buffer> {
    this.transport.setSlaveId(this.slaveId)
    return this.transport.readCoils(address, count)
  }

  async readDiscreteInputs(address: number, count: number): Promise<Buffer> {
    this.transport.setSlaveId(this.slaveId)
    return this.transport.readDiscreteInputs(address, count)
  }

  async writeSingleRegister(address: number, value: number): Promise<void> {
    this.transport.setSlaveId(this.slaveId)
    return this.transport.writeSingleRegister(address, value)
  }

  async writeMultipleRegisters(address: number, values: Buffer): Promise<void> {
    this.transport.setSlaveId(this.slaveId)
    return this.transport.writeMultipleRegisters(address, values)
  }

  async writeSingleCoil(address: number, value: boolean): Promise<void> {
    this.transport.setSlaveId(this.slaveId)
    return this.transport.writeSingleCoil(address, value)
  }

  async writeMultipleCoils(address: number, values: Buffer): Promise<void> {
    this.transport.setSlaveId(this.slaveId)
    return this.transport.writeMultipleCoils(address, values)
  }

  setSlaveId(_slaveId: number): void {
    // SlaveIdTransport is immutable - the slave ID is set at construction time
    // If you need a different slave ID, create a new SlaveIdTransport instance
    throw new Error(
      'Cannot change slaveId on a SlaveIdTransport - create a new instance with the desired slaveId'
    )
  }

  async close(): Promise<void> {
    return this.transport.close()
  }
}
