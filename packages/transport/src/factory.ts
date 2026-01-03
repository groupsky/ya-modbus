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
 * - If `port` is provided → RTU transport
 * - If `host` is provided → TCP transport
 *
 * @param config - Transport configuration (RTU or TCP)
 * @returns Transport implementation
 * @throws Error if config is invalid
 */
export async function createTransport(config: TransportConfig): Promise<Transport> {
  // Validate that exactly one of port/host is provided
  if ('port' in config && 'host' in config) {
    throw new Error('Cannot specify both port (RTU) and host (TCP)')
  }

  if (isRTUConfig(config)) {
    return createRTUTransport(config)
  }

  if ('host' in config) {
    return createTCPTransport(config)
  }

  throw new Error('Either port (for RTU) or host (for TCP) must be specified')
}
