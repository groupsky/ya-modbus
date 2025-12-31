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

      console.log(chalk.blue(`Starting MQTT bridge - connecting to ${config.mqtt.url}...`))

      const bridge = createBridge(config)
      await bridge.start()

      console.log(chalk.green('Bridge started successfully'))

      const handleShutdown = async (signal: string): Promise<void> => {
        console.log(chalk.yellow(`\nReceived ${signal}, shutting down...`))
        await bridge.stop()
        console.log(chalk.green('Bridge stopped'))
        process.exit(0)
      }

      process.on('SIGINT', () => {
        void handleShutdown('SIGINT')
      })
      process.on('SIGTERM', () => {
        void handleShutdown('SIGTERM')
      })
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program.parse()
