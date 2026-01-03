/**
 * CLI orchestrator for register scanning
 */

import type { Transport } from '@ya-modbus/driver-types'

import { formatProgress, formatSummary } from './console-formatter.js'
import { PROGRESS_UPDATE_INTERVAL_MS } from './constants.js'
import { RegisterType } from './read-tester.js'
import { scanRegisters, type ScanResult } from './register-scanner.js'

/**
 * Options for running a profile scan
 */
export interface ProfileScanOptions {
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
}

/**
 * Run a register profile scan with console output
 *
 * @param options - Scan configuration
 */
export async function runProfileScan(options: ProfileScanOptions): Promise<void> {
  const { transport, type, startAddress, endAddress, batchSize } = options
  const results: ScanResult[] = []

  try {
    console.log(`Scanning ${type} registers from ${startAddress} to ${endAddress}...`)
    console.log()

    let lastProgressUpdate = 0
    await scanRegisters({
      transport,
      type,
      startAddress,
      endAddress,
      ...(batchSize !== undefined && { batchSize }),
      onProgress: (current, total) => {
        const now = Date.now()
        if (now - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL_MS || current === total) {
          process.stdout.write(`\r${formatProgress(current, total)}`)
          lastProgressUpdate = now
        }
      },
      onResult: (result) => {
        results.push(result)
      },
    })

    console.log('\n')
    console.log('Scan complete!')
    console.log()
    console.log(formatSummary(results))
  } finally {
    await transport.close()
  }
}
