/**
 * Show driver defaults command
 *
 * Note: This command is deprecated. Device configurations are now per-device
 * in DEVICE_METADATA. Import and inspect DEVICE_METADATA directly from the driver package.
 */

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
export function showDefaultsCommand(_options: ShowDefaultsOptions): void {
  console.log('The show-defaults command is deprecated.')
  console.log('')
  console.log('Device configurations are now per-device in DEVICE_METADATA.')
  console.log('To view device configurations:')
  console.log('')
  console.log("  import { DEVICE_METADATA } from 'ya-modbus-driver-xymd1'")
  console.log('  ')
  console.log('  for (const [deviceId, metadata] of Object.entries(DEVICE_METADATA)) {')
  console.log('    console.log(`Device: ${deviceId} - ${metadata.name}`)')
  console.log('    console.log(metadata.defaultConfig)')
  console.log('    console.log(metadata.supportedConfig)')
  console.log('  }')
  console.log('')
}
