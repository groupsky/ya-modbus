/**
 * Validation utilities for CLI options
 */

import { ValidationError } from '@ya-modbus/driver-loader'

/**
 * Validate that the options select one transport: RTU or TCP
 *
 * `--port` is the serial port path (RTU) and `--host` is the TCP host. Giving both
 * is ambiguous, so it is rejected instead of silently preferring one. A numeric
 * `port` is a TCP port number and is allowed with a host.
 *
 * `--attempts` must be a whole number of at least 1 and `--retry-delay` a whole number of
 * at least 0.
 *
 * @param options - Connection options to validate
 * @throws ValidationError if both a serial port and a TCP host are specified, or if the
 *   attempts or the retry delay are not valid
 */
export function validateConnectionOptions(options: {
  port?: string | number | undefined
  host?: string | undefined
  attempts?: number | undefined
  retryDelay?: number | undefined
}): void {
  if (
    options.attempts !== undefined &&
    !(Number.isInteger(options.attempts) && options.attempts >= 1)
  ) {
    throw new ValidationError(
      '--attempts must be a whole number of 1 or more (1 sends each request once, with no retry)',
      'attempts',
      options.attempts
    )
  }
  if (
    options.retryDelay !== undefined &&
    !(Number.isInteger(options.retryDelay) && options.retryDelay >= 0)
  ) {
    throw new ValidationError(
      '--retry-delay must be a whole number of milliseconds, 0 or more',
      'retryDelay',
      options.retryDelay
    )
  }
  if (typeof options.port === 'string' && options.host !== undefined) {
    throw new ValidationError(
      'Use either --port (RTU) or --host (TCP), not both',
      'port',
      options.port
    )
  }
}
