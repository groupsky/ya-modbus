import {
  assertValidDriverPackageName,
  loadDriver as loadDriverPackage,
} from '@ya-modbus/driver-loader'
import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'
import { TransportManager, type ModbusError, type TransportConfig } from '@ya-modbus/transport'

import type { DeviceConnection } from './types.js'

type LoadDriverFunction = typeof loadDriverPackage

/**
 * Manages dynamic loading and lifecycle of device drivers
 * Uses TransportManager to pool RTU transports and prevent bus collisions
 *
 * A port that cannot be opened (for example a USB adapter that is not plugged in) does not
 * stop a driver from loading, unless the driver uses the port while it loads. The connection
 * starts lost, and a later poll opens the port (see getConnectionError).
 *
 * A device that is unloaded releases its transport, so the port closes when no other device
 * uses it.
 */
export class DriverLoader {
  private readonly driverInstances = new Map<string, DeviceDriver>()
  private readonly devicePackages = new Map<string, string>()
  private readonly deviceTransports = new Map<string, Transport>()
  private readonly loadDriverFn: LoadDriverFunction
  private readonly transportManager: TransportManager

  constructor(loadDriverFn?: LoadDriverFunction, transportManager?: TransportManager) {
    this.loadDriverFn = loadDriverFn ?? loadDriverPackage
    this.transportManager = transportManager ?? new TransportManager({ startLost: true })
  }

  /**
   * Load a driver package and create an instance for a device
   *
   * @param packageName - NPM package name (e.g., '@ya-modbus/driver-xymd1', 'ya-modbus-driver-test'
   *   or '@org/ya-modbus-driver-test')
   * @param connection - Device connection configuration
   * @param deviceId - Unique device identifier for tracking the instance. Without it,
   *   unloadDriver() cannot release the transport, and its port stays open until
   *   closeAllTransports().
   * @returns Driver instance
   */
  async loadDriver(
    packageName: string,
    connection: DeviceConnection,
    deviceId?: string
  ): Promise<DeviceDriver> {
    // Security validation: the name becomes an import specifier, so only npm package names
    // of the allowed driver forms pass (never paths)
    assertValidDriverPackageName(packageName)

    // Load driver package using driver-loader
    const loadedDriver = await this.loadDriverFn({ driverPackage: packageName })

    // Get transport from manager (shared for RTU, unique for TCP)
    const config = this.connectionToTransportConfig(connection)
    const transport = await this.transportManager.getTransport(config)

    let driver: DeviceDriver
    try {
      // Create driver instance
      driver = await loadedDriver.createDriver({
        transport,
        slaveId: connection.slaveId,
      })

      // Call initialize if available
      if (driver.initialize) {
        await driver.initialize()
      }
    } catch (error) {
      // The port closes unless other devices use it
      await this.transportManager.releaseTransport(transport)
      throw error
    }

    // Cache instance if deviceId provided
    if (deviceId) {
      this.driverInstances.set(deviceId, driver)
      this.devicePackages.set(deviceId, packageName)
      this.deviceTransports.set(deviceId, transport)
    }

    return driver
  }

  /**
   * Unload a driver instance and release its transport. The port closes when no other device
   * uses it.
   *
   * @param deviceId - Device identifier
   */
  async unloadDriver(deviceId: string): Promise<void> {
    const driver = this.driverInstances.get(deviceId)
    const transport = this.deviceTransports.get(deviceId)

    try {
      if (driver?.destroy) {
        await driver.destroy()
      }
    } finally {
      // Always remove from cache and release the transport, even if destroy fails
      this.driverInstances.delete(deviceId)
      this.devicePackages.delete(deviceId)
      this.deviceTransports.delete(deviceId)
      if (transport) await this.transportManager.releaseTransport(transport)
    }
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
   * Get the error of a connection that is lost, for example because its port could not be
   * opened when the driver was loaded
   *
   * @param connection - Device connection configuration
   * @returns The error that requests on the connection reject with, or undefined while it works
   */
  getConnectionError(connection: DeviceConnection): ModbusError | undefined {
    return this.transportManager.getConnectionError(this.connectionToTransportConfig(connection))
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
