import ModbusRTU from 'modbus-serial'

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

  /** Progress callback (current index, total combinations, devices found) */
  onProgress?: (current: number, total: number, devicesFound: number) => void

  /** Device found callback */
  onDeviceFound?: (device: DiscoveredDevice) => void
}

/**
 * Scan for Modbus devices using given parameter combinations
 *
 * @param generatorOptions - Options for parameter combination generation
 * @param scanOptions - Scanning options
 * @returns Array of discovered devices
 */
export async function scanForDevices(
  generatorOptions: GeneratorOptions,
  scanOptions: ScanOptions
): Promise<DiscoveredDevice[]> {
  const { port, timeout, delayMs, onProgress, onDeviceFound } = scanOptions

  // Generate all parameter combinations
  const combinations = Array.from(generateParameterCombinations(generatorOptions))
  const total = combinations.length

  const discovered: DiscoveredDevice[] = []
  let currentIndex = 0

  // Test each combination
  for (const combination of combinations) {
    const { slaveId, baudRate, parity, dataBits, stopBits } = combination

    try {
      // Create and configure Modbus client
      const client = new ModbusRTU()

      // Connect with current serial parameters
      await client.connectRTUBuffered(port, {
        baudRate,
        parity,
        dataBits,
        stopBits,
      })

      // Set slave ID
      client.setID(slaveId)

      // Try to identify device
      const identification = await identifyDevice(client, timeout)

      // Close connection
      await new Promise<void>((resolve) => client.close(resolve))

      // If device found, add to results
      if (identification.present) {
        const device: DiscoveredDevice = {
          ...combination,
          identification,
        }

        discovered.push(device)
        onDeviceFound?.(device)
      }

      // Wait before next attempt to avoid bus contention
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    } catch {
      // Connection or other error - skip this combination
      // This can happen if port is busy, doesn't exist, etc.
    }

    // Update progress
    currentIndex++
    onProgress?.(currentIndex, total, discovered.length)
  }

  return discovered
}
