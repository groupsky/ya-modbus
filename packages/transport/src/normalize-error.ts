/**
 * Error normalization for modbus-serial failures
 */

/**
 * Error with the diagnostic properties that modbus-serial attaches to failures
 */
export interface ModbusError extends Error {
  /** Node.js error code (e.g., 'ECONNREFUSED' from a TCP socket) */
  code?: string | undefined
  /** Error number or name (e.g., 'ETIMEDOUT' for a response timeout, -111 from a TCP socket) */
  errno?: string | number | undefined
  /** Modbus exception code returned by the device (e.g., 2 = illegal data address) */
  modbusCode?: number | undefined
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * Convert anything thrown by modbus-serial into an Error
 *
 * modbus-serial rejects with plain objects that do not extend Error
 * (e.g., `{ name: 'TransactionTimedOutError', message: 'Timed out', errno: 'ETIMEDOUT' }`).
 * Converting them with `String()` gives "[object Object]" and loses errno.
 * This keeps message, name, errno, code and modbusCode, and sets the original
 * value as `cause`. Error instances are returned unchanged.
 *
 * @param error - Value that was thrown or used to reject a promise
 * @returns Error instance with the diagnostic properties of the original
 */
export function normalizeModbusError(error: unknown): ModbusError {
  if (error instanceof Error) {
    return error
  }

  if (typeof error !== 'object' || error === null) {
    return new Error(String(error), { cause: error })
  }

  const fields = error as {
    name?: unknown
    message?: unknown
    errno?: unknown
    code?: unknown
    modbusCode?: unknown
  }
  const name = nonEmptyString(fields.name)
  const code = nonEmptyString(fields.code)
  const errno =
    typeof fields.errno === 'string' || typeof fields.errno === 'number' ? fields.errno : undefined
  const modbusCode = typeof fields.modbusCode === 'number' ? fields.modbusCode : undefined

  const normalized: ModbusError = new Error(
    nonEmptyString(fields.message) ??
      code ??
      (errno === undefined ? 'Unknown error' : String(errno)),
    { cause: error }
  )
  if (name !== undefined) normalized.name = name
  if (code !== undefined) normalized.code = code
  if (errno !== undefined) normalized.errno = errno
  if (modbusCode !== undefined) normalized.modbusCode = modbusCode

  return normalized
}
