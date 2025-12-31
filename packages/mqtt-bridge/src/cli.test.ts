import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

import { program } from './cli.js'
import * as configValidatorModule from './config-validator.js'
import * as configModule from './config.js'

import * as indexModule from './index.js'

jest.mock('./config.js')
jest.mock('./config-validator.js')
jest.mock('./index.js')
jest.mock('./package-info.js', () => ({
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
 * - Mocks config loading, validation, and bridge creation
 * - Tests error handling and process.exit behavior
 */
describe('CLI - ya-modbus-bridge', () => {
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance
  let processExitSpy: jest.SpyInstance
  let mockBridge: any

  beforeEach(() => {
    jest.clearAllMocks()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })

    // Mock bridge instance
    mockBridge = {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    }

    jest.mocked(indexModule.createBridge).mockReturnValue(mockBridge)
    jest.mocked(configValidatorModule.validateConfig).mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
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
      expect(configValidatorModule.validateConfig).toHaveBeenCalledWith(mockConfig)
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

      expect(configValidatorModule.validateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          mqtt: expect.objectContaining({
            url: 'mqtt://broker.example.com:1883',
            clientId: 'override-client',
          }),
          topicPrefix: 'test',
        })
      )
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
      expect(configValidatorModule.validateConfig).toHaveBeenCalledWith({
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      })
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

      expect(configValidatorModule.validateConfig).toHaveBeenCalledWith({
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
    })

    it('should fail when neither config nor mqtt-url provided', async () => {
      await expect(program.parseAsync(['node', 'ya-modbus-bridge', 'run'])).rejects.toThrow(
        'process.exit called'
      )

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

      await expect(
        program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'missing.json'])
      ).rejects.toThrow('process.exit called')

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        'File not found'
      )
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should handle validation errors', async () => {
      jest.mocked(configModule.loadConfig).mockResolvedValue({ mqtt: { url: 'invalid' } })
      jest.mocked(configValidatorModule.validateConfig).mockImplementation(() => {
        throw new Error('Invalid configuration: mqtt.url: URL must start with mqtt://')
      })

      await expect(
        program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])
      ).rejects.toThrow('process.exit called')

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

      await expect(
        program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])
      ).rejects.toThrow('process.exit called')

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
})
