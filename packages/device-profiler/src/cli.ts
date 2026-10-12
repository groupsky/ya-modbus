/**
 * CLI orchestrator for register scanning
 */

import { writeFile } from 'node:fs/promises'

import type { Transport } from '@ya-modbus/driver-types'

import { formatProgress, formatSummary } from './console-formatter.js'
import { DEFAULT_BATCH_SIZE, PROGRESS_UPDATE_INTERVAL_MS } from './constants.js'
import { formatJSON } from './json-formatter.js'
import type { OutputFormat } from './output-format.js'
import { RegisterType } from './read-tester.js'
import { scanRegisters, type ScanResult } from './register-scanner.js'
import { formatYAML } from './yaml-formatter.js'

const REPORT_FORMATTERS = { json: formatJSON, yaml: formatYAML }

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
  /** Output format: table, json or yaml (default: table) */
  format?: OutputFormat
  /** File to write the result to instead of printing it (json and yaml formats only) */
  outputFile?: string
  /** Connection port (for JSON and YAML metadata) */
  port?: string
}

/**
 * Write the report to the output file
 *
 * A scan can take minutes and cannot be repeated for free. If the file cannot
 * be written, for example because the disk is full, the report is printed to
 * stdout instead, so the result is not lost, and the error is thrown.
 */
async function writeReportFile(file: string, report: string): Promise<void> {
  try {
    await writeFile(file, `${report}\n`)
  } catch (error) {
    // The caller exits right after the error. Wait for the report to reach stdout,
    // or a pipe that is not read fast enough would get only the start of it.
    await new Promise<void>((resolve) => process.stdout.write(`${report}\n`, () => resolve()))
    // A failed write always fails with a system error, which has a message
    throw new Error(
      `Cannot write to ${file}: ${(error as Error).message}. The report is printed to stdout instead.`
    )
  }
}

/**
 * Run a register profile scan with console output
 *
 * The json and yaml formats print only the document, so stdout can be piped.
 * With an output file nothing is printed to stdout: the document goes to the
 * file and a one-line summary goes to stderr. If the file cannot be written,
 * the document is printed to stdout and the function throws.
 *
 * @param options - Scan configuration
 */
export async function runProfileScan(options: ProfileScanOptions): Promise<void> {
  const {
    transport,
    type,
    startAddress,
    endAddress,
    batchSize,
    format = 'table',
    outputFile,
    port,
  } = options
  const results: ScanResult[] = []
  const isTable = format === 'table'

  try {
    if (isTable) {
      console.log(`Scanning ${type} registers from ${startAddress} to ${endAddress}...`)
      console.log()
    }

    let lastProgressUpdate = 0
    await scanRegisters({
      transport,
      type,
      startAddress,
      endAddress,
      ...(batchSize !== undefined && { batchSize }),
      onProgress: (current, total) => {
        if (isTable) {
          const now = Date.now()
          if (now - lastProgressUpdate >= PROGRESS_UPDATE_INTERVAL_MS || current === total) {
            process.stdout.write(`\r${formatProgress(current, total)}`)
            lastProgressUpdate = now
          }
        }
      },
      onResult: (result) => {
        results.push(result)
      },
    })

    if (isTable) {
      console.log('\n')
      console.log('Scan complete!')
      console.log()
      console.log(formatSummary(results))
    } else {
      const report = REPORT_FORMATTERS[format](results, {
        type,
        startAddress,
        endAddress,
        batchSize: batchSize ?? DEFAULT_BATCH_SIZE,
        port: port ?? '',
      })

      if (outputFile === undefined) {
        console.log(report)
      } else {
        await writeReportFile(outputFile, report)
        const failed = results.filter((result) => !result.success).length
        console.error(
          `Wrote ${results.length} registers (${results.length - failed} ok, ${failed} failed) to ${outputFile}`
        )
      }
    }
  } finally {
    await transport.close()
  }
}
