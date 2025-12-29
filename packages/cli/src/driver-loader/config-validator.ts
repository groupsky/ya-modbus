/**
 * Runtime validation for driver configuration exports
 *
 * Validates DEFAULT_CONFIG, SUPPORTED_CONFIG, and DEVICES from third-party drivers
 * to ensure type safety at runtime.
 */

import type { DefaultConfig, DeviceRegistry, SupportedConfig } from '@ya-modbus/driver-types'

/**
 * Validate DEFAULT_CONFIG export from a driver module
 *
 * @param config - The DEFAULT_CONFIG value to validate
 * @returns Validated config
 * @throws Error with helpful message if validation fails
 */
export function validateDefaultConfig(config: unknown): DefaultConfig {
  if (config === null || config === undefined || typeof config !== 'object') {
    throw new Error(
      'Invalid DEFAULT_CONFIG: must be an object.\n' +
        'Fix: export const DEFAULT_CONFIG = { baudRate: 9600, ... }'
    )
  }

  const configObj = config as Record<string, unknown>

  // Check if it's a serial config (has baudRate)
  if ('baudRate' in configObj) {
    validateSerialDefaultConfig(configObj)
  }
  // Check if it's a TCP config (has defaultPort but not baudRate)
  else if ('defaultPort' in configObj) {
    validateTcpDefaultConfig(configObj)
  } else {
    throw new Error(
      'Invalid DEFAULT_CONFIG: must have either "baudRate" (serial) or "defaultPort" (TCP).\n' +
        'Fix: export const DEFAULT_CONFIG = { baudRate: 9600, ... } // for serial\n' +
        'Or:  export const DEFAULT_CONFIG = { defaultPort: 502, ... } // for TCP'
    )
  }

  return config as DefaultConfig
}

/**
 * Validate serial DEFAULT_CONFIG properties
 */
function validateSerialDefaultConfig(config: Record<string, unknown>): void {
  if (typeof config['baudRate'] !== 'number') {
    throw new Error(
      `Invalid DEFAULT_CONFIG: baudRate must be a number, got ${typeof config['baudRate']}.\n` +
        'Fix: export const DEFAULT_CONFIG = { baudRate: 9600, ... } // number, not string'
    )
  }

  if ('parity' in config && typeof config['parity'] !== 'string') {
    throw new Error(
      `Invalid DEFAULT_CONFIG: parity must be a string, got ${typeof config['parity']}.\n` +
        'Fix: export const DEFAULT_CONFIG = { parity: "even", ... } // string: "none", "even", or "odd"'
    )
  }

  if ('dataBits' in config && typeof config['dataBits'] !== 'number') {
    throw new Error(
      `Invalid DEFAULT_CONFIG: dataBits must be a number, got ${typeof config['dataBits']}.\n` +
        'Fix: export const DEFAULT_CONFIG = { dataBits: 8, ... } // number: 7 or 8'
    )
  }

  if ('stopBits' in config && typeof config['stopBits'] !== 'number') {
    throw new Error(
      `Invalid DEFAULT_CONFIG: stopBits must be a number, got ${typeof config['stopBits']}.\n` +
        'Fix: export const DEFAULT_CONFIG = { stopBits: 1, ... } // number: 1 or 2'
    )
  }

  if ('defaultAddress' in config && typeof config['defaultAddress'] !== 'number') {
    throw new Error(
      `Invalid DEFAULT_CONFIG: defaultAddress must be a number, got ${typeof config['defaultAddress']}.\n` +
        'Fix: export const DEFAULT_CONFIG = { defaultAddress: 1, ... } // number: 1-247'
    )
  }
}

/**
 * Validate TCP DEFAULT_CONFIG properties
 */
