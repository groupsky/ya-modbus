#!/usr/bin/env node

import chalk from 'chalk'
import { Command } from 'commander'

import { validateConfig } from './config-validator.js'
import { loadConfig } from './config.js'
import { getPackageInfo } from './package-info.js'
import type { MqttBridgeConfig } from './types.js'

import { createBridge } from './index.js'

export const program = new Command()

const packageInfo = getPackageInfo()
program.name('ya-modbus-bridge').description(packageInfo.description).version(packageInfo.version)

// Error handler for command execution
program.exitOverride() // Prevent automatic exit, let us handle errors
program.configureOutput({
  writeErr: (str) => process.stderr.write(str),
})

program
  .command('run')
  .description('Run the MQTT bridge')
  .option('-c, --config <path>', 'Path to configuration file')
  .option('--mqtt-url <url>', 'MQTT broker URL (mqtt://, mqtts://, ws://, wss://)')
  .option('--mqtt-client-id <id>', 'MQTT client identifier')
  .option('--mqtt-username <username>', 'MQTT authentication username')
  .option('--mqtt-password <password>', 'MQTT authentication password')
  .option('--mqtt-reconnect-period <ms>', 'Reconnection interval in milliseconds', parseInt)
  .option('--topic-prefix <prefix>', 'Topic prefix for all MQTT topics (default: modbus)')
  .option('--state-dir <path>', 'Directory path for state persistence')
  .action(async (options: RunCommandOptions) => {
    try {
      await runCommand(options)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

interface RunCommandOptions {
  config?: string
  mqttUrl?: string
  mqttClientId?: string
  mqttUsername?: string
  mqttPassword?: string
  mqttReconnectPeriod?: number
  topicPrefix?: string
  stateDir?: string
}

async function runCommand(options: RunCommandOptions): Promise<void> {
  console.log(chalk.blue('Loading configuration...'))

  let config: MqttBridgeConfig
  if (options.config) {
    // Load from file
    config = await loadConfig(options.config)
    // Override with CLI options if provided
    if (options.mqttUrl) config.mqtt.url = options.mqttUrl
    if (options.mqttClientId) config.mqtt.clientId = options.mqttClientId
    if (options.mqttUsername) config.mqtt.username = options.mqttUsername
    if (options.mqttPassword) config.mqtt.password = options.mqttPassword
    if (options.mqttReconnectPeriod) config.mqtt.reconnectPeriod = options.mqttReconnectPeriod
    if (options.topicPrefix) config.topicPrefix = options.topicPrefix
    if (options.stateDir) config.stateDir = options.stateDir
  } else {
    // Build from CLI options only
    if (!options.mqttUrl) {
      throw new Error('Either --config or --mqtt-url must be provided')
    }
    config = {
      mqtt: {
        url: options.mqttUrl,
        ...(options.mqttClientId && { clientId: options.mqttClientId }),
        ...(options.mqttUsername && { username: options.mqttUsername }),
        ...(options.mqttPassword && { password: options.mqttPassword }),
        ...(options.mqttReconnectPeriod && { reconnectPeriod: options.mqttReconnectPeriod }),
      },
      ...(options.topicPrefix && { topicPrefix: options.topicPrefix }),
      ...(options.stateDir && { stateDir: options.stateDir }),
    }
  }

  // Validate configuration after merging CLI options
  validateConfig(config)

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
}
