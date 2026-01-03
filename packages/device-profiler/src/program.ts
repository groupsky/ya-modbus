#!/usr/bin/env node

/**
 * CLI program for device profiler
 */

import type { DataBits, Parity, StopBits } from '@ya-modbus/driver-types'
import { createTransport } from '@ya-modbus/transport'
import { Command, Option } from 'commander'

import { runProfileScan } from './cli.js'
import { MAX_PORT, MIN_PORT } from './constants.js'
import { RegisterType } from './read-tester.js'

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
}

const parseNumber = (value: string): number => parseInt(value, 10)

export const program = new Command()

program
  .name('ya-modbus-profile')
  .description('Profile Modbus devices by scanning register ranges')
  .version('0.1.0')
  .requiredOption('--port <port>', 'Serial port (e.g., /dev/ttyUSB0) or TCP host:port')
  .requiredOption('--slave-id <id>', 'Modbus slave ID (1-247)', parseNumber)
  .option('--type <type>', 'Register type: holding or input', 'holding')
  .option('--start <address>', 'Start register address', parseNumber, 0)
  .option('--end <address>', 'End register address', parseNumber, 100)
  .option('--batch <size>', 'Batch size for reads', parseNumber, 10)
  .option('--baud <rate>', 'Baud rate for RTU', parseNumber, 9600)
  .addOption(
    new Option('--parity <parity>', 'Parity for RTU')
      .choices(['none', 'even', 'odd'])
      .default('none')
  )
  .option('--data-bits <bits>', 'Data bits for RTU', parseNumber, 8)
  .option('--stop-bits <bits>', 'Stop bits for RTU', parseNumber, 1)
  .option('--timeout <ms>', 'Response timeout in milliseconds', parseNumber, 1000)
  .action(async (options: CliOptions) => {
    try {
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
      })
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })
