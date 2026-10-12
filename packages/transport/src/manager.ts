import type { Transport } from '@ya-modbus/driver-types'
import { Mutex } from 'async-mutex'
import ModbusRTU from 'modbus-serial'

import { connectTCP, DEFAULT_TIMEOUT_MS } from './client-config.js'
import { ModbusConnection } from './connection.js'
import type { RTUConfig, TCPConfig, TransportConfig } from './factory.js'
import { normalizeModbusError, type ModbusError } from './normalize-error.js'
import { SlaveTransport } from './slave-transport.js'

/**
 * Connection pool entry with shared connection and mutex
 */
interface ConnectionEntry {
  connection: ModbusConnection // Shared modbus-serial client, reopened when lost
  mutex: Mutex // Shared mutex for serializing operations
  config: TransportConfig
  isRTU: boolean
}

/**
 * Options for TransportManager
 */
export interface TransportManagerOptions {
  /**
   * Return a transport also when its port cannot be opened (for example a USB serial adapter
   * that is not plugged in). The connection then starts lost: requests reject with a
   * ConnectionLostError, and a request after the reopen delay opens the port (see
   * ModbusConnection). getConnectionError() returns the error.
   *
   * Default: false, getTransport() rejects when the port cannot be opened.
   */
  startLost?: boolean
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
 * - A lost connection (USB adapter unplugged, TCP connection closed) drops the client.
 *   The first request after a backoff opens a new client for all devices on the
 *   connection (see ModbusConnection)
 * - With the `startLost` option, a port that cannot be opened (USB adapter missing at
 *   start) gives a lost connection instead of an error
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
  // Connections that are opening, so that devices added at the same time share one client
  private readonly opening = new Map<string, Promise<ConnectionEntry>>()

  constructor(private readonly options: TransportManagerOptions = {}) {}

  /**
   * Get or create a transport for the given configuration.
   * Returns a new SlaveTransport instance bound to the slave ID in the config.
   * Multiple devices on the same physical connection share the same client and mutex.
   *
   * @param config - RTU or TCP transport configuration
   * @returns SlaveTransport instance for the specific slave device
   * @throws When the port cannot be opened, unless the `startLost` option is set
   */
  async getTransport(config: TransportConfig): Promise<Transport> {
    const key = this.getPhysicalConnectionKey(config)

    // Get or create the shared connection
    let entry = this.connections.get(key)
    if (!entry) {
      let opening = this.opening.get(key)
      if (!opening) {
        opening = this.openConnection(key, config).finally(() => this.opening.delete(key))
        this.opening.set(key, opening)
      }
      entry = await opening
    }

    // Return a new SlaveTransport for this specific slave
    return new SlaveTransport(
      config.slaveId,
      entry.connection,
      entry.mutex,
      config.maxRetries ?? 3,
      config.logger
    )
  }

  /**
   * Open the shared connection for a physical connection and add it to the pool
   *
   * @param key - Physical connection key
   * @param config - Transport configuration
   * @returns The pool entry
   */
  private async openConnection(key: string, config: TransportConfig): Promise<ConnectionEntry> {
    const isRTU = this.isRTUConfig(config)
    const open = isRTU ? () => this.createRTUClient(config) : () => this.createTCPClient(config)
    const target = this.getTarget(config)

    let connection: ModbusConnection
    try {
      connection = new ModbusConnection(await open(), target, open)
    } catch (error) {
      if (!this.options.startLost) throw error
      connection = new ModbusConnection(normalizeModbusError(error), target, open)
    }

    const entry = { connection, mutex: new Mutex(), config, isRTU }
    this.connections.set(key, entry)
    return entry
  }

  /**
   * Get the error of a lost connection
   *
   * @param config - Configuration of a transport on the connection
   * @returns The error that requests on the connection reject with while it is lost.
   *   Undefined while the connection works, or when there is no connection for the config.
   */
  getConnectionError(config: TransportConfig): ModbusError | undefined {
    return this.connections.get(this.getPhysicalConnectionKey(config))?.connection.error
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
    // A connection that is still opening is added to the pool when it opens. More opens can
    // start while this waits.
    while (this.opening.size > 0) await Promise.allSettled(this.opening.values())

    // Clear the pool first: a connection that opens while these close stays in the pool,
    // so the next closeAll() closes it
    const entries = Array.from(this.connections.values())
    this.connections.clear()

    const closePromises = entries.map(async (entry) => {
      try {
        await entry.connection.close()
      } catch (error) {
        // Log but don't throw - we want to close all connections
        console.error('Error closing connection:', error)
      }
    })

    await Promise.all(closePromises)
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
   * Describe a physical connection for error messages
   *
   * @param config - Transport configuration
   * @returns Serial port path for RTU, host:port for TCP
   */
  private getTarget(config: TransportConfig): string {
    return this.isRTUConfig(config) ? config.port : `${config.host}:${config.port ?? 502}`
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

    client.setTimeout(config.timeout ?? DEFAULT_TIMEOUT_MS)

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

    await connectTCP(client, config.host, config.port ?? 502, config.timeout)

    client.setTimeout(config.timeout ?? DEFAULT_TIMEOUT_MS)

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
