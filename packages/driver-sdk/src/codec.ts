/**
 * Buffer encoding/decoding utilities for Modbus register values
 *
 * These utilities handle common patterns in Modbus drivers like reading
 * scaled integers (×10, ×100, ×1000) from register buffers.
 */

/**
 * Read and scale an unsigned 16-bit integer from a buffer
 *
 * @param buffer - Buffer containing the register data
 * @param offset - Byte offset to start reading from
 * @param scale - Scale factor (e.g., 10 for ×10 values)
 * @returns Scaled floating-point value
 *
 * @example
 * ```typescript
 * // Device stores temperature as integer ×10 (235 = 23.5°C)
 * const buffer = await transport.readInputRegisters(0, 1)
 * const temperature = readScaledUInt16BE(buffer, 0, 10)
 * ```
 */
export function readScaledUInt16BE(buffer: Buffer, offset: number, scale: number): number {
  const rawValue = buffer.readUInt16BE(offset)
  return rawValue / scale
}

/**
 * Read and scale a signed 16-bit integer from a buffer
 *
 * @param buffer - Buffer containing the register data
 * @param offset - Byte offset to start reading from
 * @param scale - Scale factor (e.g., 10 for ×10 values)
 * @returns Scaled floating-point value
 *
 * @example
 * ```typescript
 * // Device stores correction offset as signed integer ×10 (-50 = -5.0°C)
 * const buffer = await transport.readHoldingRegisters(0x103, 1)
 * const correction = readScaledInt16BE(buffer, 0, 10)
 * ```
 */
export function readScaledInt16BE(buffer: Buffer, offset: number, scale: number): number {
  const rawValue = buffer.readInt16BE(offset)
  return rawValue / scale
}

/**
 * Read and scale an unsigned 32-bit integer from a buffer
 *
 * @param buffer - Buffer containing the register data (2 consecutive registers)
 * @param offset - Byte offset to start reading from
 * @param scale - Scale factor (e.g., 100 for ×100 values)
 * @returns Scaled floating-point value
 *
 * @example
 * ```typescript
 * // Device stores total energy as 32-bit integer ×100 (1000000 = 10000.00 kWh)
 * const buffer = await transport.readHoldingRegisters(0x0007, 2)
 * const totalEnergy = readScaledUInt32BE(buffer, 0, 100)
 * ```
 */
export function readScaledUInt32BE(buffer: Buffer, offset: number, scale: number): number {
  const rawValue = buffer.readUInt32BE(offset)
  return rawValue / scale
}

/**
 * Encode and scale a value to an unsigned 16-bit integer buffer
 *
 * @param value - Value to encode
 * @param scale - Scale factor (e.g., 10 for ×10 values)
 * @returns 2-byte buffer containing the scaled value
 *
 * @example
 * ```typescript
 * // Write humidity correction of 5.5% (stored as 55)
 * const buffer = writeScaledUInt16BE(5.5, 10)
 * await transport.writeMultipleRegisters(0x104, buffer)
 * ```
 */
export function writeScaledUInt16BE(value: number, scale: number): Buffer {
  const buffer = Buffer.allocUnsafe(2)
  const scaledValue = Math.trunc(value * scale)
  buffer.writeUInt16BE(scaledValue, 0)
  return buffer
}

/**
 * Encode and scale a value to a signed 16-bit integer buffer
 *
 * @param value - Value to encode
 * @param scale - Scale factor (e.g., 10 for ×10 values)
 * @returns 2-byte buffer containing the scaled value
 *
 * @example
 * ```typescript
 * // Write temperature correction of -3.5°C (stored as -35)
 * const buffer = writeScaledInt16BE(-3.5, 10)
 * await transport.writeMultipleRegisters(0x103, buffer)
 * ```
 */
export function writeScaledInt16BE(value: number, scale: number): Buffer {
  const buffer = Buffer.allocUnsafe(2)
  // Use Math.trunc for predictable rounding toward zero (avoids floating-point precision issues)
  const scaledValue = Math.trunc(value * scale)
  buffer.writeInt16BE(scaledValue, 0)
  return buffer
}
