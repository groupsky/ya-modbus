import ModbusRTU from 'modbus-serial'

import type { LoadedDriver } from '../driver-loader/loader.js'

import { identifyDevice, type DeviceIdentificationResult } from './device-identifier.js'
import {
  generateParameterCombinations,
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

  /** Stop scanning after first device found */
  stopAfterFirst?: boolean

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
 * Group parameter combinations by serial configuration
 * This allows us to reuse the serial connection for all slave IDs
 */
function groupBySerialParams(
  combinations: ParameterCombination[]
): Map<string, ParameterCombination[]> {
  const groups = new Map<string, ParameterCombination[]>()

  for (const combo of combinations) {
    // Create key from serial parameters (excluding slaveId)
    const key = `${combo.baudRate}-${combo.parity}-${combo.dataBits}-${combo.stopBits}`

    const group = groups.get(key) ?? []
    group.push(combo)
    groups.set(key, group)
  }

  return groups
}

/**
 * Scan for Modbus devices using given parameter combinations
 *
 * **Performance Optimization**: Groups combinations by serial parameters
 * to reuse connections, reducing overhead from ~600ms to ~100ms per test.
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
    stopAfterFirst,
    onProgress,
    onDeviceFound,
    onTestAttempt,
  } = scanOptions

  // Generate all parameter combinations
  const combinations = Array.from(generateParameterCombinations(generatorOptions))
  const total = combinations.length

  // Group by serial parameters to reuse connections (HUGE speed improvement)
  const groups = groupBySerialParams(combinations)

  const discovered: DiscoveredDevice[] = []
  let currentIndex = 0

  // Test each serial parameter group
  for (const [_serialKey, groupCombinations] of groups) {
    // Stop if we found device and stopAfterFirst is enabled
    if (stopAfterFirst && discovered.length > 0) {
      break
    }

    // Skip empty groups (shouldn't happen, but be defensive)
    if (groupCombinations.length === 0) {
      continue
    }

    // Get serial params from first combination in group (all have same serial params)
    // Length check above guarantees at least one element exists
    const firstCombo = groupCombinations[0] as ParameterCombination
    const { baudRate, parity, dataBits, stopBits } = firstCombo

    let client: ModbusRTU | undefined
    try {
      // Create and connect once for this serial parameter set
      client = new ModbusRTU()
      await client.connectRTUBuffered(port, {
        baudRate,
        parity,
        dataBits,
        stopBits,
      })

      // Test all slave IDs with this serial configuration
      for (const combination of groupCombinations) {
        // Stop if we found device and stopAfterFirst is enabled
        if (stopAfterFirst && discovered.length > 0) {
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
          } else {
            onTestAttempt?.(combination, 'not-found')
          }

          // Wait before next attempt to avoid bus contention
          if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs))
          }
        } catch {
          // Device identification error - skip this slave ID
          onTestAttempt?.(combination, 'not-found')
        }

        // Update progress
        currentIndex++
        onProgress?.(currentIndex, total, discovered.length)
      }

      // Close connection after testing all slave IDs
      if (client) {
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
