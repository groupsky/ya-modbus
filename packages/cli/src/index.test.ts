import * as discoverModule from './commands/discover.js'
import * as readModule from './commands/read.js'
import * as showDefaultsModule from './commands/show-defaults.js'
import * as writeModule from './commands/write.js'

import { program } from './index.js'

jest.mock('./commands/read.js')
jest.mock('./commands/write.js')
jest.mock('./commands/show-defaults.js')
jest.mock('./commands/discover.js')

/**
 * Integration tests for CLI entry point
 *
 * Testing Strategy:
 * - Uses program.parseAsync() to simulate real command-line usage
 * - Mocks command modules to verify they're called with correct parameters
 * - Uses inline snapshots for help output verification
 *
 * Process.exit Mocking:
 * The process.exit mock throws an error to prevent actual process termination during tests.
 * This approach works because Commander.js doesn't catch errors thrown from the exit handler,
 * allowing us to:
 * 1. Verify exit was called (for validation errors, help display, etc.)
 * 2. Verify the exit code (0 for success, 1 for errors)
 * 3. Continue test execution after expected exits
 *
 * NOTE: Help output snapshots will break on Commander.js version updates or option text changes.
 * Use `npm test -- -u` to update snapshots after verifying changes are intentional.
 */
describe('CLI Entry Point - Integration Tests', () => {
  let consoleErrorSpy: jest.SpyInstance
  let processExitSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    // Mock process.exit to throw error instead of terminating process
    // This allows tests to verify exit behavior without stopping test execution
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  /**
   * Helper to capture and verify help output for commands
   * @param args - Command-line arguments to pass to program.parseAsync()
   * @returns The captured help output text
   */
  async function captureHelpOutput(args: string[]): Promise<string> {
    const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation()

    try {
      // Help output triggers process.exit(0), which our mock throws
      await expect(program.parseAsync(args)).rejects.toThrow('process.exit called')

      // Verify exit was called with success code (0) for help
      expect(processExitSpy).toHaveBeenCalledWith(0)

      // Capture and return help output
      return stdoutWriteSpy.mock.calls.map((call) => call[0]).join('')
    } finally {
      stdoutWriteSpy.mockRestore()
    }
  }

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

    it('should display help information with --help', async () => {
      const helpOutput = await captureHelpOutput(['node', 'ya-modbus', '--help'])
      expect(helpOutput).toMatchInlineSnapshot(`
        "Usage: ya-modbus [options] [command]

        CLI tool for testing and developing Modbus device drivers

        Options:
          -V, --version            output the version number
          -h, --help               display help for command

        Device Operations:
          read [options]           Read data points from device
          write [options]          Write data point to device

        Device Discovery:
          discover [options]       Discover Modbus devices on serial port by scanning
                                   slave IDs and parameters

        Driver Utilities:
          list-devices [options]   List supported devices from driver DEVICES registry
          show-defaults [options]  Show driver DEFAULT_CONFIG and SUPPORTED_CONFIG

        Commands:
          help [command]           display help for command

        Examples:
          $ ya-modbus read --port /dev/ttyUSB0 --slave-id 1 --driver ya-modbus-driver-xymd1 --all
          $ ya-modbus write --host 192.168.1.100 --slave-id 1 --data-point voltage --value 220
          $ ya-modbus discover --port /dev/ttyUSB0 --strategy quick
          $ ya-modbus show-defaults --driver ya-modbus-driver-xymd1
            
        "
      `)
    })
  })

  describe('Read Command', () => {
    it('should display help information for read command', async () => {
      const helpOutput = await captureHelpOutput(['node', 'ya-modbus', 'read', '--help'])
      expect(helpOutput).toMatchInlineSnapshot(`
        "Usage: ya-modbus read [options]

        Read data points from device

        Driver Options:
          -d, --driver <package>  Driver package name (e.g., ya-modbus-driver-xymd1).
                                  Use "show-defaults" to see driver config
          --device <key>          Device key for multi-device drivers. Use
                                  "list-devices" to see available devices

        Connection Options:
          -s, --slave-id <id>     Modbus slave ID (1-247). May use driver default if
                                  available
          --timeout <ms>          Response timeout in milliseconds (default: 1000)

        RTU Connection (choose this OR TCP):
          -p, --port <path>       Serial port for RTU (e.g., /dev/ttyUSB0, COM3)
          -b, --baud-rate <rate>  Baud rate (RTU only). Uses driver default if not
                                  specified
          --parity <type>         Parity: none, even, odd (RTU only). Uses driver
                                  default if not specified
          --data-bits <bits>      Data bits: 7 or 8 (RTU only). Uses driver default if
                                  not specified
          --stop-bits <bits>      Stop bits: 1 or 2 (RTU only). Uses driver default if
                                  not specified

        TCP Connection (choose this OR RTU):
          -h, --host <host>       TCP host for Modbus TCP (e.g., 192.168.1.100)
          --tcp-port <port>       TCP port (default: 502)

        Data Selection:
          --data-point <id...>    Data point ID(s) to read
          --all                   Read all readable data points

        Output Options:
          -f, --format <type>     Output format: table or json (default: table)
                                  (default: "table")

        Options:
          --help                  display help for command
        "
      `)
    })

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
    it('should display help information for write command', async () => {
      const helpOutput = await captureHelpOutput(['node', 'ya-modbus', 'write', '--help'])
      expect(helpOutput).toMatchInlineSnapshot(`
        "Usage: ya-modbus write [options]

        Write data point to device

        Driver Options:
          -d, --driver <package>  Driver package name (e.g., ya-modbus-driver-xymd1).
                                  Use "show-defaults" to see driver config
          --device <key>          Device key for multi-device drivers. Use
                                  "list-devices" to see available devices

        Connection Options:
          -s, --slave-id <id>     Modbus slave ID (1-247). May use driver default if
                                  available
          --timeout <ms>          Response timeout in milliseconds (default: 1000)

        RTU Connection (choose this OR TCP):
          -p, --port <path>       Serial port for RTU (e.g., /dev/ttyUSB0, COM3)
          -b, --baud-rate <rate>  Baud rate (RTU only). Uses driver default if not
                                  specified
          --parity <type>         Parity: none, even, odd (RTU only). Uses driver
                                  default if not specified
          --data-bits <bits>      Data bits: 7 or 8 (RTU only). Uses driver default if
                                  not specified
          --stop-bits <bits>      Stop bits: 1 or 2 (RTU only). Uses driver default if
                                  not specified

        TCP Connection (choose this OR RTU):
          -h, --host <host>       TCP host for Modbus TCP (e.g., 192.168.1.100)
          --tcp-port <port>       TCP port (default: 502)

        Data Options:
          --data-point <id>       Data point ID to write
          --value <value>         Value to write

        Write Options:
          -y, --yes               Skip confirmation prompt
          --verify                Read back and verify written value

        Options:
          --help                  display help for command
        "
      `)
    })

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
    it('should display help information for show-defaults command', async () => {
      const helpOutput = await captureHelpOutput(['node', 'ya-modbus', 'show-defaults', '--help'])
      expect(helpOutput).toMatchInlineSnapshot(`
        "Usage: ya-modbus show-defaults [options]

        Show driver DEFAULT_CONFIG and SUPPORTED_CONFIG

        Driver Options:
          -d, --driver <package>  Driver package (auto-detects from cwd if not
                                  specified)

        Output Options:
          -f, --format <type>     Output format: table or json (default: table)
                                  (default: "table")

        Options:
          -h, --help              display help for command
        "
      `)
    })

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

    it('should execute show-defaults with auto-detection (no driver specified)', async () => {
      const mockShowDefaultsCommand = jest.mocked(showDefaultsModule.showDefaultsCommand)
      mockShowDefaultsCommand.mockResolvedValue()

      await program.parseAsync(['node', 'ya-modbus', 'show-defaults', '--format', 'table'])

      expect(mockShowDefaultsCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'table',
        })
      )
      // Verify driver is not set (triggers auto-detection)
      expect(mockShowDefaultsCommand).toHaveBeenCalledWith(
        expect.not.objectContaining({
          driver: expect.anything(),
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
    it('should display help information for discover command', async () => {
      const helpOutput = await captureHelpOutput(['node', 'ya-modbus', 'discover', '--help'])
      expect(helpOutput).toMatchInlineSnapshot(`
        "Usage: ya-modbus discover [options]

        Discover Modbus devices on serial port by scanning slave IDs and parameters

        Connection:
          -p, --port <path>       Serial port for RTU (e.g., /dev/ttyUSB0, COM3)

        Driver Options:
          -d, --driver <package>  Driver package (auto-detects from cwd if not
                                  specified)

        Discovery Options:
          --strategy <type>       Discovery strategy: quick (driver params) or thorough
                                  (all params) (default: "quick")
          --timeout <ms>          Response timeout in milliseconds (default: 1000)
          --delay <ms>            Delay between attempts in milliseconds (default: 100)
          --max-devices <count>   Maximum number of devices to find (default: 1, use 0
                                  for unlimited)

        Output Options:
          --verbose               Show detailed progress with current parameters being
                                  tested
          --silent                Suppress all output except final result (useful for
                                  scripts)
          -f, --format <type>     Output format: table or json (default: table)
                                  (default: "table")

        Options:
          -h, --help              display help for command
        "
      `)
    })

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
