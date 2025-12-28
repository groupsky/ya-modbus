import ModbusRTU from 'modbus-serial'

import { identifyDevice, type DeviceIdentificationResult } from './device-identifier.js'
import { countParameterCombinations } from './parameter-generator-utils.js'
import {
  generateParameterGroups,
  type GeneratorOptions,
  type ParameterCombination,
} from './parameter-generator.js'

/**
 * Discovered device with full configuration
 */
export interface DiscoveredDevice extends ParameterCombination {
  /** Device identification result */
  identification: DeviceIdentificationResult
}

/**
 * Scanner options
 */
export interface ScanOptions {
  /** Serial port path (e.g., /dev/ttyUSB0) */
  port: string

  /** Response timeout in milliseconds */
  timeout: number

  /** Delay between attempts in milliseconds */
  delayMs: number

  /** Maximum number of devices to find (0 for unlimited, default: 1) */
  maxDevices?: number

  /** Verbose progress - show current parameters being tested */
  verbose?: boolean

  /** Progress callback (current index, total combinations, devices found) */
  onProgress?: (current: number, total: number, devicesFound: number) => void

  /** Device found callback */
  onDeviceFound?: (device: DiscoveredDevice) => void

  /** Verbose progress callback - called for each test attempt */
  onTestAttempt?: (params: ParameterCombination, result: 'testing' | 'found' | 'not-found') => void
}

/**
 * Apply inter-test delay to prevent bus contention
 *
 * When a device is found, waits full delayMs for bus recovery.
 * When no device found or error, waits remainder (delayMs - timeout) since
 * timeout already consumed time waiting for response.
 *
 * @param delayMs - Configured delay between tests
 * @param timeout - Request timeout in milliseconds
 * @param deviceFound - Whether a device was found (true) or not found/error (false)
 * @param shouldContinue - Whether scanning will continue after this delay
 */
async function applyInterTestDelay(
  delayMs: number,
  timeout: number,
  deviceFound: boolean,
  shouldContinue: boolean
): Promise<void> {
  // Skip delay if not continuing (reached maxDevices)
  if (!shouldContinue) {
    return
  }

  if (deviceFound) {
    // Device found - wait full delay for bus recovery
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  } else {
    // No device or error - timeout already consumed time, wait remainder
    if (delayMs > timeout) {
      await new Promise((resolve) => setTimeout(resolve, delayMs - timeout))
    }
  }
}

/**
 * Scan for Modbus devices using given parameter combinations
 *
 * **Performance Optimization**: Uses grouped generator to avoid materializing
 * all combinations. Groups by serial parameters to reuse connections,
 * reducing overhead from ~600ms to ~100ms per test.
 *
 * **Memory Efficiency**: Only materializes one group (~247 combinations) at a time
 * instead of all ~1500+ combinations.
 *
 * @param generatorOptions - Options for parameter combination generation
 * @param scanOptions - Scanning options
 * @returns Array of discovered devices
 */
export async function scanForDevices(
  generatorOptions: GeneratorOptions,
  scanOptions: ScanOptions
): Promise<DiscoveredDevice[]> {
  const {
    port,
    timeout,
    delayMs,
    maxDevices = 1,
    verbose = false,
    onProgress,
    onDeviceFound,
    onTestAttempt,
  } = scanOptions

  // Calculate total combinations efficiently (no materialization)
  const total = countParameterCombinations(generatorOptions)

  const discovered: DiscoveredDevice[] = []
  let currentIndex = 0

  // Test each serial parameter group
  // Generator yields groups without materializing all combinations
  for (const group of generateParameterGroups(generatorOptions)) {
    const { serialParams, combinations: groupCombinations } = group
    // Stop if we've found enough devices
    if (maxDevices > 0 && discovered.length >= maxDevices) {
      break
    }

    // Get serial params from group
    const { baudRate, parity, dataBits, stopBits } = serialParams

    try {
      // Create and connect once for this serial parameter set
      const client = new ModbusRTU()
      await client.connectRTUBuffered(port, {
        baudRate,
        parity,
        dataBits,
        stopBits,
      })

      // Set timeout once for this connection
      client.setTimeout(timeout)

      try {
        // Test all slave IDs with this serial configuration
        for (const combination of groupCombinations) {
          // Stop if we've found enough devices
          if (maxDevices > 0 && discovered.length >= maxDevices) {
            break
          }

          const { slaveId } = combination

          try {
            // Notify verbose progress
            onTestAttempt?.(combination, 'testing')

            // Set slave ID (reusing same connection)
            client.setID(slaveId)

            // Try to identify device
            const identification = await identifyDevice(client)

            // If device found, add to results
            if (identification.present) {
              const device: DiscoveredDevice = {
                ...combination,
                identification,
              }

              discovered.push(device)
              onTestAttempt?.(combination, 'found')
              onDeviceFound?.(device)

              // Apply delay for bus recovery before next test
              const reachedLimit = maxDevices > 0 && discovered.length >= maxDevices
              await applyInterTestDelay(delayMs, timeout, true, !reachedLimit)
            } else {
              onTestAttempt?.(combination, 'not-found')
              // Apply delay before next test (timeout already consumed time)
              await applyInterTestDelay(delayMs, timeout, false, true)
            }
          } catch {
            // Device identification error - skip this slave ID
            onTestAttempt?.(combination, 'not-found')
            // Apply delay before next test (error/timeout already consumed time)
            await applyInterTestDelay(delayMs, timeout, false, true)
          }

          // Update progress
          currentIndex++
          onProgress?.(currentIndex, total, discovered.length)
        }
      } finally {
        // Close connection after testing all slave IDs
        // Client is always defined here since we only reach this point after successful connection
        const clientToClose = client
        await new Promise<void>((resolve) => clientToClose.close(resolve))
      }
    } catch (error) {
      // Connection error for this serial parameter set - skip entire group
      // This can happen if port is busy, doesn't exist, or serial params are invalid

      // Log connection error in verbose mode to help debug hardware issues
      if (verbose) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.warn(
          `Connection failed for ${baudRate}/${parity}/${dataBits}/${stopBits}: ${errorMessage}`
        )
      }

      // Still update progress for skipped combinations
      currentIndex += groupCombinations.length
      onProgress?.(currentIndex, total, discovered.length)
    }
  }

  return discovered
}
