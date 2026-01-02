import { loadDriver as loadDriverPackage } from '@ya-modbus/driver-loader'
import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'
import { createTransport, type TransportConfig } from '@ya-modbus/transport'

import type { DeviceConnection } from './types.js'

type LoadDriverFunction = typeof loadDriverPackage
type TransportFactory = (connection: DeviceConnection) => Promise<Transport>

/**
 * Manages dynamic loading and lifecycle of device drivers
 */
export class DriverLoader {
  private driverInstances = new Map<string, DeviceDriver>()
  private transports = new Map<string, Transport>()
  private devicePackages = new Map<string, string>()
  private loadDriverFn: LoadDriverFunction
  private transportFactory: TransportFactory

  constructor(loadDriverFn?: LoadDriverFunction, transportFactory?: TransportFactory) {
    this.loadDriverFn = loadDriverFn ?? loadDriverPackage
    this.transportFactory = transportFactory ?? this.createDefaultTransport.bind(this)
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

    // Create transport
    const transport = await this.transportFactory(connection)

    try {
      // Create driver instance
      const driver = await loadedDriver.createDriver({
        transport,
        slaveId: connection.slaveId,
      })

      // Call initialize if available
      if (driver.initialize) {
        await driver.initialize()
      }

      // Cache instance and transport if deviceId provided
      if (deviceId) {
        this.driverInstances.set(deviceId, driver)
        this.transports.set(deviceId, transport)
        this.devicePackages.set(deviceId, packageName)
      }

      return driver
    } catch (error) {
      // Clean up transport on failure to prevent resource leak
      await transport.close()
      throw error
    }
  }

  /**
   * Unload a driver instance and clean up resources
   *
   * @param deviceId - Device identifier
   */
  async unloadDriver(deviceId: string): Promise<void> {
    const driver = this.driverInstances.get(deviceId)
    const transport = this.transports.get(deviceId)

    try {
      if (driver) {
        if (driver.destroy) {
          await driver.destroy()
        }

        this.driverInstances.delete(deviceId)
      }
    } finally {
      // Always close transport to prevent resource leak
      if (transport) {
        await transport.close()
        this.transports.delete(deviceId)
      }

      this.devicePackages.delete(deviceId)
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
   * Create a transport using the transport package
   * Converts DeviceConnection to TransportConfig
   */
  private async createDefaultTransport(connection: DeviceConnection): Promise<Transport> {
    // Convert DeviceConnection to TransportConfig
    const config: TransportConfig =
      connection.type === 'rtu'
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

    return createTransport(config)
  }
}
