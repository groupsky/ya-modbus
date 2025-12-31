import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

import { program } from './cli.js'
import * as configModule from './utils/config.js'

import * as indexModule from './index.js'

jest.mock('./utils/config.js')
jest.mock('./index.js')
jest.mock('./utils/package-info.js', () => ({
  getPackageInfo: () => ({
    version: '0.0.0',
    description:
      'MQTT bridge for ya-modbus - orchestrates device management, polling, and MQTT publishing',
  }),
}))

/**
 * CLI integration tests for ya-modbus-bridge
 *
 * Testing Strategy:
 * - Uses program.parseAsync() to simulate command-line usage
 * - Mocks only external boundaries (config loading from files, bridge creation)
 * - Uses real config validation to test behavior
 * - Tests error handling and process.exit behavior
 * - Signal handlers deferred to Phase 2 integration tests with Aedes
 */

describe('CLI - ya-modbus-bridge', () => {
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance
  let processExitSpy: jest.SpyInstance
  let processOnSpy: jest.SpyInstance
  let mockBridge: any

  beforeEach(() => {
    jest.clearAllMocks()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    // Temporarily disable process.exit mock to see actual test failures
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      // Don't throw, just prevent actual exit
      return undefined as never
    }) as any)
    // Mock process.on to prevent actual signal handlers from being registered
    processOnSpy = jest.spyOn(process, 'on').mockImplementation(() => process)

    // Mock bridge instance
    mockBridge = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    }

    jest.mocked(indexModule.createBridge).mockReturnValue(mockBridge)
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
    processOnSpy.mockRestore()
  })

  afterAll(() => {
    // Ensure all mocks are fully restored after all tests
    jest.restoreAllMocks()
  })

  describe('Help Output', () => {
    let stdoutWriteSpy: jest.SpyInstance

    beforeEach(() => {
      stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
    })

    afterEach(() => {
      stdoutWriteSpy.mockRestore()
    })

    it('should display root help', async () => {
      await expect(program.parseAsync(['node', 'ya-modbus-bridge', '--help'])).rejects.toThrow(
        Error
      )

      const output = stdoutWriteSpy.mock.calls.map((call) => call[0]).join('')
      expect(output).toMatchInlineSnapshot(`
        "Usage: ya-modbus-bridge [options] [command]

        MQTT bridge for ya-modbus - orchestrates device management, polling, and MQTT
        publishing

        Options:
          -V, --version   output the version number
          -h, --help      display help for command

        Commands:
          run [options]   Run the MQTT bridge
          help [command]  display help for command
        "
      `)
    })

    it('should display run command help', async () => {
      await expect(
        program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--help'])
      ).rejects.toThrow(Error)

      const output = stdoutWriteSpy.mock.calls.map((call) => call[0]).join('')
      expect(output).toMatchInlineSnapshot(`
        "Usage: ya-modbus-bridge run [options]

        Run the MQTT bridge

        Options:
          -c, --config <path>           Path to configuration file
          --mqtt-url <url>              MQTT broker URL (mqtt://, mqtts://, ws://,
                                        wss://)
          --mqtt-client-id <id>         MQTT client identifier
          --mqtt-username <username>    MQTT authentication username
          --mqtt-password <password>    MQTT authentication password
          --mqtt-reconnect-period <ms>  Reconnection interval in milliseconds
          --topic-prefix <prefix>       Topic prefix for all MQTT topics (default:
                                        modbus)
          --state-dir <path>            Directory path for state persistence
          -h, --help                    display help for command
        "
      `)
    })
  })

  describe('Program Configuration', () => {
    it('should have correct name', () => {
      expect(program.name()).toBe('ya-modbus-bridge')
    })

    it('should have correct description', () => {
      expect(program.description()).toBe(
        'MQTT bridge for ya-modbus - orchestrates device management, polling, and MQTT publishing'
      )
    })

    it('should have correct version', () => {
      expect(program.version()).toBe('0.0.0')
    })
  })

  describe('Run Command - Config File', () => {
    it('should load config from file and start bridge', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://localhost:1883',
          clientId: 'test-bridge',
        },
      }

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      expect(configModule.loadConfig).toHaveBeenCalledWith('config.json')
      expect(indexModule.createBridge).toHaveBeenCalledWith(mockConfig)
      expect(mockBridge.start).toHaveBeenCalled()
    })

    it('should override config with CLI options', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      }

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)

      await program.parseAsync([
        'node',
        'ya-modbus-bridge',
        'run',
        '--config',
        'config.json',
        '--mqtt-url',
        'mqtt://broker.example.com:1883',
        '--mqtt-client-id',
        'override-client',
        '--topic-prefix',
        'test',
      ])

      expect(indexModule.createBridge).toHaveBeenCalledWith(
        expect.objectContaining({
          mqtt: expect.objectContaining({
            url: 'mqtt://broker.example.com:1883',
            clientId: 'override-client',
          }),
          topicPrefix: 'test',
        })
      )
      expect(mockBridge.start).toHaveBeenCalled()
    })
  })

  describe('Run Command - CLI Options Only', () => {
    it('should build config from CLI options when no config file', async () => {
      await program.parseAsync([
        'node',
        'ya-modbus-bridge',
        'run',
        '--mqtt-url',
        'mqtt://localhost:1883',
      ])

      expect(configModule.loadConfig).not.toHaveBeenCalled()
      expect(indexModule.createBridge).toHaveBeenCalledWith({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })
      expect(mockBridge.start).toHaveBeenCalled()
    })

    it('should build config with all CLI options', async () => {
      await program.parseAsync([
        'node',
        'ya-modbus-bridge',
        'run',
        '--mqtt-url',
        'mqtt://broker:1883',
        '--mqtt-client-id',
        'cli-client',
        '--mqtt-username',
        'user',
        '--mqtt-password',
        'pass',
        '--mqtt-reconnect-period',
        '10000',
        '--topic-prefix',
        'test',
        '--state-dir',
        '/tmp/state',
      ])

      expect(indexModule.createBridge).toHaveBeenCalledWith({
        mqtt: {
          url: 'mqtt://broker:1883',
          clientId: 'cli-client',
          username: 'user',
          password: 'pass',
          reconnectPeriod: 10000,
        },
        topicPrefix: 'test',
        stateDir: '/tmp/state',
      })
      expect(mockBridge.start).toHaveBeenCalled()
    })

    it('should fail when neither config nor mqtt-url provided', async () => {
      await program.parseAsync(['node', 'ya-modbus-bridge', 'run'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        'Either --config or --mqtt-url must be provided'
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle config loading errors', async () => {
      jest.mocked(configModule.loadConfig).mockRejectedValue(new Error('File not found'))

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'missing.json'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        'File not found'
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should reject invalid MQTT URL protocol', async () => {
      await program.parseAsync([
        'node',
        'ya-modbus-bridge',
        'run',
        '--mqtt-url',
        'http://localhost:1883',
      ])

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.stringContaining('URL must start with mqtt://')
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should reject invalid URL format', async () => {
      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--mqtt-url', 'not-a-url'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.stringContaining('Invalid configuration')
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should handle bridge start errors', async () => {
      jest.mocked(configModule.loadConfig).mockResolvedValue({
        mqtt: { url: 'mqtt://localhost:1883' },
      })
      mockBridge.start.mockRejectedValue(new Error('Connection refused'))

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        'Connection refused'
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('URL Sanitization', () => {
    it('should sanitize URL with credentials', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://user:password@broker.example.com:1883',
        },
      }

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('mqtt://user:****@broker.example.com:1883')
      )
    })

    it('should not modify URL without credentials', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      }

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('mqtt://localhost:1883'))
    })
  })

  // Signal Handlers testing deferred to Phase 2 integration tests
  // Testing signal handlers requires process-level testing which is complex in unit tests
  // Will be covered comprehensively in integration tests with Aedes MQTT broker
})
