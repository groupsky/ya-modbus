import type { BaudRate, DataBits, Parity, StopBits } from '@ya-modbus/driver-types'

/**
 * Standard Modbus baud rates for thorough scanning
 * Ordered by commonality (most common first)
 */
export const STANDARD_BAUD_RATES: readonly BaudRate[] = [
  9600, // Most common
  19200, // Modbus spec default
  14400,
  38400,
  57600,
  115200,
  4800, // Less common
  2400, // Legacy
] as const

/**
 * Common baud rates for quick scanning
 */
export const COMMON_BAUD_RATES: readonly BaudRate[] = [9600, 19200] as const

/**
 * Standard Modbus parity settings
 * Ordered by commonality
 */
export const STANDARD_PARITY: readonly Parity[] = ['none', 'even', 'odd'] as const

/**
 * Standard data bits options
 */
export const STANDARD_DATA_BITS: readonly DataBits[] = [8, 7] as const

/**
 * Common data bits for quick scanning
 */
export const COMMON_DATA_BITS: readonly DataBits[] = [8] as const

/**
 * Standard stop bits options
 */
export const STANDARD_STOP_BITS: readonly StopBits[] = [1, 2] as const

/**
 * Common stop bits for quick scanning
 */
export const COMMON_STOP_BITS: readonly StopBits[] = [1] as const

/**
 * Valid Modbus slave address range (0 is broadcast, 248-255 reserved)
 */
export const MIN_SLAVE_ID = 1
export const MAX_SLAVE_ID = 247
