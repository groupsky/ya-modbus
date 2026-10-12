/**
 * Constants for Modbus device profiling
 */

/** Minimum valid TCP port number */
export const MIN_PORT = 1

/** Maximum valid TCP port number */
export const MAX_PORT = 65535

/** Minimum valid Modbus slave ID */
export const MIN_SLAVE_ID = 1

/** Maximum valid Modbus slave ID */
export const MAX_SLAVE_ID = 247

/** Minimum valid Modbus register address */
export const MIN_REGISTER_ADDRESS = 0

/** Maximum valid Modbus register address (16-bit address field) */
export const MAX_REGISTER_ADDRESS = 65535

/** Minimum registers in one read */
export const MIN_BATCH_SIZE = 1

/** Maximum registers in one FC03/FC04 read (Modbus specification) */
export const MAX_BATCH_SIZE = 125

/** Minimum response timeout in milliseconds */
export const MIN_TIMEOUT_MS = 1

/** Maximum response timeout in milliseconds (largest delay Node.js setTimeout accepts) */
export const MAX_TIMEOUT_MS = 2147483647

/** Default batch size for register reads */
export const DEFAULT_BATCH_SIZE = 10

/** Number of bytes per Modbus register */
export const BYTES_PER_REGISTER = 2

/** Minimum interval between progress updates in milliseconds */
export const PROGRESS_UPDATE_INTERVAL_MS = 100
