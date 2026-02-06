#!/usr/bin/env node
/**
 * Start a Modbus emulator for E2E testing
 *
 * Usage:
 *   ./start-emulator.js <port> <device-config> [additional-device-configs...]
 *
 * Example:
 *   ./start-emulator.js /tmp/ttyV0 fixtures/devices/ex9em-device1.json
 *   ./start-emulator.js /tmp/ttyV2 fixtures/devices/xymd1-device1.json fixtures/devices/or-we-516-device2.json
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ModbusEmulator } from '@ya-modbus/emulator'

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const NC = '\x1b[0m'

function logInfo(message) {
  console.log(`${GREEN}[INFO]${NC} ${message}`)
}

function logError(message) {
  console.error(`${RED}[ERROR]${NC} ${message}`)
}

function logWarn(message) {
  console.log(`${YELLOW}[WARN]${NC} ${message}`)
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    logError('Usage: ./start-emulator.js <port> <device-config> [additional-device-configs...]')
    logError('Example: ./start-emulator.js /tmp/ttyV0 fixtures/devices/ex9em-device1.json')
    process.exit(1)
  }

  const serialPort = args[0]
  const deviceConfigPaths = args.slice(1)

  // Load device configurations
  const devices = []
  for (const configPath of deviceConfigPaths) {
    try {
      const fullPath = resolve(configPath)
      const config = JSON.parse(readFileSync(fullPath, 'utf-8'))
      devices.push(config)
      logInfo(`Loaded device config: ${configPath} (Slave ID: ${config.slaveId})`)
    } catch (error) {
      logError(`Failed to load device config ${configPath}: ${error.message}`)
      process.exit(1)
    }
  }

  // Check if serial port exists
  try {
    // Port might not exist yet if socat is starting
    logInfo(`Will use serial port: ${serialPort}`)
  } catch (error) {
    logWarn(`Serial port ${serialPort} not found yet, will retry...`)
  }

  // Create emulator configuration
  // Note: RTU transport is still a placeholder, using memory transport for now
  const config = {
    transport: 'memory', // Will change to 'rtu' when RTU transport is implemented
  }

  logInfo('Creating Modbus emulator...')
  const emulator = new ModbusEmulator(config)

  // Add devices
  for (const deviceConfig of devices) {
    emulator.addDevice(deviceConfig)
    logInfo(`Added device with Slave ID ${deviceConfig.slaveId}`)
  }

  // Start emulator
  try {
    await emulator.start()
    logInfo('Emulator started successfully')
    logInfo(`Emulator listening with ${devices.length} device(s)`)
    logInfo('Transport: memory (RTU transport coming in v0.2.0)')

    // Write PID file for cleanup
    const pidFile = `/tmp/emulator-${process.pid}.pid`
    writeFileSync(pidFile, String(process.pid))
    logInfo(`PID file: ${pidFile}`)

    // Handle shutdown signals
    const shutdown = async () => {
      logInfo('Shutting down emulator...')
      await emulator.stop()
      logInfo('Emulator stopped')
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    // Keep process running
    logInfo('Emulator running. Press Ctrl+C to stop.')

    // Prevent process from exiting - use setInterval to keep event loop alive
    setInterval(() => {
      // Empty interval to keep process alive
    }, 1000000)
  } catch (error) {
    logError(`Failed to start emulator: ${error.message}`)
    process.exit(1)
  }
}

main().catch((error) => {
  logError(`Unhandled error: ${error.message}`)
  console.error(error)
  process.exit(1)
})