function validateTcpDefaultConfig(config: Record<string, unknown>): void {
  if (typeof config['defaultPort'] !== 'number') {
    throw new Error(
      `Invalid DEFAULT_CONFIG: defaultPort must be a number, got ${typeof config['defaultPort']}.\n` +
        'Fix: export const DEFAULT_CONFIG = { defaultPort: 502, ... } // number'
    )
  }

  if ('defaultAddress' in config && typeof config['defaultAddress'] !== 'number') {
    throw new Error(
      `Invalid DEFAULT_CONFIG: defaultAddress must be a number, got ${typeof config['defaultAddress']}.\n` +
        'Fix: export const DEFAULT_CONFIG = { defaultAddress: 1, ... } // number: 1-247'
    )
  }
}

/**
 * Validate SUPPORTED_CONFIG export from a driver module
 *
 * @param config - The SUPPORTED_CONFIG value to validate
 * @returns Validated config
 * @throws Error with helpful message if validation fails
 */
export function validateSupportedConfig(config: unknown): SupportedConfig {
  if (config === null || config === undefined || typeof config !== 'object') {
    throw new Error(
      'Invalid SUPPORTED_CONFIG: must be an object.\n' +
        'Fix: export const SUPPORTED_CONFIG = { validBaudRates: [9600, 19200], ... }'
    )
  }

  const configObj = config as Record<string, unknown>

  if ('validBaudRates' in configObj && !Array.isArray(configObj['validBaudRates'])) {
    throw new Error(
      `Invalid SUPPORTED_CONFIG: validBaudRates must be an array, got ${typeof configObj['validBaudRates']}.\n` +
        'Fix: export const SUPPORTED_CONFIG = { validBaudRates: [9600, 19200], ... }'
    )
  }

  if ('validParity' in configObj && !Array.isArray(configObj['validParity'])) {
    throw new Error(
      `Invalid SUPPORTED_CONFIG: validParity must be an array, got ${typeof configObj['validParity']}.\n` +
        'Fix: export const SUPPORTED_CONFIG = { validParity: ["none", "even", "odd"], ... }'
    )
  }

  if ('validDataBits' in configObj && !Array.isArray(configObj['validDataBits'])) {
    throw new Error(
      `Invalid SUPPORTED_CONFIG: validDataBits must be an array, got ${typeof configObj['validDataBits']}.\n` +
        'Fix: export const SUPPORTED_CONFIG = { validDataBits: [7, 8], ... }'
    )
  }

  if ('validStopBits' in configObj && !Array.isArray(configObj['validStopBits'])) {
    throw new Error(
      `Invalid SUPPORTED_CONFIG: validStopBits must be an array, got ${typeof configObj['validStopBits']}.\n` +
        'Fix: export const SUPPORTED_CONFIG = { validStopBits: [1, 2], ... }'
    )
  }

  if ('validAddressRange' in configObj) {
    if (!Array.isArray(configObj['validAddressRange'])) {
      throw new Error(
        `Invalid SUPPORTED_CONFIG: validAddressRange must be an array, got ${typeof configObj['validAddressRange']}.\n` +
          'Fix: export const SUPPORTED_CONFIG = { validAddressRange: [1, 247], ... }'
      )
    }

    const range = configObj['validAddressRange'] as unknown[]
    if (range.length !== 2) {
      throw new Error(
        `Invalid SUPPORTED_CONFIG: validAddressRange must be a 2-element array [min, max], got ${range.length} elements.\n` +
          'Fix: export const SUPPORTED_CONFIG = { validAddressRange: [1, 247], ... }'
      )
    }
  }

  if ('validPorts' in configObj && !Array.isArray(configObj['validPorts'])) {
    throw new Error(
      `Invalid SUPPORTED_CONFIG: validPorts must be an array, got ${typeof configObj['validPorts']}.\n` +
        'Fix: export const SUPPORTED_CONFIG = { validPorts: [502], ... }'
    )
  }

  return config as SupportedConfig
}

/**
 * Validate DEVICES export from a driver module
 *
 * @param devices - The DEVICES value to validate
 * @returns Validated devices registry
 * @throws Error with helpful message if validation fails
 */
