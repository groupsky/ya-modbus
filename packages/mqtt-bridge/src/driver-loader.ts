import type { DeviceDriver, CreateDriverFunction, Transport } from '@ya-modbus/driver-types'

import type { DeviceConnection } from './types.js'

type ImportFunction = (packageName: string) => Promise<{ createDriver: CreateDriverFunction }>

/**
 * Manages dynamic loading and lifecycle of device drivers
 */
export class DriverLoader {
  private driverFactories = new Map<string, CreateDriverFunction>()
  private driverInstances = new Map<string, DeviceDriver>()
  private importFn: ImportFunction

  constructor(importFn?: ImportFunction) {
    this.importFn =
      importFn ?? ((pkg: string) => import(pkg) as Promise<{ createDriver: CreateDriverFunction }>)
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
    // Load driver factory if not already loaded
    if (!this.driverFactories.has(packageName)) {
      try {
        // Dynamic import of driver package
        const driverModule = await this.importFn(packageName)

        if (typeof driverModule.createDriver !== 'function') {
          throw new Error(`Driver package ${packageName} does not export createDriver function`)
        }

        this.driverFactories.set(packageName, driverModule.createDriver)
      } catch (error) {
        throw new Error(
          `Failed to load driver package ${packageName}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }

    // Create driver instance
    const createDriver = this.driverFactories.get(packageName)
    if (!createDriver) {
      throw new Error(`Driver factory for ${packageName} not found`)
    }

    const transport = this.createTransport(connection)

    const driver = await createDriver({
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
    }

    return driver
  }

  /**
   * Unload a driver instance and clean up resources
   *
   * @param deviceId - Device identifier
   */
  async unloadDriver(deviceId: string): Promise<void> {
    const driver = this.driverInstances.get(deviceId)

    if (driver) {
      if (driver.destroy) {
        await driver.destroy()
      }

      this.driverInstances.delete(deviceId)
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
   * Create a transport instance from connection configuration
   */
  private createTransport(connection: DeviceConnection): Transport {
    if (connection.type === 'rtu') {
      return {
        type: 'rtu',
        path: connection.port,
        baudRate: connection.baudRate,
        parity: connection.parity ?? 'none',
        dataBits: connection.dataBits ?? 8,
        stopBits: connection.stopBits ?? 1,
      }
    } else {
      return {
        type: 'tcp',
        host: connection.host,
        port: connection.port,
      }
    }
  }
}
