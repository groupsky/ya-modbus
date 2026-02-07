#!/usr/bin/env node
/**
 * CLI interface for Modbus emulator
 */

import { Command } from 'commander'

import { ModbusEmulator } from './emulator.js'
import type { EmulatorConfig } from './types/config.js'
import { loadConfig } from './utils/config-loader.js'

interface CliOptions {
  config?: string
  transport?: string
  port?: string
  host?: string
  baudRate?: number
  parity?: string
  lock?: boolean
  slaveId?: number
  verbose?: boolean
  quiet?: boolean
  logRequests?: boolean
}

const program = new Command()

program
  .name('ya-modbus-emulator')
  .description('Modbus device emulator for testing drivers without physical hardware')
  .version('0.1.0')

program
  .option('-c, --config <file>', 'Configuration file (YAML or JSON)')
  .option('-t, --transport <type>', 'Transport type: tcp|rtu|memory')
  .option('-p, --port <port>', 'TCP port number or serial port path')
  .option('-H, --host <host>', 'TCP host address (default: 0.0.0.0)')
  .option('-b, --baud-rate <rate>', 'Serial baud rate (default: 9600)', parseInt)
  .option('--parity <type>', 'Serial parity: none|even|odd (default: none)')
  .option('--lock <boolean>', 'Enable serial port locking (default: true)', (value) =>
    value === 'true' ? true : value === 'false' ? false : undefined
  )
  .option('-s, --slave-id <id>', 'Slave ID (required if no config file)', parseInt)
  .option('-v, --verbose', 'Enable verbose logging')
  .option('-q, --quiet', 'Suppress all output except errors')
  .option('--log-requests', 'Log all Modbus requests/responses')

program.parse()

// Type assertion needed for TypeScript strict mode with noUncheckedIndexedAccess
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
const options = program.opts() as CliOptions

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  try {
    // Load configuration
    let config: EmulatorConfig
    let devices: Array<{ slaveId: number }> = []

    if (options.config !== undefined) {
      // Load from config file
      const fileConfig = await loadConfig(options.config)

      // Build config object only with defined properties (exactOptionalPropertyTypes)
      config = {
        transport: fileConfig.transport.type,
        ...(fileConfig.transport.port !== undefined && { port: fileConfig.transport.port }),
        ...(fileConfig.transport.host !== undefined && { host: fileConfig.transport.host }),
        ...(fileConfig.transport.baudRate !== undefined && {
          baudRate: fileConfig.transport.baudRate,
        }),
        ...(fileConfig.transport.parity !== undefined && { parity: fileConfig.transport.parity }),
        ...(fileConfig.transport.dataBits !== undefined && {
          dataBits: fileConfig.transport.dataBits,
        }),
        ...(fileConfig.transport.stopBits !== undefined && {
          stopBits: fileConfig.transport.stopBits,
        }),
        ...(fileConfig.transport.lock !== undefined && { lock: fileConfig.transport.lock }),
      }

      devices = fileConfig.devices as Array<{ slaveId: number }>
    } else {
      // Build from CLI args
      if (options.transport === undefined) {
        console.error('Error: --transport is required when not using --config')
        process.exit(1)
      }

      if (options.slaveId === undefined) {
        console.error('Error: --slave-id is required when not using --config')
        process.exit(1)
      }

      config = {
        transport: options.transport as 'tcp' | 'rtu' | 'memory',
        ...(options.port !== undefined && { port: options.port }),
        ...(options.host !== undefined && { host: options.host }),
        ...(options.baudRate !== undefined && { baudRate: options.baudRate }),
        ...(options.parity !== undefined && {
          parity: options.parity as 'none' | 'even' | 'odd',
        }),
        ...(options.lock !== undefined && { lock: options.lock }),
      }

      devices = [{ slaveId: options.slaveId }]
    }

    // Create emulator
    const emulator = new ModbusEmulator(config)

    // Add devices
    for (const deviceConfig of devices) {
      emulator.addDevice(deviceConfig)
    }

    // Start emulator
    await emulator.start()

    if (options.quiet !== true) {
      console.log('[INFO] Starting Modbus emulator...')
      console.log(
        `[INFO] Transport: ${config.transport.toUpperCase()} on ${config.port ?? 'memory'}`
      )
      console.log(`[INFO] Devices: ${devices.length}`)
      devices.forEach((device) => {
        console.log(`[INFO]   - Slave ID ${device.slaveId}`)
      })
      console.log('[INFO] Emulator started successfully')
      console.log('[INFO] Press Ctrl+C to stop')
    }

    // Handle shutdown
    const shutdown = async (): Promise<void> => {
      if (options.quiet !== true) {
        console.log('\n[INFO] Shutting down...')
      }
      await emulator.stop()
      if (options.quiet !== true) {
        console.log('[INFO] Emulator stopped')
      }
      process.exit(0)
    }

    process.on('SIGINT', () => {
      void shutdown()
    })
    process.on('SIGTERM', () => {
      void shutdown()
    })
  } catch (error) {
    console.error('[ERROR]', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('[ERROR]', error instanceof Error ? error.message : String(error))
  process.exit(1)
})

export { main }
