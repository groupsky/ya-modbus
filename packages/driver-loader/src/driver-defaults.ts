/**
 * Driver defaults for connection options: DEFAULT_CONFIG and SUPPORTED_CONFIG of the driver,
 * or of the selected device in its DEVICES registry
 */

import type { DefaultSerialConfig } from '@ya-modbus/driver-types'

import type { LoadedDriver } from './loader.js'

/**
 * Connection options that driver defaults apply to
 *
 * `host` marks a TCP connection, which serial defaults do not apply to.
 */
export interface SerialOptions {
  host?: string
  baudRate?: number
  dataBits?: number
  parity?: string
  stopBits?: number
  slaveId?: number
}

/**
 * Get the effective default config for a device
 *
 * Returns device-specific config if available, otherwise driver-level config.
 *
 * @param driverMetadata - Loaded driver metadata
 * @param device - Optional device key
 * @returns Effective default config or undefined
 */
export function getEffectiveDefaultConfig(
  driverMetadata: LoadedDriver | undefined,
  device: string | undefined
): DefaultSerialConfig | undefined {
  if (!driverMetadata) {
    return undefined
  }

  // Check for device-specific config first
  if (device && driverMetadata.devices?.[device]?.defaultConfig) {
    const deviceConfig = driverMetadata.devices[device].defaultConfig
    if (deviceConfig && 'baudRate' in deviceConfig) {
      return deviceConfig
    }
  }

  // Fall back to driver-level config
  const driverConfig = driverMetadata.defaultConfig
  if (driverConfig && 'baudRate' in driverConfig) {
    return driverConfig
  }

  return undefined
}

/**
 * Get the effective supported config for a device
 *
 * Returns device-specific constraints if available, otherwise driver-level constraints.
 *
 * @param driverMetadata - Loaded driver metadata
 * @param device - Optional device key
 * @returns Effective supported config or undefined
 */
export function getEffectiveSupportedConfig(
  driverMetadata: LoadedDriver | undefined,
  device: string | undefined
): LoadedDriver['supportedConfig'] | undefined {
  if (!driverMetadata) {
    return undefined
  }

  // Check for device-specific config first
  if (device && driverMetadata.devices?.[device]?.supportedConfig) {
    return driverMetadata.devices[device].supportedConfig
  }

  // Fall back to driver-level config
  return driverMetadata.supportedConfig
}

/**
 * Create an effective driver metadata with device-specific configs resolved
 *
 * This creates a view of the driver metadata where defaultConfig and supportedConfig
 * are resolved based on the selected device. This allows validation and other
 * functions to work with device-specific settings transparently.
 *
 * @param driverMetadata - Loaded driver metadata
 * @param device - Optional device key
 * @returns Driver metadata with effective configs for the selected device
 */
export function getEffectiveDriverMetadata(
  driverMetadata: LoadedDriver,
  device?: string
): LoadedDriver {
  const effectiveDefaultConfig = getEffectiveDefaultConfig(driverMetadata, device)
  const effectiveSupportedConfig = getEffectiveSupportedConfig(driverMetadata, device)

  // Build result conditionally to satisfy exactOptionalPropertyTypes
  const result: LoadedDriver = {
    createDriver: driverMetadata.createDriver,
  }

  if (driverMetadata.devices) {
    result.devices = driverMetadata.devices
  }

  if (effectiveDefaultConfig) {
    result.defaultConfig = effectiveDefaultConfig
  }

  if (effectiveSupportedConfig) {
    result.supportedConfig = effectiveSupportedConfig
  }

  return result
}

/**
 * Apply driver defaults to transport options
 *
 * Uses device-specific defaults if a device is selected, otherwise driver-level defaults.
 *
 * @param options - Transport options (may be incomplete)
 * @param driverMetadata - Loaded driver metadata with defaults
 * @param device - Optional device key for multi-device drivers
 * @returns Transport options with defaults applied
 */
export function applyDriverDefaults<T extends SerialOptions>(
  options: T,
  driverMetadata?: LoadedDriver,
  device?: string
): T {
  // For TCP connections, no serial defaults apply
  if (options.host) {
    return options
  }

  // Get effective config (device-specific or driver-level)
  const defaultConfig = getEffectiveDefaultConfig(driverMetadata, device)

  if (!defaultConfig) {
    return options
  }

  // Apply defaults for unspecified options
  return {
    ...options,
    baudRate: options.baudRate ?? defaultConfig.baudRate,
    dataBits: options.dataBits ?? defaultConfig.dataBits,
    stopBits: options.stopBits ?? defaultConfig.stopBits,
    parity: options.parity ?? defaultConfig.parity,
    slaveId: options.slaveId ?? defaultConfig.defaultAddress,
  }
}
