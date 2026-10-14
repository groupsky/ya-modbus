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
 * @param options - Connection options to validate
 * @throws ValidationError if both a serial port and a TCP host are specified
 */
export function validateConnectionOptions(options: {
  port?: string | number | undefined
  host?: string | undefined
}): void {
  if (typeof options.port === 'string' && options.host !== undefined) {
    throw new ValidationError(
      'Use either --port (RTU) or --host (TCP), not both',
      'port',
      options.port
    )
  }
}
