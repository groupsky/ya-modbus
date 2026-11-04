import {
  applyDriverDefaults,
  DriverNotFoundError,
  loadDriver as loadDriverPackage,
  ValidationError,
  validateSerialOptions,
  type LoadedDriver,
} from '@ya-modbus/driver-loader'
import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'
import {
  TransportManager,
  type ModbusError,
  type RetryLogger,
  type RTUConfig,
  type TransportConfig,
} from '@ya-modbus/transport'

import { DRIVER_NAME_RULE, getDriverPackageCandidates } from './driver-name.js'
import type { DeviceConnection, RTUConnection } from './types.js'

type LoadDriverFunction = typeof loadDriverPackage

/**
 * Load the first package that is installed for a driver name (see getDriverPackageCandidates)
 *
 * @returns The loaded driver and the name of its package
 * @throws ValidationError if the name is not allowed, or DriverNotFoundError if no package is
 *   installed. A package that is installed but fails to load throws its own error.
 */
async function loadDriverByName(
  name: string,
  loadDriverFn: LoadDriverFunction
): Promise<{ loadedDriver: LoadedDriver; packageName: string }> {
  // Security validation: the name becomes an import specifier, so only npm package names
  // of the allowed driver forms pass (never paths)
  const candidates = getDriverPackageCandidates(name)
  const [first] = candidates
  if (first === undefined) {
    throw new ValidationError(
      `Invalid driver name ${JSON.stringify(name)}: must be ${DRIVER_NAME_RULE}`,
      'driverPackage'
    )
  }

  for (const packageName of candidates) {
    try {
      return { loadedDriver: await loadDriverFn({ driverPackage: packageName }), packageName }
    } catch (error) {
      // Try the next form only when this package is not installed at all
      if (!(error instanceof DriverNotFoundError) || error.cause !== undefined) throw error
      if (candidates.length === 1) throw error
    }
  }

  throw new DriverNotFoundError(
    `Driver ${JSON.stringify(name)} not found: none of ${candidates.join(', ')} is installed`,
    first
  )
}

/**
 * Pause in ms before a request to a device after a request to another device on its port. Some
 * meters do not answer a request that comes sooner (DDS519MR: 50 ms fails, 100 ms works).
 */
const DEFAULT_INTER_DEVICE_DELAY_MS = 150

/**
 * Log of requests that the transport sends again, with YA_MODBUS_DEBUG=1. Without it, a request
 * that works on a later try is not seen, even when every try waits for the timeout.
 */
function retryLogger(device: string): RetryLogger | undefined {
  if (process.env['YA_MODBUS_DEBUG'] !== '1') return undefined
  return (attempt, error) => {
    console.warn(
      `Device ${device}: request failed (try ${attempt}), sending it again: ${error.message}`
    )
  }
}

/**
 * Transport config of an RTU connection. Serial settings that are not set come from the driver's
 * DEFAULT_CONFIG. A driver without one gets 8 data bits, no parity and 1 stop bit, and needs
 * `baudRate`. The final settings are checked against the driver's SUPPORTED_CONFIG.
 *
 * @throws ValidationError if the driver does not support a setting
 */
function toRTUConfig(
  connection: RTUConnection,
  driver: LoadedDriver,
  packageName: string
): RTUConfig {
  const merged = applyDriverDefaults(connection, driver)

  if (merged.baudRate === undefined) {
    throw new Error(`baudRate is required: ${packageName} has no DEFAULT_CONFIG`)
  }

  const config: RTUConfig = {
    port: merged.port,
    baudRate: merged.baudRate,
    dataBits: merged.dataBits ?? 8,
    parity: merged.parity ?? 'none',
    stopBits: merged.stopBits ?? 1,
    slaveId: merged.slaveId,
    timeout: merged.timeout,
    maxRetries: connection.attempts,
    retryDelay: connection.retryDelay,
    interDeviceDelay: merged.interDeviceDelay ?? DEFAULT_INTER_DEVICE_DELAY_MS,
  }
  validateSerialOptions(config, driver)

  return config
}

