import { Command } from 'commander'

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
    let readCommand: Command

    beforeEach(() => {
      readCommand = program.commands.find((cmd) => cmd.name() === 'read')!
    })

    it('should be registered', () => {
      expect(readCommand).toBeDefined()
      expect(readCommand.description()).toBe('Read data points from device')
    })

    it('should have connection options', () => {
      const options = readCommand.options.map((opt) => opt.long)
      expect(options).toContain('--driver')
      expect(options).toContain('--port')
      expect(options).toContain('--host')
      expect(options).toContain('--tcp-port')
      expect(options).toContain('--slave-id')
      expect(options).toContain('--baud-rate')
      expect(options).toContain('--parity')
      expect(options).toContain('--data-bits')
      expect(options).toContain('--stop-bits')
      expect(options).toContain('--timeout')
    })

    it('should have read-specific options', () => {
      const options = readCommand.options.map((opt) => opt.long)
      expect(options).toContain('--data-point')
      expect(options).toContain('--all')
      expect(options).toContain('--format')
    })

    it('should have correct option descriptions and flags', () => {
      const getOption = (long: string): (typeof readCommand.options)[0] | undefined =>
        readCommand.options.find((opt) => opt.long === long)

      expect(getOption('--driver')).toMatchObject({
        flags: '-d, --driver <package>',
        description:
          'Driver package name (e.g., ya-modbus-driver-xymd1). Use "show-defaults" to see driver config',
      })

      expect(getOption('--port')).toMatchObject({
        flags: '-p, --port <path>',
        description: 'Serial port for RTU (e.g., /dev/ttyUSB0, COM3)',
      })

      expect(getOption('--host')).toMatchObject({
        flags: '-h, --host <host>',
        description: 'TCP host for Modbus TCP (e.g., 192.168.1.100)',
      })

      expect(getOption('--tcp-port')).toMatchObject({
        flags: '--tcp-port <port>',
        description: 'TCP port (default: 502)',
      })

      expect(getOption('--slave-id')).toMatchObject({
        flags: '-s, --slave-id <id>',
        description: 'Modbus slave ID (1-247). May use driver default if available',
      })

      expect(getOption('--baud-rate')).toMatchObject({
        flags: '-b, --baud-rate <rate>',
        description: 'Baud rate (RTU only). Uses driver default if not specified',
      })

      expect(getOption('--parity')).toMatchObject({
        flags: '--parity <type>',
        description: 'Parity: none, even, odd (RTU only). Uses driver default if not specified',
      })

      expect(getOption('--data-bits')).toMatchObject({
        flags: '--data-bits <bits>',
        description: 'Data bits: 7 or 8 (RTU only). Uses driver default if not specified',
      })

      expect(getOption('--stop-bits')).toMatchObject({
        flags: '--stop-bits <bits>',
        description: 'Stop bits: 1 or 2 (RTU only). Uses driver default if not specified',
      })

      expect(getOption('--timeout')).toMatchObject({
        flags: '--timeout <ms>',
        description: 'Response timeout in milliseconds (default: 1000)',
      })

      expect(getOption('--data-point')).toMatchObject({
        flags: '--data-point <id...>',
        description: 'Data point ID(s) to read',
      })

      expect(getOption('--all')).toMatchObject({
        flags: '--all',
        description: 'Read all readable data points',
      })

      expect(getOption('--format')).toMatchObject({
        flags: '-f, --format <type>',
        description: 'Output format: table or json (default: table)',
      })
    })

    it('should require slave-id', () => {
      const slaveIdOption = readCommand.options.find((opt) => opt.long === '--slave-id')
      expect(slaveIdOption?.required).toBe(true)
    })

    describe('Command-Line Integration', () => {
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

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Failed to connect to device')
        expect(processExitSpy).toHaveBeenCalledWith(1)
      })
    })
  })

  describe('Write Command', () => {
    let writeCommand: Command

    beforeEach(() => {
      writeCommand = program.commands.find((cmd) => cmd.name() === 'write')!
    })

    it('should be registered', () => {
      expect(writeCommand).toBeDefined()
      expect(writeCommand.description()).toBe('Write data point to device')
    })

    it('should have connection options', () => {
      const options = writeCommand.options.map((opt) => opt.long)
      expect(options).toContain('--driver')
      expect(options).toContain('--slave-id')
      expect(options).toContain('--timeout')
    })

    it('should have write-specific options', () => {
      const options = writeCommand.options.map((opt) => opt.long)
      expect(options).toContain('--data-point')
      expect(options).toContain('--value')
      expect(options).toContain('--yes')
      expect(options).toContain('--verify')
    })

    it('should have correct option descriptions and flags', () => {
      const getOption = (long: string): (typeof writeCommand.options)[0] | undefined =>
        writeCommand.options.find((opt) => opt.long === long)

      expect(getOption('--data-point')).toMatchObject({
        flags: '--data-point <id>',
        description: 'Data point ID to write',
      })

      expect(getOption('--value')).toMatchObject({
        flags: '--value <value>',
        description: 'Value to write',
      })

      expect(getOption('--yes')).toMatchObject({
        flags: '-y, --yes',
        description: 'Skip confirmation prompt',
      })

      expect(getOption('--verify')).toMatchObject({
        flags: '--verify',
        description: 'Read back and verify written value',
      })
    })

    it('should require data-point and value', () => {
      const dataPointOption = writeCommand.options.find((opt) => opt.long === '--data-point')
      const valueOption = writeCommand.options.find((opt) => opt.long === '--value')

      expect(dataPointOption?.required).toBe(true)
      expect(valueOption?.required).toBe(true)
    })

    describe('Command-Line Integration', () => {
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

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Permission denied')
        expect(processExitSpy).toHaveBeenCalledWith(1)
      })
    })
  })

  describe('Show Defaults Command', () => {
    let showDefaultsCommand: Command

    beforeEach(() => {
      showDefaultsCommand = program.commands.find((cmd) => cmd.name() === 'show-defaults')!
    })

    it('should be registered', () => {
      expect(showDefaultsCommand).toBeDefined()
      expect(showDefaultsCommand.description()).toBe(
        'Show driver DEFAULT_CONFIG and SUPPORTED_CONFIG'
      )
    })

    it('should have show-defaults-specific options', () => {
      const options = showDefaultsCommand.options.map((opt) => opt.long)
      expect(options).toContain('--driver')
      expect(options).toContain('--local')
      expect(options).toContain('--format')
    })

    it('should have correct option descriptions and flags', () => {
      const getOption = (long: string): (typeof showDefaultsCommand.options)[0] | undefined =>
        showDefaultsCommand.options.find((opt) => opt.long === long)

      expect(getOption('--driver')).toMatchObject({
        flags: '-d, --driver <package>',
        description: 'Driver package name',
      })

      expect(getOption('--local')).toMatchObject({
        flags: '--local',
        description: 'Load from local package (cwd)',
      })

      expect(getOption('--format')).toMatchObject({
        flags: '-f, --format <type>',
        description: 'Output format: table or json (default: table)',
      })
    })

    describe('Command-Line Integration', () => {
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

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Driver package not found')
        expect(processExitSpy).toHaveBeenCalledWith(1)
      })
    })
  })

  describe('Discover Command', () => {
    let discoverCommand: Command

    beforeEach(() => {
      discoverCommand = program.commands.find((cmd) => cmd.name() === 'discover')!
    })

    it('should be registered', () => {
      expect(discoverCommand).toBeDefined()
      expect(discoverCommand.description()).toBe(
        'Discover Modbus devices on serial port by scanning slave IDs and parameters'
      )
    })

    it('should have discover-specific options', () => {
      const options = discoverCommand.options.map((opt) => opt.long)
      expect(options).toContain('--port')
      expect(options).toContain('--driver')
      expect(options).toContain('--local')
      expect(options).toContain('--strategy')
      expect(options).toContain('--timeout')
      expect(options).toContain('--delay')
      expect(options).toContain('--max-devices')
      expect(options).toContain('--verbose')
      expect(options).toContain('--silent')
      expect(options).toContain('--format')
    })

    it('should have correct option descriptions and flags', () => {
      const getOption = (long: string): (typeof discoverCommand.options)[0] | undefined =>
        discoverCommand.options.find((opt) => opt.long === long)

      expect(getOption('--port')).toMatchObject({
        flags: '-p, --port <path>',
        description: 'Serial port for RTU (e.g., /dev/ttyUSB0, COM3)',
      })

      expect(getOption('--driver')).toMatchObject({
        flags: '-d, --driver <package>',
        description: 'Driver package (uses SUPPORTED_CONFIG to limit scan)',
      })

      expect(getOption('--local')).toMatchObject({
        flags: '--local',
        description: 'Load driver from local package (cwd)',
      })

      expect(getOption('--strategy')).toMatchObject({
        flags: '--strategy <type>',
        description: 'Discovery strategy: quick (driver params) or thorough (all params)',
      })

      expect(getOption('--timeout')).toMatchObject({
        flags: '--timeout <ms>',
        description: 'Response timeout in milliseconds (default: 1000)',
      })

      expect(getOption('--delay')).toMatchObject({
        flags: '--delay <ms>',
        description: 'Delay between attempts in milliseconds (default: 100)',
      })

      expect(getOption('--max-devices')).toMatchObject({
        flags: '--max-devices <count>',
        description: 'Maximum number of devices to find (default: 1, use 0 for unlimited)',
      })

      expect(getOption('--verbose')).toMatchObject({
        flags: '--verbose',
        description: 'Show detailed progress with current parameters being tested',
      })

      expect(getOption('--silent')).toMatchObject({
        flags: '--silent',
        description: 'Suppress all output except final result (useful for scripts)',
      })

      expect(getOption('--format')).toMatchObject({
        flags: '-f, --format <type>',
        description: 'Output format: table or json (default: table)',
      })
    })

    it('should require port', () => {
      const portOption = discoverCommand.options.find((opt) => opt.long === '--port')
      expect(portOption?.required).toBe(true)
    })

    describe('Command-Line Integration', () => {
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

        expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Cannot open port: Permission denied')
        expect(processExitSpy).toHaveBeenCalledWith(1)
      })
    })
  })
})
