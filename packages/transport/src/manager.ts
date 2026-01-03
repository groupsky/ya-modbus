import type { Transport } from '@ya-modbus/driver-types'
import { Mutex } from 'async-mutex'

import { createTransport, type TransportConfig } from './factory.js'
import type { RTUConfig } from './factory.js'
import { MutexTransport } from './mutex-transport.js'

/**
 * Transport pool entry with mutex serialization
 */
interface TransportEntry {
  rawTransport: Transport // Underlying transport
  wrappedTransport: Transport // Mutex-wrapped transport
  mutex?: Mutex
  config: TransportConfig
  isRTU: boolean
}

/**
 * Statistics about managed transports
 */
export interface TransportStats {
  totalTransports: number
  rtuTransports: number
  tcpTransports: number
}

/**
 * TransportManager pools transport instances and provides mutex-based
 * serialization for all transport operations to prevent concurrent access issues.
 *
 * Key behaviors:
 * - All transports (RTU and TCP) are pooled by connection configuration
 * - RTU transports are pooled by bus configuration (port, baud rate, parity, etc.)
 * - TCP transports are pooled by host and port
 * - Multiple devices on the same connection share a single transport instance
 * - All operations are serialized using async-mutex to prevent race conditions
 *
 * Why TCP needs mutex protection:
 * - Many Modbus devices allow only one or a limited number of TCP connections
 * - Even with multiple connections, devices often process requests sequentially
 * - Concurrent requests can cause timeouts, dropped packets, or incorrect responses
 * - Serialization ensures reliable communication regardless of device limitations
 */
export class TransportManager {
  private readonly transports = new Map<string, TransportEntry>()

  /**
   * Get or create a transport for the given configuration.
   * Returns mutex-wrapped shared transport if one exists for the same connection.
   *
   * @param config - RTU or TCP transport configuration
   * @returns Transport instance wrapped with mutex for thread-safe operations
   */
  async getTransport(config: TransportConfig): Promise<Transport> {
    const key = this.getConnectionKey(config)
    const isRTU = this.isRTUConfig(config)

    // For RTU, reuse existing transport if available
    if (isRTU) {
      const entry = this.transports.get(key)
      if (entry) {
        return entry.wrappedTransport
      }

      // Create new RTU transport with mutex wrapper
      const rawTransport = await createTransport(config)
      const mutex = new Mutex()
      const wrappedTransport = new MutexTransport(rawTransport, mutex)

      const newEntry: TransportEntry = {
        rawTransport,
        wrappedTransport,
        mutex,
        config,
        isRTU: true,
      }
      this.transports.set(key, newEntry)
      return wrappedTransport
    }

    // For TCP, reuse existing transport if available
    // TCP is pooled like RTU because many devices support only one connection
    // or process requests sequentially even with multiple connections
    const entry = this.transports.get(key)
    if (entry) {
      return entry.wrappedTransport
    }

    // Create new TCP transport with mutex wrapper
    // Mutex prevents concurrent requests that could cause timeouts or errors
    const rawTransport = await createTransport(config)
    const mutex = new Mutex()
    const wrappedTransport = new MutexTransport(rawTransport, mutex)

    const newEntry: TransportEntry = {
      rawTransport,
      wrappedTransport,
      mutex,
      config,
      isRTU: false,
    }
    this.transports.set(key, newEntry)

    return wrappedTransport
  }

  /**
   * Get statistics about managed transports
   *
   * @returns Transport statistics
   */
  getStats(): TransportStats {
    const entries = Array.from(this.transports.values())
    return {
      totalTransports: entries.length,
      rtuTransports: entries.filter((e) => e.isRTU).length,
      tcpTransports: entries.filter((e) => !e.isRTU).length,
    }
  }

  /**
   * Close all managed transports and clear the pool.
   * Errors during close are logged but do not stop the process.
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.transports.values()).map(async (entry) => {
      try {
        await entry.rawTransport.close()
      } catch (error) {
        // Log but don't throw - we want to close all transports
        console.error('Error closing transport:', error)
      }
    })

    await Promise.all(closePromises)
    this.transports.clear()
  }

  /**
   * Generate a unique key for a transport configuration.
   * For RTU: Key includes all bus parameters (port, baud, parity, etc.)
   * For TCP: Key includes host and port
   *
   * @param config - Transport configuration
   * @returns Connection key string
   */
  private getConnectionKey(config: TransportConfig): string {
    if (this.isRTUConfig(config)) {
      return `rtu:${config.port}:${config.baudRate}:${config.dataBits}:${config.parity}:${config.stopBits}`
    }

    // TCP config - safe to access host/port because isRTUConfig returned false
    return `tcp:${config.host}:${config.port ?? 502}`
  }

  /**
   * Type guard to check if config is RTU
   *
   * @param config - Transport configuration
   * @returns True if RTU config
   */
  private isRTUConfig(config: TransportConfig): config is RTUConfig {
    return 'port' in config && typeof config.port === 'string' && !('host' in config)
  }
}
