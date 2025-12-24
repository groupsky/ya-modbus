import type { Transport } from '@ya-modbus/driver-types'
import { createRTUTransport, type RTUConfig } from './rtu-transport.js'
import { createTCPTransport, type TCPConfig } from './tcp-transport.js'

/**
 * Combined transport configuration
 * Can be either RTU or TCP, but not both
 */
export type TransportConfig = RTUConfig | TCPConfig

/**
 * Type guard to check if config is RTU
 */
function isRTUConfig(config: TransportConfig): config is RTUConfig {
  return 'port' in config
}

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
 * - If `port` is provided → RTU transport
 * - If `host` is provided → TCP transport
 *
 * @param config - Transport configuration (RTU or TCP)
 * @returns Transport implementation
 * @throws Error if config is invalid
 */
export async function createTransport(config: TransportConfig): Promise<Transport> {
  const hasPort = 'port' in config
  const hasHost = 'host' in config

  // Validate that exactly one of port/host is provided
  if (!hasPort && !hasHost) {
    throw new Error('Either port (for RTU) or host (for TCP) must be specified')
  }

  if (hasPort && hasHost) {
    throw new Error('Cannot specify both port (RTU) and host (TCP)')
  }

  // Create appropriate transport
  if (isRTUConfig(config)) {
    return createRTUTransport(config)
  } else if (isTCPConfig(config)) {
    return createTCPTransport(config)
  } else {
    throw new Error('Invalid transport configuration')
  }
}
