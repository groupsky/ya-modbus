import { Mutex } from 'async-mutex'
import type { Transport } from '@ya-modbus/driver-types'
import { createTransport, type TransportConfig } from './factory.js'
import type { RTUConfig, TCPConfig } from './factory.js'
import { MutexTransport } from './mutex-transport.js'

/**
 * Transport pool entry with mutex for RTU bus serialization
 */
interface TransportEntry {
  rawTransport: Transport // Underlying transport
  wrappedTransport: Transport // Mutex-wrapped for RTU, raw for TCP
  mutex?: Mutex
  config: TransportConfig
  isRTU: boolean
  refCount: number
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
 * serialization for RTU (serial bus) operations while allowing concurrent
 * TCP operations.
 *
 * Key behaviors:
 * - RTU transports are pooled by bus configuration (port, baud rate, parity, etc.)
 * - Multiple devices on the same RTU bus share a single transport instance
 * - RTU operations are serialized using async-mutex to prevent bus collisions
 * - TCP transports are NOT pooled - each connection gets a unique instance
 * - TCP operations execute concurrently without locking
 */
export class TransportManager {
  private readonly transports = new Map<string, TransportEntry>()

  /**
   * Get or create a transport for the given configuration.
   * For RTU configs, returns mutex-wrapped shared transport if one exists for the same bus.
   * For TCP configs, always creates a new unwrapped transport instance.
   *
   * @param config - RTU or TCP transport configuration
   * @returns Transport instance (wrapped with mutex for RTU, raw for TCP)
   */
  async getTransport(config: TransportConfig): Promise<Transport> {
    const key = this.getConnectionKey(config)
    const isRTU = this.isRTUConfig(config)

    // For RTU, reuse existing transport if available
    if (isRTU) {
      let entry = this.transports.get(key)
      if (entry) {
        entry.refCount++
        return entry.wrappedTransport
      }

      // Create new RTU transport with mutex wrapper
      const rawTransport = await createTransport(config)
      const mutex = new Mutex()
      const wrappedTransport = new MutexTransport(rawTransport, mutex)

      entry = {
        rawTransport,
        wrappedTransport,
        mutex,
        config,
        isRTU: true,
        refCount: 1,
      }
      this.transports.set(key, entry)
      return wrappedTransport
    }

    // For TCP, always create unique transport (no pooling, no mutex)
    const rawTransport = await createTransport(config)
    const entry: TransportEntry = {
      rawTransport,
      wrappedTransport: rawTransport, // No wrapping for TCP
      config,
      isRTU: false,
      refCount: 1,
    }

    // Use timestamp to ensure unique key for each TCP transport
    const uniqueKey = `${key}:${Date.now()}:${Math.random()}`
    this.transports.set(uniqueKey, entry)

    return rawTransport
  }

  /**
   * Execute an operation with appropriate locking.
   * NOTE: This method is deprecated - RTU transports now automatically
   * apply mutex through MutexTransport wrapper. Kept for backward compatibility.
   *
   * @param transport - The transport to execute operation on
   * @param fn - Async function to execute
   * @returns Result of the operation
   * @deprecated RTU transports are now automatically wrapped with mutex
   */
  async executeWithLock<T>(transport: Transport, fn: () => Promise<T>): Promise<T> {
    // For backward compatibility, just execute the function
    // The mutex is now applied automatically via MutexTransport wrapper
    return fn()
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

    // TCP config - cast is safe because isRTUConfig returned false
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const tcpConfig = config as TCPConfig
    return `tcp:${tcpConfig.host}:${tcpConfig.port ?? 502}`
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
