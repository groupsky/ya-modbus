#!/usr/bin/env node

import { Command } from 'commander'

import { discoverCommand, type DiscoverOptions } from './commands/discover.js'
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
  return (
    command
      // Driver Options
      .optionsGroup('Driver Options:')
      .option(
        '-d, --driver <package>',
        'Driver package name (e.g., ya-modbus-driver-xymd1). Use "show-defaults" to see driver config'
      )

      // Connection Options
      .optionsGroup('Connection Options:')
      .requiredOption(
        '-s, --slave-id <id>',
        'Modbus slave ID (1-247). May use driver default if available',
        parseInt
      )
      .option('--timeout <ms>', 'Response timeout in milliseconds (default: 1000)', parseInt)

      // RTU Connection
      .optionsGroup('RTU Connection (choose this OR TCP):')
      .option('-p, --port <path>', 'Serial port for RTU (e.g., /dev/ttyUSB0, COM3)')
      .option(
        '-b, --baud-rate <rate>',
        'Baud rate (RTU only). Uses driver default if not specified',
        parseInt
      )
      .option(
        '--parity <type>',
        'Parity: none, even, odd (RTU only). Uses driver default if not specified'
      )
      .option(
        '--data-bits <bits>',
        'Data bits: 7 or 8 (RTU only). Uses driver default if not specified',
        parseInt
      )
      .option(
        '--stop-bits <bits>',
        'Stop bits: 1 or 2 (RTU only). Uses driver default if not specified',
        parseInt
      )

      // TCP Connection
      .optionsGroup('TCP Connection (choose this OR RTU):')
      .option('-h, --host <host>', 'TCP host for Modbus TCP (e.g., 192.168.1.100)')
      .option('--tcp-port <port>', 'TCP port (default: 502)', parseInt)
  )
}

const program = new Command()

program
  .name('ya-modbus')
  .description('CLI tool for testing and developing Modbus device drivers')
  .version('0.0.0')
  .addHelpText(
    'after',
    `
Examples:
  $ ya-modbus read --port /dev/ttyUSB0 --slave-id 1 --driver ya-modbus-driver-xymd1 --all
  $ ya-modbus write --host 192.168.1.100 --slave-id 1 --data-point voltage --value 220
  $ ya-modbus discover --port /dev/ttyUSB0 --strategy quick
  $ ya-modbus show-defaults --driver ya-modbus-driver-xymd1

Documentation: https://github.com/groupsky/ya-modbus-mqtt-bridge-2
    `
  )

// Device Operations
program.commandsGroup('Device Operations:')

// Read command
addConnectionOptions(program.command('read').description('Read data points from device'))
  .optionsGroup('Data Selection:')
  .option('--data-point <id...>', 'Data point ID(s) to read')
  .option('--all', 'Read all readable data points')
  .optionsGroup('Output Options:')
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
  .optionsGroup('Data Options:')
  .requiredOption('--data-point <id>', 'Data point ID to write')
  .requiredOption('--value <value>', 'Value to write')
  .optionsGroup('Write Options:')
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

// Device Discovery
program.commandsGroup('Device Discovery:')

// Discover command
program
  .command('discover')
  .description('Discover Modbus devices on serial port by scanning slave IDs and parameters')
  .optionsGroup('Connection:')
  .requiredOption('-p, --port <path>', 'Serial port for RTU (e.g., /dev/ttyUSB0, COM3)')
  .optionsGroup('Driver Options:')
  .option('-d, --driver <package>', 'Driver package (uses SUPPORTED_CONFIG to limit scan)')
  .option('--local', 'Load driver from local package (cwd)')
  .optionsGroup('Discovery Options:')
  .option(
    '--strategy <type>',
    'Discovery strategy: quick (driver params) or thorough (all params)',
    'quick'
  )
  .option('--timeout <ms>', 'Response timeout in milliseconds (default: 1000)', parseInt)
  .option('--delay <ms>', 'Delay between attempts in milliseconds (default: 100)', parseInt)
  .option(
    '--max-devices <count>',
    'Maximum number of devices to find (default: 1, use 0 for unlimited)',
    parseInt
  )
  .optionsGroup('Output Options:')
  .option('--verbose', 'Show detailed progress with current parameters being tested')
  .option('--silent', 'Suppress all output except final result (useful for scripts)')
  .option('-f, --format <type>', 'Output format: table or json (default: table)', 'table')
  .action(async (options: DiscoverOptions) => {
    try {
      await discoverCommand(options)
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`)
      process.exit(1)
    }
  })

// Driver Utilities
program.commandsGroup('Driver Utilities:')

// Show defaults command
program
  .command('show-defaults')
  .description('Show driver DEFAULT_CONFIG and SUPPORTED_CONFIG')
  .optionsGroup('Driver Selection:')
  .option('-d, --driver <package>', 'Driver package name')
  .option('--local', 'Load from local package (cwd)')
  .optionsGroup('Output Options:')
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
