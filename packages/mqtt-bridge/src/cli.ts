#!/usr/bin/env node

import { getCallerPackageInfo } from '@ya-modbus/driver-loader'
import { getSerialNodeWarning } from '@ya-modbus/transport'
import chalk from 'chalk'
import { Command, CommanderError } from 'commander'

import { checkDriver } from './driver-loader.js'
import { devicesByLine } from './poll-lines.js'
import type { MqttBridgeConfig } from './types.js'
import { ConfigValidationError, validateConfig } from './utils/config-validator.js'
import { loadConfig } from './utils/config.js'
import { processUtils } from './utils/process.js'

import { createBridge } from './index.js'

export const program = new Command()

const packageInfo = getCallerPackageInfo()
program.name('ya-modbus-bridge').description(packageInfo.description).version(packageInfo.version)

// Error handler for command execution
program.exitOverride() // Prevent automatic exit, let us handle errors
program.configureOutput({
  /* istanbul ignore next - commander internal error output */
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
  .option('--state-dir <path>', 'Not used yet: the bridge keeps no state on disk')
  .option(
    '--stats-interval <seconds>',
    'Publish device stats on {prefix}/{deviceId}/stats every N seconds (default: off)',
    parseInt
  )
  .option('--stats-log', 'Also log one line per device at every stats interval')
  .addHelpText(
    'after',
    '\nSet YA_MODBUS_DEBUG=1 to log the full error (stack and cause) of failed polls and each request that is sent again.'
  )
  .action(async (options: RunCommandOptions) => {
    try {
      await runCommand(options)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      processUtils.exit(1)
    }
  })

program
  .command('check')
  .description('Check a config file and the driver of each device')
  .requiredOption('-c, --config <path>', 'Path to configuration file')
  .addHelpText(
    'after',
    '\nIt opens no serial port and no MQTT connection. Devices with "enabled": false are not checked.'
  )
  .action(async (options: { config: string }) => {
    const errors = await checkCommand(options.config)
    for (const error of errors) console.error(chalk.red('✗'), error)
    if (errors.length) {
      console.error(chalk.red(`${errors.length} error(s) in ${options.config}`))
      processUtils.exit(1)
    } else {
      console.log(chalk.green(`✓ ${options.config} is valid`))
      processUtils.exit(0)
    }
  })

/**
 * Errors of a config file: the schema errors, or else repeated device IDs and the errors of each
 * enabled device's driver (the same checks that `run` does before it opens a port)
 */
async function checkCommand(configPath: string): Promise<string[]> {
  let config: MqttBridgeConfig
  try {
    config = await loadConfig(configPath)
  } catch (error) {
    if (error instanceof ConfigValidationError) return [...error.errors]
    return [error instanceof Error ? error.message : String(error)]
  }

  const errors: string[] = []
  const deviceIds = new Set<string>()
  for (const [index, device] of (config.devices ?? []).entries()) {
    // run rejects a repeated ID even when the device is disabled
    if (deviceIds.has(device.deviceId)) {
      errors.push(
        `devices[${index}] (${device.deviceId}): Device ${device.deviceId} already exists`
      )
      continue
    }
    deviceIds.add(device.deviceId)
    if (device.enabled === false) continue
    try {
      await checkDriver(device.driver, device.connection)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      errors.push(`devices[${index}] (${device.deviceId}): ${reason}`)
    }
  }
  return errors
}

interface RunCommandOptions {
  config?: string
  mqttUrl?: string
  mqttClientId?: string
  mqttUsername?: string
  mqttPassword?: string
  mqttReconnectPeriod?: number
  topicPrefix?: string
  stateDir?: string
  statsInterval?: number
  statsLog?: boolean
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
    if (options.statsInterval) config.statsInterval = options.statsInterval
    if (options.statsLog) config.statsLog = true
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
      ...(options.statsInterval && { statsInterval: options.statsInterval }),
      ...(options.statsLog && { statsLog: true }),
    }
  }

  // Validate configuration after merging CLI options
  validateConfig(config)

  if (config.stateDir !== undefined) {
    console.warn(
      chalk.yellow(
        'stateDir is set, but the bridge does not use it yet: it keeps no state on disk.'
      )
    )
  }

  if (config.devices?.some((device) => device.connection.type === 'rtu')) {
    const serialWarning = getSerialNodeWarning(process.version)
    if (serialWarning) console.warn(chalk.yellow(serialWarning))
  }

  // Sanitize URL to hide credentials
  const sanitizedUrl = config.mqtt.url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@')
  console.log(chalk.blue(`Starting MQTT bridge - connecting to ${sanitizedUrl}...`))

  const bridge = createBridge(config)
  await bridge.start()

  // Load devices from config if provided
  if (config.devices?.length) {
    console.log(chalk.blue(`Loading ${config.devices.length} device(s) from configuration...`))
    try {
      for (const [index, deviceConfig] of config.devices.entries()) {
        try {
          await bridge.addDevice(deviceConfig)
        } catch (error) {
          // With several devices on several buses the operator has to know which one is wrong
          const reason = error instanceof Error ? error.message : String(error)
          throw new Error(`devices[${index}] (${deviceConfig.deviceId}): ${reason}`, {
            cause: error,
          })
        }
        console.log(chalk.green(`✓ Loaded device: ${deviceConfig.deviceId}`))
      }
    } catch (error) {
      // The loaded devices and the MQTT connection stay open until the bridge stops
      await bridge
        .stop()
        .catch((stopError: unknown) => console.error(chalk.red('Shutdown error:'), stopError))
      throw error
    }
  }

  const polled = config.devices?.filter((device) => device.enabled !== false) ?? []
  for (const [line, devices] of devicesByLine(polled)) {
    if (devices[0]?.connection.pollOrder === 'fixed') {
      const order = devices.map((device) => device.deviceId).join(', ')
      console.log(chalk.blue(`The devices on ${line} take turns in a fixed order: ${order}`))
    }
  }

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
    processUtils.exit(0)
  }

  processUtils.onSignal('SIGINT', () => {
    handleShutdown('SIGINT').catch((err) => {
      console.error(chalk.red('Shutdown error:'), err)
      processUtils.exit(1)
    })
  })
  processUtils.onSignal('SIGTERM', () => {
    handleShutdown('SIGTERM').catch((err) => {
      console.error(chalk.red('Shutdown error:'), err)
      processUtils.exit(1)
    })
  })
}

/**
 * Bin entry point. exitOverride() makes commander throw on --help, --version
 * and usage errors, so exit with commander's exit code instead of crashing.
 */
export async function main(argv?: readonly string[]): Promise<void> {
  try {
    await program.parseAsync(argv)
  } catch (error) {
    if (error instanceof CommanderError) {
      processUtils.exit(error.exitCode)
      return
    }
    throw error
  }
}
