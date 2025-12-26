import type { DiscoveryStrategy } from '../discovery/parameter-generator.js'
import { ProgressTracker } from '../discovery/progress.js'
import { scanForDevices } from '../discovery/scanner.js'
import { loadDriver } from '../driver-loader/loader.js'
import { formatDiscoveryJSON, formatDiscoveryTable } from '../formatters/discovery-results.js'

/**
 * Discover command options
 */
export interface DiscoverOptions {
  // Connection options
  port: string

  // Discovery options
  strategy?: DiscoveryStrategy
  driver?: string
  timeout?: number
  delay?: number

  // Output options
  format: 'table' | 'json'
}

/**
 * Discover command implementation
 *
 * Scans for Modbus RTU devices on the specified port by testing
 * different slave IDs and serial parameters.
 *
 * @param options - Command options
 */
export async function discoverCommand(options: DiscoverOptions): Promise<void> {
  const strategy = options.strategy ?? 'quick'
  const timeout = options.timeout ?? 1000
  const delay = options.delay ?? 100
  const format = options.format ?? 'table'

  console.log(`Starting Modbus device discovery on ${options.port}...`)
  console.log(`Strategy: ${strategy}`)
  console.log(`Timeout: ${timeout}ms, Delay: ${delay}ms`)
  console.log('')

  // Load driver metadata if specified
  let driverMetadata
  if (options.driver) {
    try {
      driverMetadata = await loadDriver({
        driverPackage: options.driver,
      })
      console.log(`Using driver: ${options.driver}`)
      if (driverMetadata.defaultConfig) {
        console.log('Using driver DEFAULT_CONFIG for parameter prioritization')
      }
      if (driverMetadata.supportedConfig) {
        console.log('Using driver SUPPORTED_CONFIG to limit parameter combinations')
      }
      console.log('')
    } catch (error) {
      console.error(`Warning: Failed to load driver ${options.driver}: ${(error as Error).message}`)
      console.error('Continuing with generic Modbus parameters...')
      console.log('')
    }
  }

  // Create progress tracker (calculate total combinations first)
  const { generateParameterCombinations } = await import('../discovery/parameter-generator.js')

  // Build generator options conditionally to avoid passing undefined
  const generatorOptions: Parameters<typeof generateParameterCombinations>[0] = {
    strategy,
  }

  if (driverMetadata?.defaultConfig && 'baudRate' in driverMetadata.defaultConfig) {
    generatorOptions.defaultConfig = driverMetadata.defaultConfig
  }

  if (driverMetadata?.supportedConfig && 'validBaudRates' in driverMetadata.supportedConfig) {
    generatorOptions.supportedConfig = driverMetadata.supportedConfig
  }

  const combinations = Array.from(generateParameterCombinations(generatorOptions))

  const progress = new ProgressTracker(combinations.length)

  console.log(`Testing ${combinations.length} parameter combinations...`)
  console.log('')

  // Scan for devices
  const devices = await scanForDevices(generatorOptions, {
    port: options.port,
    timeout,
    delayMs: delay,
    onProgress: (current, _total, devicesFound) => {
      const progressText = progress.update(current, devicesFound)
      if (progressText && format !== 'json') {
        // Overwrite previous line
        process.stdout.write(`\r${progressText}`)
      }
    },
    onDeviceFound: (device) => {
      if (format !== 'json') {
        // Clear progress line and show found device
        process.stdout.write('\r' + ' '.repeat(100) + '\r')
        console.log(
          `✓ Found device: Slave ID ${device.slaveId} @ ${device.baudRate},${device.parity === 'none' ? 'N' : device.parity === 'even' ? 'E' : 'O'},${device.dataBits},${device.stopBits}`
        )
      }
    },
  })

  // Clear progress line
  if (format !== 'json') {
    process.stdout.write('\r' + ' '.repeat(100) + '\r')
  }

  console.log('')
  console.log(`Discovery complete! Found ${devices.length} device(s).`)
  console.log('')

  // Format and display results
  if (devices.length > 0) {
    if (format === 'json') {
      console.log(formatDiscoveryJSON(devices))
    } else {
      console.log(formatDiscoveryTable(devices))
    }
  }
}
