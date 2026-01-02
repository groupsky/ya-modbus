/**
 * Show driver defaults command
 *
 * Displays DEFAULT_CONFIG and SUPPORTED_CONFIG from a driver package.
 */

import { loadDriver } from '@ya-modbus/driver-loader'

/**
 * Options for show-defaults command
 */
export interface ShowDefaultsOptions {
  /** Driver package name (auto-detects from cwd if not specified) */
  driver?: string

  /** Output format: 'table' or 'json' */
  format?: 'table' | 'json'
}

/**
 * Show driver defaults command handler
 *
 * @param options - Command options
 */
export async function showDefaultsCommand(options: ShowDefaultsOptions): Promise<void> {
  // Load driver metadata (auto-detects from cwd if no --driver specified)
  const driverMetadata = await loadDriver(options.driver ? { driverPackage: options.driver } : {})

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
