#!/usr/bin/env node

/**
 * CLI program for device profiler
 */

import { getCallerPackageInfo } from '@ya-modbus/driver-loader'
import type { DataBits, Parity, StopBits } from '@ya-modbus/driver-types'
import { createTransport } from '@ya-modbus/transport'
import { Command, Option } from 'commander'

import { runProfileScan } from './cli.js'
import { MAX_PORT, MIN_PORT } from './constants.js'
import { OUTPUT_FORMATS, type OutputFormat } from './output-format.js'
import { RegisterType } from './read-tester.js'
import { parseInteger, validateOptions } from './validation.js'

interface CliOptions {
  port: string
  slaveId: number
  type: string
  start: number
  end: number
  batch: number
  baud: number
  parity: Parity
  dataBits: DataBits
  stopBits: StopBits
  timeout: number
  format: OutputFormat
}

export const program = new Command()

program
  .name('ya-modbus-profile')
  .description('Profile Modbus devices by scanning register ranges')
  .version(getCallerPackageInfo().version)
  .requiredOption('--port <port>', 'Serial port (e.g., /dev/ttyUSB0) or TCP host:port')
  .requiredOption('--slave-id <id>', 'Modbus slave ID (1-247)', parseInteger)
  .option('--type <type>', 'Register type: holding or input', 'holding')
  .option('--start <address>', 'Start register address', parseInteger, 0)
  .option('--end <address>', 'End register address', parseInteger, 100)
  .option('--batch <size>', 'Batch size for reads', parseInteger, 10)
  .option('--baud <rate>', 'Baud rate for RTU', parseInteger, 9600)
  .addOption(
    new Option('--parity <parity>', 'Parity for RTU')
      .choices(['none', 'even', 'odd'])
      .default('none')
  )
  .option('--data-bits <bits>', 'Data bits for RTU', parseInteger, 8)
  .option('--stop-bits <bits>', 'Stop bits for RTU', parseInteger, 1)
  .option('--timeout <ms>', 'Response timeout in milliseconds', parseInteger, 1000)
  .addOption(
    new Option('-f, --format <format>', 'Output format: table, json or yaml')
      .choices(OUTPUT_FORMATS)
      .default('table')
  )
  .action(async (options: CliOptions) => {
    try {
      validateOptions(options)

      const registerType = options.type === 'input' ? RegisterType.Input : RegisterType.Holding

      let transport: Awaited<ReturnType<typeof createTransport>>

      if (options.port.includes(':')) {
        const parts = options.port.split(':')
        const host = parts[0]
        const portStr = parts[1]
        if (!host || !portStr) {
          throw new Error('Invalid TCP address format. Expected host:port')
        }
        const port = parseInt(portStr, 10)
        if (isNaN(port) || port < MIN_PORT || port > MAX_PORT) {
          throw new Error(
            `Invalid port number: ${portStr}. Must be between ${MIN_PORT} and ${MAX_PORT}`
          )
        }
        transport = await createTransport({
          host,
          port,
          slaveId: options.slaveId,
          timeout: options.timeout,
        })
      } else {
        transport = await createTransport({
          port: options.port,
          baudRate: options.baud,
          dataBits: options.dataBits,
          parity: options.parity,
          stopBits: options.stopBits,
          slaveId: options.slaveId,
          timeout: options.timeout,
        })
      }

      await runProfileScan({
        transport,
        type: registerType,
        startAddress: options.start,
        endAddress: options.end,
        batchSize: options.batch,
        format: options.format,
        port: options.port,
      })
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })
