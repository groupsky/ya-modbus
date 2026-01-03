import { loadDriver as loadDriverPackage } from '@ya-modbus/driver-loader'
import type { DeviceDriver } from '@ya-modbus/driver-types'
import { TransportManager, type TransportConfig } from '@ya-modbus/transport'

import type { DeviceConnection } from './types.js'

type LoadDriverFunction = typeof loadDriverPackage

/**
 * Manages dynamic loading and lifecycle of device drivers
 * Uses TransportManager to pool RTU transports and prevent bus collisions
 */
export class DriverLoader {
  private readonly driverInstances = new Map<string, DeviceDriver>()
  private readonly devicePackages = new Map<string, string>()
  private readonly loadDriverFn: LoadDriverFunction
  private readonly transportManager: TransportManager

  constructor(loadDriverFn?: LoadDriverFunction, transportManager?: TransportManager) {
    this.loadDriverFn = loadDriverFn ?? loadDriverPackage
    this.transportManager = transportManager ?? new TransportManager()
  }

  /**
   * Load a driver package and create an instance for a device
   *
   * @param packageName - NPM package name (e.g., 'ya-modbus-driver-test')
   * @param connection - Device connection configuration
   * @param deviceId - Unique device identifier for tracking the instance
   * @returns Driver instance
   */
  async loadDriver(
    packageName: string,
    connection: DeviceConnection,
    deviceId?: string
  ): Promise<DeviceDriver> {
    // Security validation: prevent path traversal and code injection
    if (!packageName.startsWith('ya-modbus-driver-')) {
      throw new Error(`Invalid driver package name: must start with 'ya-modbus-driver-'`)
    }
    if (packageName.includes('..') || packageName.includes('/') || packageName.includes('\\')) {
      throw new Error('Invalid driver package name: path traversal not allowed')
    }

    // Load driver package using driver-loader
    const loadedDriver = await this.loadDriverFn({ driverPackage: packageName })

    // Get transport from manager (shared for RTU, unique for TCP)
    const config = this.connectionToTransportConfig(connection)
    const transport = await this.transportManager.getTransport(config)

    // Create driver instance
    const driver = await loadedDriver.createDriver({
      transport,
      slaveId: connection.slaveId,
    })

    // Call initialize if available
    if (driver.initialize) {
      await driver.initialize()
    }

    // Cache instance if deviceId provided
    if (deviceId) {
      this.driverInstances.set(deviceId, driver)
      this.devicePackages.set(deviceId, packageName)
    }

    // Note: Don't close transport on failure - it may be shared by other devices
    // The transport manager will handle cleanup when closeAll() is called
    return driver
  }

  /**
   * Unload a driver instance and clean up resources
   * Note: Transport is managed by TransportManager and not closed here
   *
   * @param deviceId - Device identifier
   */
  async unloadDriver(deviceId: string): Promise<void> {
    const driver = this.driverInstances.get(deviceId)

    if (driver && driver.destroy) {
      await driver.destroy()
    }

    this.driverInstances.delete(deviceId)
    this.devicePackages.delete(deviceId)

    // Note: Transport is managed by TransportManager and shared across devices
    // It will be closed when the entire bridge shuts down via closeAll()
  }

  /**
   * Get a loaded driver instance
   *
   * @param deviceId - Device identifier
   * @returns Driver instance or undefined if not loaded
   */
  getDriver(deviceId: string): DeviceDriver | undefined {
    return this.driverInstances.get(deviceId)
  }

  /**
   * Close all managed transports
   * Should be called when shutting down the bridge
   */
  async closeAllTransports(): Promise<void> {
    await this.transportManager.closeAll()
  }

  /**
   * Convert DeviceConnection to TransportConfig
   *
   * @param connection - Device connection configuration
   * @returns Transport configuration
   */
  private connectionToTransportConfig(connection: DeviceConnection): TransportConfig {
    return connection.type === 'rtu'
      ? {
          port: connection.port,
          baudRate: connection.baudRate,
          dataBits: connection.dataBits,
          parity: connection.parity,
          stopBits: connection.stopBits,
          slaveId: connection.slaveId,
          timeout: connection.timeout,
        }
      : {
          host: connection.host,
          port: connection.port,
          slaveId: connection.slaveId,
          timeout: connection.timeout,
        }
  }
}
