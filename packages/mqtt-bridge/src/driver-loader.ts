import type { DeviceDriver, CreateDriverFunction, Transport } from '@ya-modbus/driver-types'

import type { DeviceConnection } from './types.js'

type ImportFunction = (packageName: string) => Promise<{ createDriver: CreateDriverFunction }>
type TransportFactory = (connection: DeviceConnection) => Transport

/**
 * Manages dynamic loading and lifecycle of device drivers
 */
export class DriverLoader {
  private driverFactories = new Map<string, CreateDriverFunction>()
  private driverInstances = new Map<string, DeviceDriver>()
  private transports = new Map<string, Transport>()
  private factoryRefCounts = new Map<string, number>()
  private devicePackages = new Map<string, string>()
  private importFn: ImportFunction
  private transportFactory: TransportFactory

  constructor(importFn?: ImportFunction, transportFactory?: TransportFactory) {
    this.importFn =
      importFn ?? ((pkg: string) => import(pkg) as Promise<{ createDriver: CreateDriverFunction }>)
    this.transportFactory = transportFactory ?? this.createMockTransport.bind(this)
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

    const transport = this.transportFactory(connection)

    try {
      const driver = await createDriver({
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

        // Increment factory reference count
        const refCount = this.factoryRefCounts.get(packageName) ?? 0
        this.factoryRefCounts.set(packageName, refCount + 1)
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
    const packageName = this.devicePackages.get(deviceId)

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

      // Decrement factory reference count and cleanup if no longer used
      if (packageName) {
        this.devicePackages.delete(deviceId)

        const refCount = this.factoryRefCounts.get(packageName) ?? 0
        const newRefCount = refCount - 1

        if (newRefCount <= 0) {
          // No more devices using this factory, remove it
          this.driverFactories.delete(packageName)
          this.factoryRefCounts.delete(packageName)
        } else {
          this.factoryRefCounts.set(packageName, newRefCount)
        }
      }
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
   * Create a mock transport that throws errors
   * This is a fallback when no transport factory is provided
   */
  private createMockTransport(_connection: DeviceConnection): Transport {
    const notImplemented = (): never => {
      throw new Error('Transport factory not provided to DriverLoader')
    }

    return {
      readHoldingRegisters: notImplemented,
      readInputRegisters: notImplemented,
      readCoils: notImplemented,
      readDiscreteInputs: notImplemented,
      writeSingleRegister: notImplemented,
      writeMultipleRegisters: notImplemented,
      writeSingleCoil: notImplemented,
      writeMultipleCoils: notImplemented,
      close: notImplemented,
    }
  }
}
