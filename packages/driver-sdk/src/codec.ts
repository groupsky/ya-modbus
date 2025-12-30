/**
 * Buffer encoding/decoding utilities for Modbus register values
 *
 * These utilities handle common patterns in Modbus drivers like reading
 * scaled integers (×10, ×100, ×1000) from register buffers.
 */

/**
 * Validate that a scale parameter is valid
 *
 * @param scale - Scale factor to validate
 * @throws Error if scale is not finite or is not positive
 */
function validateScale(scale: number): void {
  if (!Number.isFinite(scale)) {
    throw new Error('Invalid scale: must be a finite number')
  }
  if (scale <= 0) {
    throw new Error('Invalid scale: must be greater than 0')
  }
}

/**
 * Validate that a value for writing is valid
 *
 * @param value - Value to validate
 * @throws Error if value is not finite
 */
function validateWriteValue(value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error('Invalid value: must be a finite number')
  }
}

/**
 * Validate that a scaled value fits within the target integer range
 *
 * @param scaledValue - Scaled value to validate
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @param typeName - Name of the target type for error messages
 * @throws Error if scaled value is outside the valid range
 */
function validateRange(scaledValue: number, min: number, max: number, typeName: string): void {
  if (scaledValue < min || scaledValue > max) {
    throw new Error(
      `Invalid scaled value: ${scaledValue} is outside ${typeName} range (${min} to ${max})`
    )
  }
}

/**
 * Read and scale an unsigned 16-bit integer from a buffer
 *
 * @param buffer - Buffer containing the register data
 * @param offset - Byte offset to start reading from
 * @param scale - Scale factor (e.g., 10 for ×10 values)
 * @returns Scaled floating-point value
 * @throws Error if scale is not a finite positive number
 *
 * @example
 * ```typescript
 * // Device stores temperature as integer ×10 (235 = 23.5°C)
 * const buffer = await transport.readInputRegisters(0, 1)
 * const temperature = readScaledUInt16BE(buffer, 0, 10)
 * ```
 */
export function readScaledUInt16BE(buffer: Buffer, offset: number, scale: number): number {
  validateScale(scale)
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
 * @throws Error if scale is not a finite positive number
 *
 * @example
 * ```typescript
 * // Device stores correction offset as signed integer ×10 (-50 = -5.0°C)
 * const buffer = await transport.readHoldingRegisters(0x103, 1)
 * const correction = readScaledInt16BE(buffer, 0, 10)
 * ```
 */
export function readScaledInt16BE(buffer: Buffer, offset: number, scale: number): number {
  validateScale(scale)
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
 * @throws Error if scale is not a finite positive number
 *
 * @example
 * ```typescript
 * // Device stores total energy as 32-bit integer ×100 (1000000 = 10000.00 kWh)
 * const buffer = await transport.readHoldingRegisters(0x0007, 2)
 * const totalEnergy = readScaledUInt32BE(buffer, 0, 100)
 * ```
 */
export function readScaledUInt32BE(buffer: Buffer, offset: number, scale: number): number {
  validateScale(scale)
  const rawValue = buffer.readUInt32BE(offset)
  return rawValue / scale
}

/**
 * Encode and scale a value to an unsigned 16-bit integer buffer
 *
 * @param value - Value to encode
 * @param scale - Scale factor (e.g., 10 for ×10 values)
 * @returns 2-byte buffer containing the scaled value
 * @throws Error if value is not finite, scale is invalid, or scaled value exceeds uint16 range
 *
 * @example
 * ```typescript
 * // Write humidity correction of 5.5% (stored as 55)
 * const buffer = writeScaledUInt16BE(5.5, 10)
 * await transport.writeMultipleRegisters(0x104, buffer)
 * ```
 */
export function writeScaledUInt16BE(value: number, scale: number): Buffer {
  validateWriteValue(value)
  validateScale(scale)

  const scaledValue = Math.trunc(value * scale)
  validateRange(scaledValue, 0, 0xffff, 'uint16')

  const buffer = Buffer.allocUnsafe(2)
  buffer.writeUInt16BE(scaledValue, 0)
  return buffer
}

/**
 * Encode and scale a value to a signed 16-bit integer buffer
 *
 * @param value - Value to encode
 * @param scale - Scale factor (e.g., 10 for ×10 values)
 * @returns 2-byte buffer containing the scaled value
 * @throws Error if value is not finite, scale is invalid, or scaled value exceeds int16 range
 *
 * @example
 * ```typescript
 * // Write temperature correction of -3.5°C (stored as -35)
 * const buffer = writeScaledInt16BE(-3.5, 10)
 * await transport.writeMultipleRegisters(0x103, buffer)
 * ```
 */
export function writeScaledInt16BE(value: number, scale: number): Buffer {
  validateWriteValue(value)
  validateScale(scale)

  // Use Math.trunc for predictable rounding toward zero (avoids floating-point precision issues)
  const scaledValue = Math.trunc(value * scale)
  validateRange(scaledValue, -0x8000, 0x7fff, 'int16')

  const buffer = Buffer.allocUnsafe(2)
  buffer.writeInt16BE(scaledValue, 0)
  return buffer
}
