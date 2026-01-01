import { writeFile, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { jest } from '@jest/globals'

import { program } from './cli.js'
import { processUtils, triggerSignal } from './utils/process.js'
import {
  startTestBroker,
  waitForClientReady,
  waitForAllClientsToDisconnect,
  type TestBroker,
} from './utils/test-utils.js'

jest.mock('./utils/process.js')
jest.mock('./utils/package-info.js')

/**
 * CLI Integration Tests
 *
 * These tests verify CLI behavior by calling the program directly
 * with mocked process utilities.
 */
describe('CLI Integration Tests', () => {
  let broker: TestBroker
  let testDir: string
  let consoleOutput: string[]

  beforeEach(async () => {
    broker = await startTestBroker()
    testDir = join(tmpdir(), `mqtt-bridge-cli-test-${Date.now()}`)
    await mkdir(testDir, { recursive: true })

    // Capture console output
    consoleOutput = []
    jest.spyOn(console, 'log').mockImplementation((...args) => {
      consoleOutput.push(args.join(' '))
    })
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      consoleOutput.push(args.join(' '))
    })
  })

  afterEach(async () => {
    await broker.close()
    await rm(testDir, { recursive: true, force: true })
    jest.restoreAllMocks()
  })

  function runProgram(args: string[]): Promise<any> {
    return program.parseAsync(['node', 'ya-modbus-bridge', ...args])
  }

  describe('Bridge Startup', () => {
    test('should start bridge via CLI with config file', async () => {
      const configPath = join(testDir, 'config.json')
      await writeFile(
        configPath,
        JSON.stringify({
          mqtt: {
            url: broker.url,
          },
        })
      )

      // Set up client ready listener BEFORE starting the program
      const clientReadyPromise = waitForClientReady(broker)

      // Start the CLI program (runs in background)
      await runProgram(['run', '--config', configPath])

      try {
        // Wait for client to be ready (indicates bridge has started)
        await clientReadyPromise

        // Verify bridge has connected
        expect(broker.broker.connectedClients).toBe(1)
      } finally {
        // Trigger shutdown
        triggerSignal('SIGTERM')

        // Wait for graceful shutdown to complete
        await waitForAllClientsToDisconnect(broker, 2000)
      }
    })

    test('should start bridge via CLI with command-line options', async () => {
      // Set up client ready listener BEFORE starting the program
      const clientReadyPromise = waitForClientReady(broker)

      // Start with MQTT URL from command line
      await runProgram(['run', '--mqtt-url', broker.url])

      try {
        // Wait for client to be ready
        await clientReadyPromise

        // Verify bridge has connected
        expect(broker.broker.connectedClients).toBe(1)
      } finally {
        // Trigger shutdown
        triggerSignal('SIGTERM')

        // Wait for graceful shutdown to complete
        await waitForAllClientsToDisconnect(broker, 2000)
      }
    })

    test('should override config with CLI options', async () => {
      const configPath = join(testDir, 'config.json')
      await writeFile(
        configPath,
        JSON.stringify({
          mqtt: {
            url: 'mqtt://wrong-url:1883', // Wrong URL
          },
        })
      )

      // Set up client ready listener BEFORE starting the program
      const clientReadyPromise = waitForClientReady(broker)

      // Start with config but override URL with correct one
      await runProgram(['run', '--config', configPath, '--mqtt-url', broker.url])

      try {
        // Wait for client to be ready (should connect to overridden URL)
        await clientReadyPromise

        // Verify bridge has connected to the correct broker
        expect(broker.broker.connectedClients).toBe(1)
      } finally {
        // Trigger shutdown
        triggerSignal('SIGTERM')

        // Wait for graceful shutdown to complete
        await waitForAllClientsToDisconnect(broker, 2000)
      }
    })

    test('should fail when neither config nor mqtt-url provided', async () => {
      const mockExit = processUtils.exit as jest.MockedFunction<typeof processUtils.exit>
      mockExit.mockClear()

      // Run program without required options
      await runProgram(['run'])

      // Wait for async error handling
      await new Promise((resolve) => setImmediate(resolve))

      // Verify exit was called with error code
      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })

  describe('Signal Handling', () => {
    test.each(['SIGTERM', 'SIGINT'])('should handle %s gracefully', async (signal) => {
      const configPath = join(testDir, 'config.json')
      await writeFile(
        configPath,
        JSON.stringify({
          mqtt: {
            url: broker.url,
          },
        })
      )

      // Set up client ready listener
      const clientReadyPromise = waitForClientReady(broker)

      // Start the program
      await runProgram(['run', '--config', configPath])

      // Wait for bridge to start
      await clientReadyPromise
      expect(broker.broker.connectedClients).toBe(1)

      // Set up disconnect listener before sending signal
      const disconnectPromise = waitForAllClientsToDisconnect(broker, 2000)

      // Send signal
      triggerSignal(signal)

      // Wait for graceful shutdown
      await disconnectPromise

      // Verify clean shutdown
      expect(broker.broker.connectedClients).toBe(0)
    })

    test('should prevent double shutdown on multiple signals', async () => {
      const configPath = join(testDir, 'config.json')
      await writeFile(
        configPath,
        JSON.stringify({
          mqtt: {
            url: broker.url,
          },
        })
      )

      // Track shutdown calls
      const mockExit = processUtils.exit as jest.MockedFunction<typeof processUtils.exit>
      mockExit.mockClear()

      // Set up client ready listener
      const clientReadyPromise = waitForClientReady(broker)

      // Start the program
      await runProgram(['run', '--config', configPath])

      // Wait for bridge to start
      await clientReadyPromise
      expect(broker.broker.connectedClients).toBe(1)

      // Set up disconnect listener
      const disconnectPromise = waitForAllClientsToDisconnect(broker, 2000)

      // Create promise to wait for exit call
      const exitPromise = new Promise<void>((resolve) => {
        mockExit.mockImplementationOnce(() => {
          resolve()
        })
      })

      // Send multiple signals quickly
      triggerSignal('SIGTERM')
      triggerSignal('SIGTERM')
      triggerSignal('SIGINT')

      // Wait for shutdown to complete
      await Promise.all([disconnectPromise, exitPromise])

      // Verify exit was only called once
      expect(mockExit).toHaveBeenCalledTimes(1)
      expect(mockExit).toHaveBeenCalledWith(0)
    })
  })

  describe('Configuration', () => {
    test('should sanitize credentials in log output', async () => {
      // Set up client ready listener
      const clientReadyPromise = waitForClientReady(broker)

      // Start with URL containing credentials (use localhost instead of actual address)
      const urlWithCreds = `mqtt://user:password@localhost:${broker.port}`
      await runProgram(['run', '--mqtt-url', urlWithCreds])

      try {
        // Wait for bridge to start
        await clientReadyPromise

        // Check console output for sanitization
        const allOutput = consoleOutput.join('\n')
        expect(allOutput).toContain('user:****@')
        expect(allOutput).not.toContain('user:password@')
      } finally {
        // Trigger shutdown
        triggerSignal('SIGTERM')

        // Wait for graceful shutdown to complete
        await waitForAllClientsToDisconnect(broker, 2000)
      }
    })

    test('should fail gracefully with malformed config', async () => {
      const configPath = join(testDir, 'invalid.json')
      await writeFile(configPath, '{ invalid json')

      const mockExit = processUtils.exit as jest.MockedFunction<typeof processUtils.exit>
      mockExit.mockClear()

      await runProgram(['run', '--config', configPath])
      await new Promise((resolve) => setImmediate(resolve))

      expect(mockExit).toHaveBeenCalledWith(1)
      expect(consoleOutput.join('\n')).toMatch(/invalid|malformed|parse|json|expected/i)
    })

    test('should fail with invalid MQTT URL', async () => {
      const mockExit = processUtils.exit as jest.MockedFunction<typeof processUtils.exit>
      mockExit.mockClear()

      await runProgram(['run', '--mqtt-url', 'not-a-valid-url'])
      await new Promise((resolve) => setImmediate(resolve))

      expect(mockExit).toHaveBeenCalledWith(1)
    })
  })
})
