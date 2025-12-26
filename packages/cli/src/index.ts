#!/usr/bin/env node

import { Command } from 'commander'

import { readCommand, type ReadOptions } from './commands/read.js'
import { showDefaultsCommand, type ShowDefaultsOptions } from './commands/show-defaults.js'
import { writeCommand, type WriteOptions } from './commands/write.js'

/**
 * Add common connection and driver options to a command
 *
 * @param command - Commander.js command instance
 * @returns The command with connection options added
 */
function addConnectionOptions(command: Command): Command {
  return command
    .option('-d, --driver <package>', 'Driver package name (e.g., ya-modbus-driver-xymd1)')
    .option('-p, --port <path>', 'Serial port for RTU (e.g., /dev/ttyUSB0, COM3)')
    .option('-h, --host <host>', 'TCP host for Modbus TCP (e.g., 192.168.1.100)')
    .option('--tcp-port <port>', 'TCP port (default: 502)', parseInt)
    .requiredOption('-s, --slave-id <id>', 'Modbus slave ID (1-247)', parseInt)
    .option('-b, --baud-rate <rate>', 'Baud rate (RTU only)', parseInt)
    .option('--parity <type>', 'Parity: none, even, odd (RTU only, default: even)')
    .option('--data-bits <bits>', 'Data bits: 7 or 8 (RTU only, default: 8)', parseInt)
    .option('--stop-bits <bits>', 'Stop bits: 1 or 2 (RTU only, default: 1)', parseInt)
    .option('--timeout <ms>', 'Response timeout in milliseconds (default: 1000)', parseInt)
}

const program = new Command()

program
  .name('ya-modbus')
  .description('CLI tool for testing and developing Modbus device drivers')
  .version('0.0.0')

// Read command
addConnectionOptions(program.command('read').description('Read data points from device'))
  .option('--data-point <id...>', 'Data point ID(s) to read')
  .option('--all', 'Read all readable data points')
  .option('-f, --format <type>', 'Output format: table or json (default: table)', 'table')
  .action(async (options: ReadOptions & { tcpPort?: number }) => {
    try {
      // Conditionally include port (don't set to undefined due to exactOptionalPropertyTypes)
      const { tcpPort: _tcpPort, ...commandOptions } = options
      await readCommand(commandOptions)
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`)
      process.exit(1)
    }
  })

// Write command
addConnectionOptions(program.command('write').description('Write data point to device'))
  .requiredOption('--data-point <id>', 'Data point ID to write')
  .requiredOption('--value <value>', 'Value to write')
  .option('-y, --yes', 'Skip confirmation prompt')
  .option('--verify', 'Read back and verify written value')
  .action(async (options: WriteOptions & { tcpPort?: number }) => {
    try {
      // Conditionally include port (don't set to undefined due to exactOptionalPropertyTypes)
      const { tcpPort: _tcpPort, ...commandOptions } = options
      await writeCommand(commandOptions)
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`)
      process.exit(1)
    }
  })

// Show defaults command
program
  .command('show-defaults')
  .description('Show driver DEFAULT_CONFIG and SUPPORTED_CONFIG')
  .option('-d, --driver <package>', 'Driver package name')
  .option('--local', 'Load from local package (cwd)')
  .option('-f, --format <type>', 'Output format: table or json (default: table)', 'table')
  .action(async (options: ShowDefaultsOptions) => {
    try {
      await showDefaultsCommand(options)
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`)
      process.exit(1)
    }
  })

export { program }
