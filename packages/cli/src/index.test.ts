import * as discoverModule from './commands/discover.js'
import * as readModule from './commands/read.js'
import * as showDefaultsModule from './commands/show-defaults.js'
import * as writeModule from './commands/write.js'

import { program } from './index.js'

jest.mock('./commands/read.js')
jest.mock('./commands/write.js')
jest.mock('./commands/show-defaults.js')
jest.mock('./commands/discover.js')

describe('CLI Entry Point - Integration Tests', () => {
  let consoleErrorSpy: jest.SpyInstance
  let processExitSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  describe('Program Configuration', () => {
    it('should have correct name', () => {
      expect(program.name()).toBe('ya-modbus')
    })

    it('should have correct description', () => {
      expect(program.description()).toBe(
        'CLI tool for testing and developing Modbus device drivers'
      )
    })

    it('should have correct version', () => {
      expect(program.version()).toBe('0.0.0')
    })
  })

  describe('Read Command', () => {
    it('should execute read command with all RTU connection parameters', async () => {
      const mockReadCommand = jest.mocked(readModule.readCommand)
      mockReadCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'read',
        '--driver',
        'test-driver',
        '--port',
        '/dev/ttyUSB0',
        '--slave-id',
        '1',
        '--baud-rate',
        '9600',
        '--parity',
        'none',
        '--data-bits',
        '8',
        '--stop-bits',
        '1',
        '--timeout',
        '2000',
        '--data-point',
        'temperature',
        'humidity',
        '--format',
        'json',
      ])

      expect(mockReadCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          driver: 'test-driver',
          port: '/dev/ttyUSB0',
          slaveId: 1,
          baudRate: 9600,
          parity: 'none',
          dataBits: 8,
          stopBits: 1,
          timeout: 2000,
          dataPoint: ['temperature', 'humidity'],
          format: 'json',
        })
      )
      expect(mockReadCommand).toHaveBeenCalledTimes(1)
    })

    it('should execute read command with TCP connection parameters', async () => {
      const mockReadCommand = jest.mocked(readModule.readCommand)
      mockReadCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'read',
        '--host',
        '192.168.1.100',
        '--tcp-port',
        '502',
        '--slave-id',
        '1',
        '--all',
      ])

      expect(mockReadCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          host: '192.168.1.100',
          slaveId: 1,
          all: true,
        })
      )
      // Should not include tcpPort in options (handled internally)
      expect(mockReadCommand).toHaveBeenCalledWith(
        expect.not.objectContaining({
          tcpPort: expect.anything(),
        })
      )
    })

    it('should execute read command with minimal parameters', async () => {
      const mockReadCommand = jest.mocked(readModule.readCommand)
      mockReadCommand.mockResolvedValue()

      await program.parseAsync(['node', 'ya-modbus', 'read', '--slave-id', '1', '--all'])

      expect(mockReadCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          slaveId: 1,
          all: true,
        })
      )
    })

    it('should handle command errors and display error message', async () => {
      const mockReadCommand = jest.mocked(readModule.readCommand)
      mockReadCommand.mockRejectedValue(new Error('Failed to connect to device'))

      await expect(
        program.parseAsync(['node', 'ya-modbus', 'read', '--slave-id', '1', '--all'])
      ).rejects.toThrow('process.exit called')

      expect(mockReadCommand).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Failed to connect to device')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should fail when required slave-id is missing', async () => {
      await expect(program.parseAsync(['node', 'ya-modbus', 'read', '--all'])).rejects.toThrow(
        'process.exit called'
      )

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should parse short option flags correctly', async () => {
      const mockReadCommand = jest.mocked(readModule.readCommand)
      mockReadCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'read',
        '-d',
        'test-driver',
        '-p',
        '/dev/ttyUSB0',
        '-s',
        '1',
        '-b',
        '19200',
        '-f',
        'json',
        '--all',
      ])

      expect(mockReadCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          driver: 'test-driver',
          port: '/dev/ttyUSB0',
          slaveId: 1,
          baudRate: 19200,
          format: 'json',
          all: true,
        })
      )
    })

    it('should handle multiple data points', async () => {
      const mockReadCommand = jest.mocked(readModule.readCommand)
      mockReadCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'read',
        '-s',
        '1',
        '--data-point',
        'temp',
        'humidity',
        'pressure',
      ])

      expect(mockReadCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          dataPoint: ['temp', 'humidity', 'pressure'],
        })
      )
    })

    it('should parse integer options correctly', async () => {
      const mockReadCommand = jest.mocked(readModule.readCommand)
      mockReadCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'read',
        '-s',
        '247',
        '--baud-rate',
        '115200',
        '--data-bits',
        '7',
        '--stop-bits',
        '2',
        '--timeout',
        '5000',
        '--all',
      ])

      expect(mockReadCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          slaveId: 247,
          baudRate: 115200,
          dataBits: 7,
          stopBits: 2,
          timeout: 5000,
        })
      )
    })

    it('should use default format when not specified', async () => {
      const mockReadCommand = jest.mocked(readModule.readCommand)
      mockReadCommand.mockResolvedValue()

      await program.parseAsync(['node', 'ya-modbus', 'read', '-s', '1', '--all'])

      expect(mockReadCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'table',
        })
      )
    })

    it('should accept both RTU and TCP parameters (transport layer decides)', async () => {
      const mockReadCommand = jest.mocked(readModule.readCommand)
      mockReadCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'read',
        '--port',
        '/dev/ttyUSB0',
        '--host',
        '192.168.1.100',
        '-s',
        '1',
        '--all',
      ])

      expect(mockReadCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          port: '/dev/ttyUSB0',
          host: '192.168.1.100',
          slaveId: 1,
        })
      )
    })

    it('should accept RTU-specific options without port', async () => {
      const mockReadCommand = jest.mocked(readModule.readCommand)
      mockReadCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'read',
        '-s',
        '1',
        '--baud-rate',
        '9600',
        '--parity',
        'even',
        '--all',
      ])

      expect(mockReadCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          slaveId: 1,
          baudRate: 9600,
          parity: 'even',
        })
      )
    })
  })

  describe('Write Command', () => {
    it('should execute write command with all parameters', async () => {
      const mockWriteCommand = jest.mocked(writeModule.writeCommand)
      mockWriteCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'write',
        '--driver',
        'test-driver',
        '--port',
        '/dev/ttyUSB0',
        '--slave-id',
        '1',
        '--data-point',
        'setpoint',
        '--value',
        '25.5',
        '--yes',
        '--verify',
      ])

      expect(mockWriteCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          driver: 'test-driver',
          port: '/dev/ttyUSB0',
          slaveId: 1,
          dataPoint: 'setpoint',
          value: '25.5',
          yes: true,
          verify: true,
        })
      )
      expect(mockWriteCommand).toHaveBeenCalledTimes(1)
    })

    it('should execute write command without confirmation flag', async () => {
      const mockWriteCommand = jest.mocked(writeModule.writeCommand)
      mockWriteCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'write',
        '--slave-id',
        '1',
        '--data-point',
        'output',
        '--value',
        '100',
      ])

      expect(mockWriteCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          slaveId: 1,
          dataPoint: 'output',
          value: '100',
        })
      )
      // yes flag should not be present
      expect(mockWriteCommand).toHaveBeenCalledWith(
        expect.not.objectContaining({
          yes: expect.anything(),
        })
      )
    })

    it('should handle write errors and display error message', async () => {
      const mockWriteCommand = jest.mocked(writeModule.writeCommand)
      mockWriteCommand.mockRejectedValue(new Error('Permission denied'))

      await expect(
        program.parseAsync([
          'node',
          'ya-modbus',
          'write',
          '--slave-id',
          '1',
          '--data-point',
          'test',
          '--value',
          '10',
        ])
      ).rejects.toThrow('process.exit called')

      expect(mockWriteCommand).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Permission denied')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should fail when required data-point is missing', async () => {
      await expect(
        program.parseAsync(['node', 'ya-modbus', 'write', '-s', '1', '--value', '100'])
      ).rejects.toThrow('process.exit called')

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should fail when required value is missing', async () => {
      await expect(
        program.parseAsync(['node', 'ya-modbus', 'write', '-s', '1', '--data-point', 'temp'])
      ).rejects.toThrow('process.exit called')

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should parse short option flags correctly', async () => {
      const mockWriteCommand = jest.mocked(writeModule.writeCommand)
      mockWriteCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'write',
        '-s',
        '1',
        '--data-point',
        'output',
        '--value',
        '50',
        '-y',
      ])

      expect(mockWriteCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          slaveId: 1,
          dataPoint: 'output',
          value: '50',
          yes: true,
        })
      )
    })

    it('should handle boolean flags correctly', async () => {
      const mockWriteCommand = jest.mocked(writeModule.writeCommand)
      mockWriteCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'write',
        '-s',
        '1',
        '--data-point',
        'test',
        '--value',
        '1',
        '--yes',
        '--verify',
      ])

      expect(mockWriteCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          yes: true,
          verify: true,
        })
      )
    })
  })

  describe('Show Defaults Command', () => {
    it('should execute show-defaults with driver package', async () => {
      const mockShowDefaultsCommand = jest.mocked(showDefaultsModule.showDefaultsCommand)
      mockShowDefaultsCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'show-defaults',
        '--driver',
        'ya-modbus-driver-xymd1',
        '--format',
        'json',
      ])

      expect(mockShowDefaultsCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          driver: 'ya-modbus-driver-xymd1',
          format: 'json',
        })
      )
      expect(mockShowDefaultsCommand).toHaveBeenCalledTimes(1)
    })

    it('should execute show-defaults with local driver', async () => {
      const mockShowDefaultsCommand = jest.mocked(showDefaultsModule.showDefaultsCommand)
      mockShowDefaultsCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'show-defaults',
        '--local',
        '--format',
        'table',
      ])

      expect(mockShowDefaultsCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          local: true,
          format: 'table',
        })
      )
    })

    it('should execute show-defaults with default format', async () => {
      const mockShowDefaultsCommand = jest.mocked(showDefaultsModule.showDefaultsCommand)
      mockShowDefaultsCommand.mockResolvedValue()

      await program.parseAsync(['node', 'ya-modbus', 'show-defaults', '--driver', 'test-driver'])

      expect(mockShowDefaultsCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          driver: 'test-driver',
          format: 'table', // default value
        })
      )
    })

    it('should handle driver loading errors', async () => {
      const mockShowDefaultsCommand = jest.mocked(showDefaultsModule.showDefaultsCommand)
      mockShowDefaultsCommand.mockRejectedValue(new Error('Driver package not found'))

      await expect(
        program.parseAsync(['node', 'ya-modbus', 'show-defaults', '--driver', 'invalid-driver'])
      ).rejects.toThrow('process.exit called')

      expect(mockShowDefaultsCommand).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Driver package not found')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should parse short option flags correctly', async () => {
      const mockShowDefaultsCommand = jest.mocked(showDefaultsModule.showDefaultsCommand)
      mockShowDefaultsCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'show-defaults',
        '-d',
        'test-driver',
        '-f',
        'json',
      ])

      expect(mockShowDefaultsCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          driver: 'test-driver',
          format: 'json',
        })
      )
    })

    it('should work without any options', async () => {
      const mockShowDefaultsCommand = jest.mocked(showDefaultsModule.showDefaultsCommand)
      mockShowDefaultsCommand.mockResolvedValue()

      await program.parseAsync(['node', 'ya-modbus', 'show-defaults'])

      expect(mockShowDefaultsCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'table',
        })
      )
    })
  })

  describe('Discover Command', () => {
    it('should execute discover with all parameters', async () => {
      const mockDiscoverCommand = jest.mocked(discoverModule.discoverCommand)
      mockDiscoverCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'discover',
        '--port',
        '/dev/ttyUSB0',
        '--driver',
        'test-driver',
        '--local',
        '--strategy',
        'thorough',
        '--timeout',
        '500',
        '--delay',
        '50',
        '--max-devices',
        '5',
        '--verbose',
        '--format',
        'json',
      ])

      expect(mockDiscoverCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          port: '/dev/ttyUSB0',
          driver: 'test-driver',
          local: true,
          strategy: 'thorough',
          timeout: 500,
          delay: 50,
          maxDevices: 5,
          verbose: true,
          format: 'json',
        })
      )
      expect(mockDiscoverCommand).toHaveBeenCalledTimes(1)
    })

    it('should execute discover with minimal parameters', async () => {
      const mockDiscoverCommand = jest.mocked(discoverModule.discoverCommand)
      mockDiscoverCommand.mockResolvedValue()

      await program.parseAsync(['node', 'ya-modbus', 'discover', '--port', '/dev/ttyUSB0'])

      expect(mockDiscoverCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          port: '/dev/ttyUSB0',
          strategy: 'quick', // default
        })
      )
    })

    it('should execute discover in silent mode', async () => {
      const mockDiscoverCommand = jest.mocked(discoverModule.discoverCommand)
      mockDiscoverCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'discover',
        '--port',
        '/dev/ttyUSB0',
        '--silent',
      ])

      expect(mockDiscoverCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          port: '/dev/ttyUSB0',
          silent: true,
        })
      )
    })

    it('should handle port access errors', async () => {
      const mockDiscoverCommand = jest.mocked(discoverModule.discoverCommand)
      mockDiscoverCommand.mockRejectedValue(new Error('Cannot open port: Permission denied'))

      await expect(
        program.parseAsync(['node', 'ya-modbus', 'discover', '--port', '/dev/ttyUSB0'])
      ).rejects.toThrow('process.exit called')

      expect(mockDiscoverCommand).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Cannot open port: Permission denied')
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should fail when required port is missing', async () => {
      await expect(program.parseAsync(['node', 'ya-modbus', 'discover'])).rejects.toThrow(
        'process.exit called'
      )

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should parse short option flags correctly', async () => {
      const mockDiscoverCommand = jest.mocked(discoverModule.discoverCommand)
      mockDiscoverCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'discover',
        '-p',
        '/dev/ttyUSB0',
        '-d',
        'test-driver',
        '-f',
        'json',
      ])

      expect(mockDiscoverCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          port: '/dev/ttyUSB0',
          driver: 'test-driver',
          format: 'json',
        })
      )
    })

    it('should parse integer options correctly', async () => {
      const mockDiscoverCommand = jest.mocked(discoverModule.discoverCommand)
      mockDiscoverCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'discover',
        '-p',
        '/dev/ttyUSB0',
        '--timeout',
        '2000',
        '--delay',
        '200',
        '--max-devices',
        '10',
      ])

      expect(mockDiscoverCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 2000,
          delay: 200,
          maxDevices: 10,
        })
      )
    })

    it('should handle strategy option correctly', async () => {
      const mockDiscoverCommand = jest.mocked(discoverModule.discoverCommand)
      mockDiscoverCommand.mockResolvedValue()

      await program.parseAsync([
        'node',
        'ya-modbus',
        'discover',
        '-p',
        '/dev/ttyUSB0',
        '--strategy',
        'thorough',
      ])

      expect(mockDiscoverCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy: 'thorough',
        })
      )
    })

    it('should use default strategy when not specified', async () => {
      const mockDiscoverCommand = jest.mocked(discoverModule.discoverCommand)
      mockDiscoverCommand.mockResolvedValue()

      await program.parseAsync(['node', 'ya-modbus', 'discover', '-p', '/dev/ttyUSB0'])

      expect(mockDiscoverCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          strategy: 'quick',
        })
      )
    })
  })
})
