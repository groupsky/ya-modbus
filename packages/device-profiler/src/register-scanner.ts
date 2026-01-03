/**
 * Register scanner with batch reading and automatic fallback
 */

import type { Transport } from '@ya-modbus/driver-types'

import type { ErrorType } from './error-classifier.js'
import { testRead, RegisterType } from './read-tester.js'

/**
 * Result of scanning a single register
 */
export interface ScanResult {
  /** Register address */
  address: number
  /** Register type */
  type: RegisterType
  /** Whether the read was successful */
  success: boolean
  /** Register value if successful (2 bytes) */
  value?: Buffer
  /** Time taken for the read operation in milliseconds */
  timing: number
  /** Error message if failed */
  error?: string
  /** Classified error type if failed */
  errorType?: ErrorType
}

/**
 * Options for register scanning
 */
export interface ScanOptions {
  /** Modbus transport */
  transport: Transport
  /** Register type to scan */
  type: RegisterType
  /** Starting register address */
  startAddress: number
  /** Ending register address (inclusive) */
  endAddress: number
  /** Maximum registers to read in a single batch (default: 10) */
  batchSize?: number
  /** Callback for progress updates */
  onProgress?: (current: number, total: number) => void
  /** Callback for each register result */
  onResult?: (result: ScanResult) => void
}

/**
 * Scan a range of registers with batch reads and automatic fallback
 *
 * @param options - Scan configuration
 */
export async function scanRegisters(options: ScanOptions): Promise<void> {
  const {
    transport,
    type,
    startAddress,
    endAddress,
    batchSize = 10,
    onProgress,
    onResult,
  } = options

  const totalRegisters = endAddress - startAddress + 1
  let scannedCount = 0

  // Process registers in batches
  for (let address = startAddress; address <= endAddress; address += batchSize) {
    const count = Math.min(batchSize, endAddress - address + 1)

    // Try batch read first
    const batchResult = await testRead(transport, type, address, count)

    if (batchResult.success && batchResult.data) {
      // Batch read succeeded, split results
      for (let i = 0; i < count; i++) {
        const regAddress = address + i
        const value = batchResult.data.subarray(i * 2, (i + 1) * 2)

        const result: ScanResult = {
          address: regAddress,
          type,
          success: true,
          value,
          timing: batchResult.timing / count,
        }

        if (onResult) {
          onResult(result)
        }

        scannedCount++
        if (onProgress) {
          onProgress(scannedCount, totalRegisters)
        }
      }
    } else {
      // Batch read failed, fallback to individual reads
      for (let i = 0; i < count; i++) {
        const regAddress = address + i
        const individualResult = await testRead(transport, type, regAddress, 1)

        const result: ScanResult = {
          address: regAddress,
          type,
          success: individualResult.success,
          ...(individualResult.data !== undefined && { value: individualResult.data }),
          timing: individualResult.timing,
          ...(individualResult.error !== undefined && { error: individualResult.error }),
          ...(individualResult.errorType !== undefined && {
            errorType: individualResult.errorType,
          }),
        }

        if (onResult) {
          onResult(result)
        }

        scannedCount++
        if (onProgress) {
          onProgress(scannedCount, totalRegisters)
        }
      }
    }
  }
}
