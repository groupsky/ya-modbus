/**
 * Show driver defaults command
 *
 * Displays DEFAULT_CONFIG and SUPPORTED_CONFIG from a driver package.
 */

import { loadDriver } from '../driver-loader/loader.js'

/**
 * Options for show-defaults command
 */
export interface ShowDefaultsOptions {
  /** Driver package name */
  driver?: string

  /** Load from local package (cwd) */
  local?: boolean

  /** Output format: 'table' or 'json' */
  format?: 'table' | 'json'
}

/**
 * Show driver defaults command handler
 *
 * @param options - Command options
 */
export async function showDefaultsCommand(options: ShowDefaultsOptions): Promise<void> {
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
          defaultConfig: driverMetadata.defaultConfig,
          supportedConfig: driverMetadata.supportedConfig,
        },
        null,
        2
      )
    )
  } else {
    // Human-readable table output
    console.log('Driver Defaults')
    console.log('===============\n')

    if (driverMetadata.defaultConfig) {
      console.log('DEFAULT_CONFIG:')
      for (const [key, value] of Object.entries(driverMetadata.defaultConfig)) {
        console.log(`  ${key}: ${JSON.stringify(value)}`)
      }
      console.log()
    } else {
      console.log('No DEFAULT_CONFIG exported by this driver.\n')
    }

    if (driverMetadata.supportedConfig) {
      console.log('SUPPORTED_CONFIG:')
      for (const [key, value] of Object.entries(driverMetadata.supportedConfig)) {
        console.log(`  ${key}: ${JSON.stringify(value)}`)
      }
      console.log()
    } else {
      console.log('No SUPPORTED_CONFIG exported by this driver.\n')
    }
  }
}
