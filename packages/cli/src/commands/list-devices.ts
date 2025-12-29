/**
 * List devices command
 *
 * Displays supported devices from a driver package's DEVICES export.
 */

import type { DefaultSerialConfig, DefaultTCPConfig } from '@ya-modbus/driver-types'

import { loadDriver } from '../driver-loader/loader.js'

/**
 * Options for list-devices command
 */
export interface ListDevicesOptions {
  /** Driver package name */
  driver?: string

  /** Load from local package (cwd) */
  local?: boolean

  /** Output format: 'table' or 'json' */
  format?: 'table' | 'json'
}

/**
 * Format default config as a short string
 */
function formatDefaultConfig(config: DefaultSerialConfig | DefaultTCPConfig | undefined): string {
  if (!config) return '-'

  if ('baudRate' in config) {
    // Serial config
    const parityChar = config.parity === 'none' ? 'N' : config.parity === 'even' ? 'E' : 'O'
    return `${config.baudRate} ${config.dataBits}${parityChar}${config.stopBits}`
  } else if ('defaultPort' in config) {
    // TCP config
    return `TCP:${config.defaultPort}`
  }

  return '-'
}

/**
 * List devices command handler
 *
 * @param options - Command options
 */
export async function listDevicesCommand(options: ListDevicesOptions): Promise<void> {
  // Validate that either driver or local is specified
  if (!options.driver && !options.local) {
    throw new Error('Either --driver or --local must be specified')
  }

  // Load driver metadata
  const driverMetadata = await loadDriver(
    options.local ? { localPackage: true } : { driverPackage: options.driver as string }
  )

  if (options.format === 'json') {
    // JSON output
    console.log(
      JSON.stringify(
        {
          devices: driverMetadata.devices ?? null,
          defaultConfig: driverMetadata.defaultConfig,
          supportedConfig: driverMetadata.supportedConfig,
        },
        null,
        2
      )
    )
    return
  }

  // Human-readable table output
  const devices = driverMetadata.devices

  if (!devices || Object.keys(devices).length === 0) {
    console.log('This driver does not export a DEVICES registry.')
    console.log('It is a single-device driver.\n')

    if (driverMetadata.defaultConfig) {
      console.log('Default config:', formatDefaultConfig(driverMetadata.defaultConfig))
    }
    return
  }

  console.log('Supported Devices')
  console.log('=================\n')

  // Calculate column widths
  const entries = Object.entries(devices)
  const keyWidth = Math.max(6, ...entries.map(([key]) => key.length))
  const manufacturerWidth = Math.max(12, ...entries.map(([, info]) => info.manufacturer.length))
  const modelWidth = Math.max(5, ...entries.map(([, info]) => info.model.length))

  // Header
  const header = [
    'DEVICE'.padEnd(keyWidth),
    'MANUFACTURER'.padEnd(manufacturerWidth),
    'MODEL'.padEnd(modelWidth),
    'CONFIG',
    'DESCRIPTION',
  ].join('  ')
  console.log(header)
  console.log('-'.repeat(header.length))

  // Rows
  for (const [key, info] of entries) {
    const config = info.defaultConfig ?? driverMetadata.defaultConfig
    const row = [
      key.padEnd(keyWidth),
      info.manufacturer.padEnd(manufacturerWidth),
      info.model.padEnd(modelWidth),
      formatDefaultConfig(config).padEnd(12),
      info.description ?? '',
    ].join('  ')
    console.log(row)
  }

  console.log(`\nTotal: ${entries.length} device(s)`)
}
