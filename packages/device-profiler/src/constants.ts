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

/** Default batch size for register reads */
export const DEFAULT_BATCH_SIZE = 10

/** Number of bytes per Modbus register */
export const BYTES_PER_REGISTER = 2

/** Minimum interval between progress updates in milliseconds */
export const PROGRESS_UPDATE_INTERVAL_MS = 100
