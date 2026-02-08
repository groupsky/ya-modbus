import { loadDriver } from '@ya-modbus/driver-loader'

import type { DiscoveryStrategy } from '../discovery/parameter-generator.js'
import { ProgressTracker } from '../discovery/progress.js'
import { scanForDevices } from '../discovery/scanner.js'
import { formatDiscoveryJSON, formatDiscoveryTable } from '../formatters/discovery-results.js'
import { parseBaudRate } from '../utils/parse-baud-rate.js'
import { parseIdRange } from '../utils/parse-id-range.js'
import { parseParity, sortParitiesInStandardOrder } from '../utils/parse-parity.js'

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
  maxDevices?: number
  id?: string | string[]
  parity?: string | string[]
  baudRate?: string | string[]
  verbose?: boolean
  silent?: boolean

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
  const timeout = options.timeout ?? 1000 // Device response timeout
  const delay = options.delay ?? 100 // Inter-command delay for bus recovery
  const format = options.format ?? 'table'
  const maxDevices = options.maxDevices ?? 1 // Default: stop after finding 1 device
  const verbose = options.verbose ?? false
  const silent = options.silent ?? false

  // Parse and merge ID specifications
  let slaveIds: number[] | undefined
  if (options.id) {
    const idSpecs = Array.isArray(options.id) ? options.id : [options.id]
    const allIds = new Set<number>()

    for (const spec of idSpecs) {
      const ids = parseIdRange(spec)
      ids.forEach((id) => allIds.add(id))
    }

    slaveIds = Array.from(allIds).sort((a, b) => a - b)
  }

  // Parse and merge parity specifications
  let parities: import('@ya-modbus/driver-types').Parity[] | undefined
  if (options.parity) {
    const paritySpecs = Array.isArray(options.parity) ? options.parity : [options.parity]
    const allParities = new Set<import('@ya-modbus/driver-types').Parity>()

    for (const spec of paritySpecs) {
      const p = parseParity(spec)
      p.forEach((parity) => allParities.add(parity))
    }

    // Sort in standard order
    parities = sortParitiesInStandardOrder(Array.from(allParities))
  }

  // Parse and merge baud rate specifications
  let baudRates: import('@ya-modbus/driver-types').BaudRate[] | undefined
  if (options.baudRate) {
    const baudRateSpecs = Array.isArray(options.baudRate) ? options.baudRate : [options.baudRate]
    const allBaudRates = new Set<import('@ya-modbus/driver-types').BaudRate>()

    for (const spec of baudRateSpecs) {
      const rates = parseBaudRate(spec)
      rates.forEach((rate) => allBaudRates.add(rate))
    }

    baudRates = Array.from(allBaudRates).sort((a, b) => a - b)
  }

  if (!silent) {
    console.log(`Starting Modbus device discovery on ${options.port}...`)
    console.log(`Strategy: ${strategy}`)
    console.log(`Timeout: ${timeout}ms, Delay: ${delay}ms`)
    if (slaveIds) {
      console.log(`Slave IDs: ${slaveIds.join(', ')} (${slaveIds.length} IDs)`)
    } else {
      console.log('Slave IDs: 1-247 (all)')
    }
    if (baudRates) {
      console.log(`Baud rates: ${baudRates.join(', ')} (${baudRates.length} rates)`)
    }
    if (parities) {
      console.log(`Parities: ${parities.join(', ')} (${parities.length} values)`)
    }
    if (maxDevices === 0) {
      console.log('Mode: Find all devices')
    } else {
      console.log(`Mode: Find up to ${maxDevices} device(s)`)
    }
    if (verbose) {
      console.log('Verbose: Enabled')
    }
    console.log('')
  }

  // Try to load driver metadata (explicit --driver or auto-detect from cwd)
  let driverMetadata
  try {
    driverMetadata = await loadDriver(options.driver ? { driverPackage: options.driver } : {})
    if (!silent) {
      if (options.driver) {
        console.log(`Using driver: ${options.driver}`)
      } else {
        console.log('Using local driver package')
      }

      if (driverMetadata?.defaultConfig) {
        console.log('Using driver DEFAULT_CONFIG for parameter prioritization')
      }
      if (driverMetadata?.supportedConfig) {
        console.log('Using driver SUPPORTED_CONFIG to limit parameter combinations')
      }
      console.log('')
    }
  } catch (error) {
    // Driver loading failed - continue with generic Modbus parameters
    if (!silent) {
      console.log('No driver available, using generic Modbus parameters...')
      if (verbose) {
        console.log(`  (${(error as Error).message})`)
      }
      console.log('')
    }
  }

  // Create progress tracker (calculate total combinations without materializing)
  const { countParameterCombinations } = await import('../discovery/parameter-generator-utils.js')

  // Build generator options conditionally to avoid passing undefined
  const generatorOptions: Parameters<typeof countParameterCombinations>[0] = {
    strategy,
  }

  if (driverMetadata?.defaultConfig && 'baudRate' in driverMetadata.defaultConfig) {
    generatorOptions.defaultConfig = driverMetadata.defaultConfig
  }

  if (driverMetadata?.supportedConfig && 'validBaudRates' in driverMetadata.supportedConfig) {
    generatorOptions.supportedConfig = driverMetadata.supportedConfig
  }

  if (slaveIds) {
    generatorOptions.slaveIds = slaveIds
  }

  if (baudRates) {
    generatorOptions.baudRates = baudRates
  }

  if (parities) {
    generatorOptions.parities = parities
  }

  const totalCombinations = countParameterCombinations(generatorOptions)

  const progress = new ProgressTracker(totalCombinations)

  if (!silent) {
    console.log(`Testing ${totalCombinations} parameter combinations...`)
    console.log('')
  }

  // Build scan options conditionally
  const scanOptions: Parameters<typeof scanForDevices>[1] = {
    port: options.port,
    timeout,
    delayMs: delay,
    maxDevices,
    verbose,
    onProgress: (current, _total, devicesFound) => {
      // Only show progress bar if not in verbose mode, silent mode, or json format
      if (!verbose && !silent) {
        const progressText = progress.update(current, devicesFound)
        if (progressText && format !== 'json') {
          // Clear line and write progress
          process.stdout.clearLine?.(0)
          process.stdout.cursorTo?.(0)
          process.stdout.write(progressText)
        }
      }
    },
    onDeviceFound: (device) => {
      if (!silent && format !== 'json') {
        // Clear progress line (if not verbose)
        if (!verbose) {
          process.stdout.clearLine?.(0)
          process.stdout.cursorTo?.(0)
        }
        // Show found device
        console.log(
          `✓ Found device: Slave ID ${device.slaveId} @ ${device.baudRate},${device.parity === 'none' ? 'N' : device.parity === 'even' ? 'E' : 'O'},${device.dataBits},${device.stopBits}`
        )
      }
    },
  }

  // Add verbose callback if verbose mode is enabled (and not silent)
  if (verbose && !silent) {
    scanOptions.onTestAttempt = (params, result) => {
      if (format !== 'json') {
        const parityChar = params.parity === 'none' ? 'N' : params.parity === 'even' ? 'E' : 'O'
        const status = result === 'found' ? '✓' : result === 'testing' ? '·' : '✗'
        const paramStr = `${params.slaveId}@${params.baudRate},${parityChar},${params.dataBits},${params.stopBits}`

        if (result === 'testing') {
          // Show what we're testing
          process.stdout.clearLine?.(0)
          process.stdout.cursorTo?.(0)
          process.stdout.write(`${status} Testing: ${paramStr}`)
        } else if (result === 'found') {
          // Device found - print on new line
          process.stdout.clearLine?.(0)
          process.stdout.cursorTo?.(0)
          console.log(`${status} Found:   ${paramStr}`)
        }
        // Don't print anything for 'not-found' - just move to next test
      }
    }
  }

  // Scan for devices
  const devices = await scanForDevices(generatorOptions, scanOptions)

  // Clear progress line (if not silent)
  if (!silent && format !== 'json') {
    process.stdout.clearLine?.(0)
    process.stdout.cursorTo?.(0)
  }

  if (!silent) {
    console.log('')
    console.log(`Discovery complete! Found ${devices.length} device(s).`)
    console.log('')
  }

  // Format and display results (always show, even in silent mode)
  if (devices.length > 0) {
    if (format === 'json') {
      console.log(formatDiscoveryJSON(devices))
    } else {
      console.log(formatDiscoveryTable(devices))
    }
  }
}
