/**
 * Validation utilities for CLI options using driver SUPPORTED_CONFIG
 */

import type { LoadedDriver } from '@ya-modbus/driver-loader'
import type { DataBits, Parity, StopBits, SupportedSerialConfig } from '@ya-modbus/driver-types'

/**
 * Validation error with helpful context
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown,
    public readonly validValues?: readonly unknown[]
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Check if config is a serial config (has validBaudRates)
 */
function isSerialConfig(config: unknown): config is SupportedSerialConfig {
  return (
    config !== null &&
    config !== undefined &&
    typeof config === 'object' &&
    'validBaudRates' in config
  )
}

/**
 * Validate baud rate against driver constraints
 *
 * @param baudRate - User-specified baud rate
 * @param driverMetadata - Loaded driver metadata
 * @throws ValidationError if invalid
 */
export function validateBaudRate(
  baudRate: number | undefined,
  driverMetadata?: LoadedDriver
): void {
  if (baudRate === undefined) {
    return // No validation needed if not specified
  }

  const supportedConfig = driverMetadata?.supportedConfig
  if (!isSerialConfig(supportedConfig) || !supportedConfig.validBaudRates) {
    return // No driver-specific constraints
  }

  const validRates = supportedConfig.validBaudRates
  if (!validRates.includes(baudRate)) {
    const rateList = validRates.join(', ')
    const defaultConfig = driverMetadata?.defaultConfig
    const defaultRate =
      defaultConfig && 'baudRate' in defaultConfig ? defaultConfig.baudRate : undefined

    throw new ValidationError(
      `Invalid baud rate ${baudRate}. This driver supports: ${rateList}${defaultRate ? ` (default: ${defaultRate})` : ''}`,
      'baudRate',
      baudRate,
      validRates
    )
  }
}

/**
 * Validate parity against driver constraints
 *
 * @param parity - User-specified parity
 * @param driverMetadata - Loaded driver metadata
 * @throws ValidationError if invalid
 */
export function validateParity(parity: string | undefined, driverMetadata?: LoadedDriver): void {
  if (parity === undefined) {
    return
  }

  const supportedConfig = driverMetadata?.supportedConfig
  if (!isSerialConfig(supportedConfig) || !supportedConfig.validParity) {
    return
  }

  const validParity = supportedConfig.validParity
  if (!validParity.includes(parity as Parity)) {
    const parityList = validParity.join(', ')
    const defaultConfig = driverMetadata?.defaultConfig
    const defaultParity =
      defaultConfig && 'parity' in defaultConfig ? defaultConfig.parity : undefined

    throw new ValidationError(
      `Invalid parity '${parity}'. This driver supports: ${parityList}${defaultParity ? ` (default: ${defaultParity})` : ''}`,
      'parity',
      parity,
      validParity
    )
  }
}

/**
 * Validate data bits against driver constraints
 *
 * @param dataBits - User-specified data bits
 * @param driverMetadata - Loaded driver metadata
 * @throws ValidationError if invalid
 */
export function validateDataBits(
  dataBits: number | undefined,
  driverMetadata?: LoadedDriver
): void {
  if (dataBits === undefined) {
    return
  }

  const supportedConfig = driverMetadata?.supportedConfig
  if (!isSerialConfig(supportedConfig) || !supportedConfig.validDataBits) {
    return
  }

  const validDataBits = supportedConfig.validDataBits
  if (!validDataBits.includes(dataBits as DataBits)) {
    const bitsList = validDataBits.join(', ')
    const defaultConfig = driverMetadata?.defaultConfig
    const defaultBits =
      defaultConfig && 'dataBits' in defaultConfig ? defaultConfig.dataBits : undefined

    throw new ValidationError(
      `Invalid data bits ${dataBits}. This driver supports: ${bitsList}${defaultBits ? ` (default: ${defaultBits})` : ''}`,
      'dataBits',
      dataBits,
      validDataBits
    )
  }
}

/**
 * Validate stop bits against driver constraints
 *
 * @param stopBits - User-specified stop bits
 * @param driverMetadata - Loaded driver metadata
 * @throws ValidationError if invalid
 */
export function validateStopBits(
  stopBits: number | undefined,
  driverMetadata?: LoadedDriver
): void {
  if (stopBits === undefined) {
    return
  }

  const supportedConfig = driverMetadata?.supportedConfig
  if (!isSerialConfig(supportedConfig) || !supportedConfig.validStopBits) {
    return
  }

  const validStopBits = supportedConfig.validStopBits
  if (!validStopBits.includes(stopBits as StopBits)) {
    const bitsList = validStopBits.join(', ')
    const defaultConfig = driverMetadata?.defaultConfig
    const defaultBits =
      defaultConfig && 'stopBits' in defaultConfig ? defaultConfig.stopBits : undefined

    throw new ValidationError(
      `Invalid stop bits ${stopBits}. This driver supports: ${bitsList}${defaultBits ? ` (default: ${defaultBits})` : ''}`,
      'stopBits',
      stopBits,
      validStopBits
    )
  }
}

/**
 * Validate slave ID/address against driver constraints
 *
 * @param slaveId - User-specified slave ID
 * @param driverMetadata - Loaded driver metadata
 * @throws ValidationError if invalid
 */
export function validateSlaveId(slaveId: number | undefined, driverMetadata?: LoadedDriver): void {
  if (slaveId === undefined) {
    return
  }

  const supportedConfig = driverMetadata?.supportedConfig
  if (!isSerialConfig(supportedConfig) || !supportedConfig.validAddressRange) {
    return
  }

  const [min, max] = supportedConfig.validAddressRange
  if (slaveId < min || slaveId > max) {
    const defaultConfig = driverMetadata?.defaultConfig
    const defaultAddress =
      defaultConfig && 'defaultAddress' in defaultConfig ? defaultConfig.defaultAddress : undefined

    throw new ValidationError(
      `Invalid slave ID ${slaveId}. This driver supports: ${min}-${max}${defaultAddress ? ` (default: ${defaultAddress})` : ''}`,
      'slaveId',
      slaveId,
      [min, max]
    )
  }
}

/**
 * Validate all serial connection parameters
 *
 * Validates baudRate, parity, dataBits, stopBits, and slaveId against driver constraints.
 *
 * @param options - Connection options to validate
 * @param driverMetadata - Loaded driver metadata
 * @throws ValidationError if any parameter is invalid
 */
export function validateSerialOptions(
  options: {
    baudRate?: number
    parity?: string
    dataBits?: number
    stopBits?: number
    slaveId?: number
  },
  driverMetadata?: LoadedDriver
): void {
  validateBaudRate(options.baudRate, driverMetadata)
  validateParity(options.parity, driverMetadata)
  validateDataBits(options.dataBits, driverMetadata)
  validateStopBits(options.stopBits, driverMetadata)
  validateSlaveId(options.slaveId, driverMetadata)
}