/**
 * Check a device as DriverLoader.loadDriver() does, but without opening a port or creating the
 * driver: the driver name, that its package loads, and the serial settings against the driver.
 *
 * @throws Error if the name is not a driver name, the package does not load, or the
 *   driver does not support a serial setting or the slave ID
 */
export async function checkDriver(
  driverName: string,
  connection: DeviceConnection,
  loadDriverFn: LoadDriverFunction = loadDriverPackage
): Promise<void> {
  const { loadedDriver, packageName } = await loadDriverByName(driverName, loadDriverFn)
  if (connection.type === 'rtu') toRTUConfig(connection, loadedDriver, packageName)
}

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
  private readonly deviceTransportConfigs = new Map<string, TransportConfig>()
  private readonly loadDriverFn: LoadDriverFunction
  private readonly transportManager: TransportManager

  constructor(loadDriverFn?: LoadDriverFunction, transportManager?: TransportManager) {
    this.loadDriverFn = loadDriverFn ?? loadDriverPackage
    this.transportManager = transportManager ?? new TransportManager({ startLost: true })
  }

  /**
   * Load a driver package and create an instance for a device
   *
   * @param driverName - Short driver name (e.g., 'xymd1', which loads '@ya-modbus/driver-xymd1',
   *   else 'ya-modbus-driver-xymd1') or npm package name (e.g., '@ya-modbus/driver-xymd1',
   *   'ya-modbus-driver-test' or '@org/ya-modbus-driver-test'). The package that a short name
   *   loads is logged.
   * @param connection - Device connection configuration. Serial settings that it does not set
   *   come from the driver (see toRTUConfig). The settings used are logged.
   * @param deviceId - Unique device identifier for tracking the instance. Without it,
   *   unloadDriver() cannot release the transport, and its port stays open until
   *   closeAllTransports().
   * @returns Driver instance
   * @throws ValidationError if the name is not allowed, or the driver does not support a serial
   *   setting or the slave ID
   * @throws DriverNotFoundError if no package of the name is installed
   */
  async loadDriver(
    driverName: string,
    connection: DeviceConnection,
    deviceId?: string
  ): Promise<DeviceDriver> {
    const { loadedDriver, packageName } = await loadDriverByName(driverName, this.loadDriverFn)

    const device = deviceId ?? packageName
    if (packageName !== driverName) console.log(`Device ${device} uses driver ${packageName}`)
    let config: TransportConfig
    if (connection.type === 'rtu') {
      config = {
        ...toRTUConfig(connection, loadedDriver, packageName),
        logger: retryLogger(device),
      }
      console.log(
        `Device ${device} uses ${config.port}: baud rate ${config.baudRate}, ` +
          `data bits ${config.dataBits}, parity ${config.parity}, stop bits ${config.stopBits}, ` +
          `inter-device delay ${config.interDeviceDelay} ms`
      )
    } else {
      config = {
        host: connection.host,
        port: connection.port,
        slaveId: connection.slaveId,
        timeout: connection.timeout,
        maxRetries: connection.attempts,
        retryDelay: connection.retryDelay,
        logger: retryLogger(device),
      }
    }

    // Get transport from manager (shared for RTU, unique for TCP)
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
      this.deviceTransportConfigs.set(deviceId, config)
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
      this.deviceTransportConfigs.delete(deviceId)
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
   * Get the error of the connection of a device that is lost, for example because its port could
   * not be opened when the driver was loaded
   *
   * @param deviceId - Device identifier
   * @returns The error that requests on the connection reject with, or undefined while it works
   *   or when the device is not loaded
   */
  getConnectionError(deviceId: string): ModbusError | undefined {
    const config = this.deviceTransportConfigs.get(deviceId)
    return config && this.transportManager.getConnectionError(config)
  }

  /**
   * Close all managed transports
   * Should be called when shutting down the bridge
   */
  async closeAllTransports(): Promise<void> {
    await this.transportManager.closeAll()
  }
}
