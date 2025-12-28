import ModbusRTU from 'modbus-serial'

import type { LoadedDriver } from '../driver-loader/loader.js'

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

  /** Optional loaded driver for driver-based detection */
  driverMetadata?: LoadedDriver

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
    driverMetadata,
    maxDevices = 1,
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
            const identification = await identifyDevice(client, timeout, slaveId, driverMetadata)

            // If device found, add to results
            if (identification.present) {
              const device: DiscoveredDevice = {
                ...combination,
                identification,
              }

              discovered.push(device)
              onTestAttempt?.(combination, 'found')
              onDeviceFound?.(device)

              // Only wait for bus recovery if we're continuing the scan
              // If we've reached maxDevices, we're done - no delay needed
              const reachedLimit = maxDevices > 0 && discovered.length >= maxDevices
              if (delayMs > 0 && !reachedLimit) {
                await new Promise((resolve) => setTimeout(resolve, delayMs))
              }
            } else {
              onTestAttempt?.(combination, 'not-found')
              // No device - we timed out. If delay is longer than timeout,
              // we need to wait the remainder to meet the delay requirement
              if (delayMs > timeout) {
                await new Promise((resolve) => setTimeout(resolve, delayMs - timeout))
              }
            }
          } catch {
            // Device identification error - skip this slave ID
            onTestAttempt?.(combination, 'not-found')
            // Error case - also need to wait remainder if delay > timeout
            if (delayMs > timeout) {
              await new Promise((resolve) => setTimeout(resolve, delayMs - timeout))
            }
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
    } catch {
      // Connection error for this serial parameter set - skip entire group
      // This can happen if port is busy, doesn't exist, or serial params are invalid

      // Still update progress for skipped combinations
      currentIndex += groupCombinations.length
      onProgress?.(currentIndex, total, discovered.length)
    }
  }

  return discovered
}
