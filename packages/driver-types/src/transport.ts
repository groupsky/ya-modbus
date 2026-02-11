/**
 * Transport layer interface
 *
 * Abstraction over Modbus RTU/TCP transports.
 * Drivers use this interface to communicate with devices.
 */

/**
 * Modbus transport interface
 */
export interface Transport {
  /**
   * Read holding registers
   *
   * @param address - Starting register address
   * @param count - Number of registers to read
   * @returns Register values as Buffer
   */
  readHoldingRegisters(address: number, count: number): Promise<Buffer>

  /**
   * Read input registers
   *
   * @param address - Starting register address
   * @param count - Number of registers to read
   * @returns Register values as Buffer
   */
  readInputRegisters(address: number, count: number): Promise<Buffer>

  /**
   * Read coils
   *
   * @param address - Starting coil address
   * @param count - Number of coils to read
   * @returns Coil values as Buffer
   */
  readCoils(address: number, count: number): Promise<Buffer>

  /**
   * Read discrete inputs
   *
   * @param address - Starting input address
   * @param count - Number of inputs to read
   * @returns Input values as Buffer
   */
  readDiscreteInputs(address: number, count: number): Promise<Buffer>

  /**
   * Write single holding register
   *
   * @param address - Register address
   * @param value - Value to write (16-bit)
   */
  writeSingleRegister(address: number, value: number): Promise<void>

  /**
   * Write multiple holding registers
   *
   * @param address - Starting register address
   * @param values - Register values as Buffer
   */
  writeMultipleRegisters(address: number, values: Buffer): Promise<void>

  /**
   * Write single coil
   *
   * @param address - Coil address
   * @param value - Value to write (boolean)
   */
  writeSingleCoil(address: number, value: boolean): Promise<void>

  /**
   * Write multiple coils
   *
   * @param address - Starting coil address
   * @param values - Coil values as Buffer
   */
  writeMultipleCoils(address: number, values: Buffer): Promise<void>

  /**
   * Close the transport connection
   *
   * Releases resources and allows the process to exit.
   * Should be called when done using the transport.
   */
  close(): Promise<void>
}
