/**
 * Runtime SDK for ya-modbus device drivers
 *
 * Provides utilities for common driver development tasks:
 * - Buffer encoding/decoding for scaled register values
 * - Configuration validation with type narrowing
 * - Consistent error message formatting
 *
 * @example
 * ```typescript
 * import {
 *   readScaledUInt16BE,
 *   createEnumValidator,
 *   formatEnumError,
 * } from '@ya-modbus/driver-sdk'
 *
 * // Read scaled temperature value
 * const buffer = await transport.readInputRegisters(1, 1)
 * const temperature = readScaledUInt16BE(buffer, 0, 10)
 *
 * // Validate baud rate
 * const isValidBaudRate = createEnumValidator([9600, 14400, 19200] as const)
 * if (!isValidBaudRate(value)) {
 *   throw new Error(formatEnumError('baud rate', [9600, 14400, 19200]))
 * }
 * ```
 */

// Re-export all utilities
export * from './codec.js'
export * from './validators.js'
export * from './errors.js'
