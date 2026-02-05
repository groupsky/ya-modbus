import type { Transport } from '@ya-modbus/driver-types'
import { Mutex } from 'async-mutex'
import ModbusRTU from 'modbus-serial'

import type { RTUConfig, TCPConfig, TransportConfig } from './factory.js'
import { SlaveTransport } from './slave-transport.js'

/**
 * Connection pool entry with shared client and mutex
 */
interface ConnectionEntry {
  client: ModbusRTU // Shared modbus-serial client
  mutex: Mutex // Shared mutex for serializing operations
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
 * TransportManager pools modbus-serial clients and provides slave-specific transports.
 *
 * Key behaviors:
 * - Pools modbus-serial clients by physical connection (excluding slave ID)
 * - RTU clients are pooled by bus configuration (port, baud rate, parity, etc.)
 * - TCP clients are pooled by host and port
 * - Returns SlaveTransport instances that set the slave ID before each operation
 * - Multiple devices on the same connection share a single client and mutex
 * - All operations are serialized using async-mutex to prevent race conditions
 *
 * This architecture solves the multi-device problem:
 * - Each device gets its own SlaveTransport with its own slave ID
 * - All devices on the same bus share the same client and mutex
 * - Slave ID is set dynamically before each operation
 * - No more hardcoded slave IDs that affect all devices on a bus
 *
 * IMPORTANT: Shared Resource Ownership
 * Multiple SlaveTransport instances share the same client and mutex. This is
 * intentional and correct:
 * - Shared client: Avoids port contention (can't open serial port twice)
 * - Shared mutex: Ensures serialized access to the bus
 * - SlaveTransport.close(): Does not close shared client (use closeAll() for cleanup)
 */
export class TransportManager {
  private readonly connections = new Map<string, ConnectionEntry>()

  /**
   * Get or create a transport for the given configuration.
   * Returns a new SlaveTransport instance bound to the slave ID in the config.
   * Multiple devices on the same physical connection share the same client and mutex.
   *
   * @param config - RTU or TCP transport configuration
   * @returns SlaveTransport instance for the specific slave device
   */
  async getTransport(config: TransportConfig): Promise<Transport> {
    const key = this.getPhysicalConnectionKey(config)
    const isRTU = this.isRTUConfig(config)

    // Get or create the shared connection
    let entry = this.connections.get(key)
    if (!entry) {
      // Create new client for this physical connection
      const client = isRTU ? await this.createRTUClient(config) : await this.createTCPClient(config)

      entry = {
        client,
        mutex: new Mutex(),
        config,
        isRTU,
      }
      this.connections.set(key, entry)
    }

    // Return a new SlaveTransport for this specific slave
    return new SlaveTransport(
      config.slaveId,
      entry.client,
      entry.mutex,
      config.maxRetries ?? 3,
      config.logger
    )
  }

  /**
   * Get statistics about managed connections
   *
   * @returns Transport statistics
   */
  getStats(): TransportStats {
    const entries = Array.from(this.connections.values())
    return {
      totalTransports: entries.length,
      rtuTransports: entries.filter((e) => e.isRTU).length,
      tcpTransports: entries.filter((e) => !e.isRTU).length,
    }
  }

  /**
   * Close all managed connections and clear the pool.
   * Errors during close are logged but do not stop the process.
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.connections.values()).map(async (entry) => {
      try {
        await new Promise<void>((resolve) => {
          entry.client.close(resolve)
        })
      } catch (error) {
        // Log but don't throw - we want to close all connections
        console.error('Error closing connection:', error)
      }
    })

    await Promise.all(closePromises)
    this.connections.clear()
  }

  /**
   * Generate a unique key for a physical connection.
   * Excludes slave ID so multiple devices on the same bus share a connection.
   * For RTU: Key includes all bus parameters (port, baud, parity, etc.)
   * For TCP: Key includes host and port
   *
   * @param config - Transport configuration
   * @returns Physical connection key string
   */
  private getPhysicalConnectionKey(config: TransportConfig): string {
    if (this.isRTUConfig(config)) {
      return `rtu:${config.port}:${config.baudRate}:${config.dataBits}:${config.parity}:${config.stopBits}`
    }

    // TCP config - safe to access host/port because isRTUConfig returned false
    return `tcp:${config.host}:${config.port ?? 502}`
  }

  /**
   * Create and configure an RTU modbus-serial client.
   * Does NOT set slave ID - that's handled by SlaveTransport.
   *
   * @param config - RTU configuration
   * @returns Connected ModbusRTU client
   */
  private async createRTUClient(config: RTUConfig): Promise<ModbusRTU> {
    const client = new ModbusRTU()

    await client.connectRTUBuffered(config.port, {
      baudRate: config.baudRate,
      dataBits: config.dataBits,
      parity: config.parity,
      stopBits: config.stopBits,
    })

    client.setTimeout(config.timeout ?? 1000)

    return client
  }

  /**
   * Create and configure a TCP modbus-serial client.
   * Does NOT set slave ID - that's handled by SlaveTransport.
   *
   * @param config - TCP configuration
   * @returns Connected ModbusRTU client
   */
  private async createTCPClient(config: TCPConfig): Promise<ModbusRTU> {
    const client = new ModbusRTU()

    await client.connectTCP(config.host, { port: config.port ?? 502 })

    client.setTimeout(config.timeout ?? 1000)

    return client
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