export function validateDevices(devices: unknown): DeviceRegistry {
  if (devices === null || devices === undefined || typeof devices !== 'object') {
    throw new Error(
      'Invalid DEVICES: must be an object.\n' +
        "Fix: export const DEVICES = { 'device-key': { manufacturer: 'Acme', model: 'X1' } }"
    )
  }

  if (Array.isArray(devices)) {
    throw new Error(
      'Invalid DEVICES: must be an object, not an array.\n' +
        "Fix: export const DEVICES = { 'device-key': { manufacturer: 'Acme', model: 'X1' } }"
    )
  }

  const devicesObj = devices as Record<string, unknown>
  const entries = Object.entries(devicesObj)

  if (entries.length === 0) {
    throw new Error(
      'Invalid DEVICES: must contain at least one device.\n' +
        "Fix: export const DEVICES = { 'device-key': { manufacturer: 'Acme', model: 'X1' } }"
    )
  }

  // Validate each device entry
  for (const [key, device] of entries) {
    if (device === null || device === undefined || typeof device !== 'object') {
      throw new Error(
        `Invalid DEVICES["${key}"]: must be an object.\n` +
          `Fix: DEVICES["${key}"] = { manufacturer: 'Acme', model: 'X1' }`
      )
    }

    const deviceObj = device as Record<string, unknown>

    if (typeof deviceObj['manufacturer'] !== 'string') {
      throw new Error(
        `Invalid DEVICES["${key}"]: manufacturer must be a string.\n` +
          `Fix: DEVICES["${key}"] = { manufacturer: 'Acme', ... }`
      )
    }

    if (typeof deviceObj['model'] !== 'string') {
      throw new Error(
        `Invalid DEVICES["${key}"]: model must be a string.\n` +
          `Fix: DEVICES["${key}"] = { model: 'X1', ... }`
      )
    }

    if ('description' in deviceObj && typeof deviceObj['description'] !== 'string') {
      throw new Error(
        `Invalid DEVICES["${key}"]: description must be a string.\n` +
          `Fix: DEVICES["${key}"] = { description: 'A device', ... }`
      )
    }

    // Validate nested defaultConfig if present
    if ('defaultConfig' in deviceObj && deviceObj['defaultConfig'] !== undefined) {
      try {
        validateDefaultConfig(deviceObj['defaultConfig'])
      } catch (error) {
        throw new Error(`Invalid DEVICES["${key}"].defaultConfig: ${(error as Error).message}`)
      }
    }

    // Validate nested supportedConfig if present
    if ('supportedConfig' in deviceObj && deviceObj['supportedConfig'] !== undefined) {
      try {
        validateSupportedConfig(deviceObj['supportedConfig'])
      } catch (error) {
        throw new Error(`Invalid DEVICES["${key}"].supportedConfig: ${(error as Error).message}`)
      }
    }
  }

  return devices as DeviceRegistry
}

/**
 * Cross-validate DEFAULT_CONFIG against SUPPORTED_CONFIG constraints
 *
 * Checks that all DEFAULT_CONFIG values are within SUPPORTED_CONFIG constraints.
 * This helps catch driver authoring errors where defaults don't match declared support.
 *
 * @param defaultConfig - The validated DEFAULT_CONFIG
 * @param supportedConfig - The validated SUPPORTED_CONFIG
 * @returns Array of warning messages for any inconsistencies found (empty if all valid)
 *
 * @example
 * const warnings = crossValidateConfigs(
 *   { baudRate: 115200, parity: 'even', dataBits: 8, stopBits: 1, defaultAddress: 1 },
 *   { validBaudRates: [9600], validParity: ['even', 'odd'] }
 * )
 * // Returns: ['baudRate: 115200 is not in validBaudRates: [9600]']
 */
