import type { Transport } from '@ya-modbus/driver-types'

import { createRTUTransport, type RTUConfig } from './rtu-transport.js'
import { createTCPTransport, type TCPConfig } from './tcp-transport.js'

// Re-export config types for use by other modules
export type { RTUConfig, TCPConfig }

/**
 * Combined transport configuration
 * Can be either RTU or TCP, but not both
 */
export type TransportConfig = RTUConfig | TCPConfig

/**
 * Type guard to check if config is TCP
 */
function isTCPConfig(config: TransportConfig): config is TCPConfig {
  return 'host' in config
}

/**
 * Create a transport instance based on configuration
 *
 * Detects whether to create RTU or TCP transport based on the config:
 * - If `host` is provided → TCP transport (`port` is the optional TCP port number)
 * - Otherwise, if `port` is provided → RTU transport (`port` is the serial path)
 *
 * @param config - Transport configuration (RTU or TCP)
 * @returns Transport implementation
 * @throws Error if config is invalid
 */
export async function createTransport(config: TransportConfig): Promise<Transport> {
  if (isTCPConfig(config)) {
    // A string `port` is a serial path, which cannot be combined with a TCP host
    if (typeof config.port === 'string') {
      throw new Error('Cannot specify both port (RTU) and host (TCP)')
    }

    return createTCPTransport(config)
  }

  if ('port' in config) {
    return createRTUTransport(config)
  }

  throw new Error('Either port (for RTU) or host (for TCP) must be specified')
}
