#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import chalk from 'chalk'
import { Command } from 'commander'

import { loadConfig } from '../src/config.js'
import { createBridge } from '../src/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8')) as {
  version: string
  description: string
}

const program = new Command()

program.name('ya-modbus-bridge').description(packageJson.description).version(packageJson.version)

program
  .command('run')
  .description('Run the MQTT bridge')
  .requiredOption('-c, --config <path>', 'Path to configuration file')
  .action(async (options: { config: string }) => {
    try {
      console.log(chalk.blue('Loading configuration...'))
      const config = await loadConfig(options.config)

      // Sanitize URL to hide credentials
      const sanitizedUrl = config.mqtt.url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@')
      console.log(chalk.blue(`Starting MQTT bridge - connecting to ${sanitizedUrl}...`))

      const bridge = createBridge(config)
      await bridge.start()

      console.log(chalk.green('Bridge started successfully'))

      let isShuttingDown = false
      const handleShutdown = async (signal: string): Promise<void> => {
        if (isShuttingDown) {
          return
        }
        isShuttingDown = true

        console.log(chalk.yellow(`\nReceived ${signal}, shutting down...`))
        await bridge.stop()
        console.log(chalk.green('Bridge stopped'))
        process.exit(0)
      }

      process.on('SIGINT', () => {
        handleShutdown('SIGINT').catch((err) => {
          console.error(chalk.red('Shutdown error:'), err)
          process.exit(1)
        })
      })
      process.on('SIGTERM', () => {
        handleShutdown('SIGTERM').catch((err) => {
          console.error(chalk.red('Shutdown error:'), err)
          process.exit(1)
        })
      })
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program.parse()
