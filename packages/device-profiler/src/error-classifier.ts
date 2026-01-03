/**
 * Error classification for Modbus operations
 */

/**
 * Modbus error types
 */
export enum ErrorType {
  /** Operation timed out */
  Timeout = 'timeout',
  /** CRC or checksum validation failed */
  CRC = 'crc',
  /** Modbus exception code returned by device */
  ModbusException = 'modbus_exception',
  /** Unknown or unclassified error */
  Unknown = 'unknown',
}

/**
 * Classify a Modbus error by examining its message and properties
 *
 * @param error - Error to classify
 * @returns Error classification
 */
export function classifyError(error: Error): ErrorType {
  const message = error.message?.toLowerCase() ?? ''
  const code = (error as NodeJS.ErrnoException).code

  // Check for timeout
  if (message.includes('timeout') || message.includes('timed out') || code === 'ETIMEDOUT') {
    return ErrorType.Timeout
  }

  // Check for CRC/checksum errors
  if (message.includes('crc') || message.includes('checksum')) {
    return ErrorType.CRC
  }

  // Check for Modbus exceptions
  if (
    message.includes('exception') ||
    message.includes('0x02') ||
    /exception\s+\d+/.test(message)
  ) {
    return ErrorType.ModbusException
  }

  return ErrorType.Unknown
}