export function crossValidateConfigs(
  defaultConfig: DefaultConfig,
  supportedConfig: SupportedConfig
): string[] {
  const warnings: string[] = []

  // Determine if this is serial or TCP config
  const isSerial = 'baudRate' in defaultConfig
  const isTCP = 'defaultPort' in defaultConfig

  if (isSerial) {
    const serialDefault = defaultConfig
    const serialSupported = supportedConfig as Record<string, unknown>

    // Check baudRate
    if ('validBaudRates' in serialSupported && Array.isArray(serialSupported['validBaudRates'])) {
      const validBaudRates = serialSupported['validBaudRates'] as number[]
      if (!validBaudRates.includes(serialDefault.baudRate)) {
        warnings.push(
          `baudRate: ${serialDefault.baudRate} is not in validBaudRates: [${validBaudRates.join(', ')}]`
        )
      }
    }

    // Check parity
    if (
      'parity' in serialDefault &&
      'validParity' in serialSupported &&
      Array.isArray(serialSupported['validParity'])
    ) {
      const validParity = serialSupported['validParity'] as string[]
      if (!validParity.includes(serialDefault.parity)) {
        warnings.push(
          `parity: "${serialDefault.parity}" is not in validParity: [${validParity.map((p) => `"${p}"`).join(', ')}]`
        )
      }
    }

    // Check dataBits
    if (
      'dataBits' in serialDefault &&
      'validDataBits' in serialSupported &&
      Array.isArray(serialSupported['validDataBits'])
    ) {
      const validDataBits = serialSupported['validDataBits'] as number[]
      if (!validDataBits.includes(serialDefault.dataBits)) {
        warnings.push(
          `dataBits: ${serialDefault.dataBits} is not in validDataBits: [${validDataBits.join(', ')}]`
        )
      }
    }

    // Check stopBits
    if (
      'stopBits' in serialDefault &&
      'validStopBits' in serialSupported &&
      Array.isArray(serialSupported['validStopBits'])
    ) {
      const validStopBits = serialSupported['validStopBits'] as number[]
      if (!validStopBits.includes(serialDefault.stopBits)) {
        warnings.push(
          `stopBits: ${serialDefault.stopBits} is not in validStopBits: [${validStopBits.join(', ')}]`
        )
      }
    }

    // Check defaultAddress (serial)
    if (
      'defaultAddress' in serialDefault &&
      'validAddressRange' in serialSupported &&
      Array.isArray(serialSupported['validAddressRange'])
    ) {
      const [min, max] = serialSupported['validAddressRange'] as [number, number]
      if (serialDefault.defaultAddress < min || serialDefault.defaultAddress > max) {
        warnings.push(
          `defaultAddress: ${serialDefault.defaultAddress} is not in validAddressRange: [${min}, ${max}]`
        )
      }
    }
  } else if (isTCP) {
    const tcpDefault = defaultConfig
    const tcpSupported = supportedConfig as Record<string, unknown>

    // Check defaultPort
    if ('validPorts' in tcpSupported && Array.isArray(tcpSupported['validPorts'])) {
      const validPorts = tcpSupported['validPorts'] as number[]
      if (!validPorts.includes(tcpDefault.defaultPort)) {
        warnings.push(
          `defaultPort: ${tcpDefault.defaultPort} is not in validPorts: [${validPorts.join(', ')}]`
        )
      }
    }

    // Check defaultAddress (TCP)
    if (
      'defaultAddress' in tcpDefault &&
      'validAddressRange' in tcpSupported &&
      Array.isArray(tcpSupported['validAddressRange'])
    ) {
      const [min, max] = tcpSupported['validAddressRange'] as [number, number]
      if (tcpDefault.defaultAddress < min || tcpDefault.defaultAddress > max) {
        warnings.push(
          `defaultAddress: ${tcpDefault.defaultAddress} is not in validAddressRange: [${min}, ${max}]`
        )
      }
    }
  }

  return warnings
}
