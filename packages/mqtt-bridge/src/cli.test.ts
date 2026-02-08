import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'

import { program } from './cli.js'
import * as configModule from './utils/config.js'
import { processUtils, signalHandlers } from './utils/process.js'

import * as indexModule from './index.js'

jest.mock('./utils/config.js')
jest.mock('./utils/process.js')
jest.mock('./index.js')
jest.mock('./utils/package-info.js')

/**
 * CLI integration tests for ya-modbus-bridge
 *
 * Testing Strategy:
 * - Uses program.parseAsync() to simulate command-line usage
 * - Mocks only external boundaries (config loading, bridge creation, process utils)
 * - Uses real config validation to test behavior
 * - Tests error handling and signal handler registration
 */

describe('CLI - ya-modbus-bridge', () => {
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance
  let mockBridge: any

  beforeEach(() => {
    jest.clearAllMocks()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

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

    it('should override config with authentication and state options', async () => {
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
        '--mqtt-username',
        'testuser',
        '--mqtt-password',
        'testpass',
        '--mqtt-reconnect-period',
        '5000',
        '--state-dir',
        '/tmp/test-state',
      ])

      expect(indexModule.createBridge).toHaveBeenCalledWith(
        expect.objectContaining({
          mqtt: expect.objectContaining({
            url: 'mqtt://localhost:1883',
            username: 'testuser',
            password: 'testpass',
            reconnectPeriod: 5000,
          }),
          stateDir: '/tmp/test-state',
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
      expect(processUtils.exit).toHaveBeenCalledWith(1)
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
      expect(processUtils.exit).toHaveBeenCalledWith(1)
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
      expect(processUtils.exit).toHaveBeenCalledWith(1)
    })

    it('should reject invalid URL format', async () => {
      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--mqtt-url', 'not-a-url'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        expect.stringContaining('Invalid configuration')
      )
      expect(processUtils.exit).toHaveBeenCalledWith(1)
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
      expect(processUtils.exit).toHaveBeenCalledWith(1)
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

  describe('Device Loading from Config', () => {
    it('should load devices from config after bridge starts', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
        devices: [
          {
            deviceId: 'device1',
            driver: '@ya-modbus/driver-ex9em',
            connection: {
              type: 'rtu',
              port: '/dev/ttyUSB0',
              baudRate: 9600,
              slaveId: 1,
            },
            polling: {
              interval: 2000,
            },
          },
        ],
      }

      mockBridge.addDevice = jest.fn().mockResolvedValue(undefined)

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      expect(mockBridge.start).toHaveBeenCalled()
      expect(mockBridge.addDevice).toHaveBeenCalledWith(mockConfig.devices[0])
    })

    it('should load multiple devices from config', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
        devices: [
          {
            deviceId: 'rtu-device',
            driver: '@ya-modbus/driver-ex9em',
            connection: {
              type: 'rtu',
              port: '/dev/ttyUSB0',
              baudRate: 9600,
              slaveId: 1,
            },
          },
          {
            deviceId: 'tcp-device',
            driver: '@ya-modbus/driver-xymd1',
            connection: {
              type: 'tcp',
              host: 'localhost',
              port: 502,
              slaveId: 2,
            },
          },
        ],
      }

      mockBridge.addDevice = jest.fn().mockResolvedValue(undefined)

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      expect(mockBridge.start).toHaveBeenCalled()
      expect(mockBridge.addDevice).toHaveBeenCalledTimes(2)
      expect(mockBridge.addDevice).toHaveBeenCalledWith(mockConfig.devices[0])
      expect(mockBridge.addDevice).toHaveBeenCalledWith(mockConfig.devices[1])
    })

    it('should not call addDevice when config has no devices array', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      }

      mockBridge.addDevice = jest.fn().mockResolvedValue(undefined)

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      expect(mockBridge.start).toHaveBeenCalled()
      expect(mockBridge.addDevice).not.toHaveBeenCalled()
    })

    it('should not call addDevice when devices array is empty', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
        devices: [],
      }

      mockBridge.addDevice = jest.fn().mockResolvedValue(undefined)

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      expect(mockBridge.start).toHaveBeenCalled()
      expect(mockBridge.addDevice).not.toHaveBeenCalled()
    })

    it('should handle device loading errors gracefully', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
        devices: [
          {
            deviceId: 'device1',
            driver: '@ya-modbus/driver-ex9em',
            connection: {
              type: 'rtu',
              port: '/dev/ttyUSB0',
              baudRate: 9600,
              slaveId: 1,
            },
          },
        ],
      }

      mockBridge.addDevice = jest.fn().mockRejectedValue(new Error('Failed to load driver'))

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      expect(mockBridge.start).toHaveBeenCalled()
      expect(mockBridge.addDevice).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error:'),
        'Failed to load driver'
      )
      expect(processUtils.exit).toHaveBeenCalledWith(1)
    })
  })

  describe('Signal Handlers', () => {
    it('should register SIGINT handler', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      }

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      expect(processUtils.onSignal).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    })

    it('should register SIGTERM handler', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      }

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      expect(processUtils.onSignal).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    })

    it('should handle SIGINT shutdown gracefully', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      }

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      const sigintHandler = signalHandlers.get('SIGINT')
      expect(sigintHandler).toBeDefined()

      sigintHandler!()
      // Wait for async shutdown to complete
      await new Promise((resolve) => setImmediate(resolve))

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Received SIGINT, shutting down...')
      )
      expect(mockBridge.stop).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Bridge stopped'))
      expect(processUtils.exit).toHaveBeenCalledWith(0)
    })

    it('should handle SIGTERM shutdown gracefully', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      }

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      const sigtermHandler = signalHandlers.get('SIGTERM')
      expect(sigtermHandler).toBeDefined()

      sigtermHandler!()
      // Wait for async shutdown to complete
      await new Promise((resolve) => setImmediate(resolve))

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Received SIGTERM, shutting down...')
      )
      expect(mockBridge.stop).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Bridge stopped'))
      expect(processUtils.exit).toHaveBeenCalledWith(0)
    })

    it('should handle SIGINT shutdown errors', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      }

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)
      mockBridge.stop.mockRejectedValue(new Error('Stop failed'))

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      const sigintHandler = signalHandlers.get('SIGINT')
      expect(sigintHandler).toBeDefined()

      // Call the handler and wait for async error handling to complete
      sigintHandler!()
      // Wait for the promise rejection to be handled
      await new Promise((resolve) => setImmediate(resolve))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Shutdown error:'),
        expect.any(Error)
      )
      expect(processUtils.exit).toHaveBeenCalledWith(1)
    })

    it('should handle SIGTERM shutdown errors', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      }

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)
      mockBridge.stop.mockRejectedValue(new Error('Stop failed'))

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      const sigtermHandler = signalHandlers.get('SIGTERM')
      expect(sigtermHandler).toBeDefined()

      // Call the handler and wait for async error handling to complete
      sigtermHandler!()
      // Wait for the promise rejection to be handled
      await new Promise((resolve) => setImmediate(resolve))

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Shutdown error:'),
        expect.any(Error)
      )
      expect(processUtils.exit).toHaveBeenCalledWith(1)
    })

    it('should prevent multiple simultaneous shutdowns', async () => {
      const mockConfig = {
        mqtt: {
          url: 'mqtt://localhost:1883',
        },
      }

      jest.mocked(configModule.loadConfig).mockResolvedValue(mockConfig)

      // Make stop() slow to test concurrent shutdown prevention
      let stopResolver: () => void
      const stopPromise = new Promise<void>((resolve) => {
        stopResolver = resolve
      })
      mockBridge.stop.mockImplementation(() => stopPromise)

      await program.parseAsync(['node', 'ya-modbus-bridge', 'run', '--config', 'config.json'])

      const sigintHandler = signalHandlers.get('SIGINT')
      expect(sigintHandler).toBeDefined()

      // Start first shutdown (won't complete yet)
      sigintHandler!()

      // Try second shutdown (should be ignored)
      sigintHandler!()

      // Complete the stop
      stopResolver!()

      // Wait for shutdowns to complete
      await new Promise((resolve) => setImmediate(resolve))

      // Stop should only be called once
      expect(mockBridge.stop).toHaveBeenCalledTimes(1)
      // First shutdown should exit with 0
      expect(processUtils.exit).toHaveBeenCalledWith(0)
    })
  })
})
