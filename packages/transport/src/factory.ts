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
 * Type guard to check if config is RTU
 */
function isRTUConfig(config: TransportConfig): config is RTUConfig {
  return 'port' in config && !('host' in config)
}

/**
 * Create a transport instance based on configuration
 *
 * Detects whether to create RTU or TCP transport based on the config:
 * - If `host` is provided → TCP transport (port is optional TCP port number)
 * - If `port` is provided (without `host`) → RTU transport (port is serial port path)
 *
 * @param config - Transport configuration (RTU or TCP)
 * @returns Transport implementation
 * @throws Error if config is invalid
 */
export async function createTransport(config: TransportConfig): Promise<Transport> {
  const hasHost = 'host' in config
  const hasPort = 'port' in config

  // Validate conflicting configuration
  // RTU uses 'port' as a string (serial port path), TCP uses 'port' as optional number
  if (hasHost && hasPort) {
    const portValue = (config as { port?: string | number }).port
    if (typeof portValue === 'string') {
      // Both host (TCP) and port as string (RTU serial port path) are provided
      throw new Error('Cannot specify both port (RTU) and host (TCP)')
    }
  }

  // Check for TCP (has 'host')
  if (hasHost) {
    return createTCPTransport(config)
  }

  // Check for RTU (has 'port' as string, without 'host')
  if (isRTUConfig(config)) {
    return createRTUTransport(config)
  }

  throw new Error('Either port (for RTU) or host (for TCP) must be specified')
}
