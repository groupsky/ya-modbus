import * as cliModule from './cli.js'
import { program } from './program.js'

jest.mock('./cli.js')
jest.mock('@ya-modbus/transport')
jest.mock('chalk')
jest.mock('cli-table3')

/**
 * Integration tests for CLI program
 *
 * Testing Strategy:
 * - Uses program.parseAsync() to simulate real command-line usage
 * - Mocks cli module to verify runProfileScan is called with correct parameters
 * - Uses inline snapshots for help output verification
 *
 * Process.exit Mocking:
 * The process.exit mock throws an error to prevent actual process termination during tests.
 * This allows us to verify exit was called and continue test execution.
 *
 * NOTE: Help output snapshots will break on Commander.js version updates.
 * Use `npm test -- -u` to update snapshots after verifying changes are intentional.
 */
describe('CLI Program - Integration Tests', () => {
  let consoleErrorSpy: jest.SpyInstance
  let processExitSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    // Mock process.exit to throw error instead of terminating process
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  /**
   * Helper to capture and verify help output
   * @param args - Command-line arguments to pass to program.parseAsync()
   * @returns The captured help output text
   */
  async function captureHelpOutput(args: string[]): Promise<string> {
    const stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation()
    // Set consistent terminal width to ensure consistent help text wrapping
    const originalColumns = process.stdout.columns
    Object.defineProperty(process.stdout, 'columns', { value: 80, writable: true })

    try {
      // Help output triggers process.exit(0), which our mock throws
      await expect(program.parseAsync(args)).rejects.toThrow('process.exit called')

      // Verify exit was called with success code (0) for help
      expect(processExitSpy).toHaveBeenCalledWith(0)

      // Capture and return help output
      return stdoutWriteSpy.mock.calls.map((call) => call[0]).join('')
    } finally {
      stdoutWriteSpy.mockRestore()
      Object.defineProperty(process.stdout, 'columns', { value: originalColumns, writable: true })
    }
  }

  describe('Program Configuration', () => {
    it('should have correct name', () => {
      expect(program.name()).toBe('ya-modbus-profile')
    })

    it('should have correct description', () => {
      expect(program.description()).toBe('Profile Modbus devices by scanning register ranges')
    })

    it('should have correct version', () => {
      expect(program.version()).toBe('0.1.0')
    })

    it('should display help information with --help', async () => {
      const helpOutput = await captureHelpOutput(['node', 'ya-modbus-profile', '--help'])
      expect(helpOutput).toMatchInlineSnapshot(`
        "Usage: ya-modbus-profile [options]

        Profile Modbus devices by scanning register ranges

        Options:
          -V, --version       output the version number
          --port <port>       Serial port (e.g., /dev/ttyUSB0) or TCP host:port
          --slave-id <id>     Modbus slave ID (1-247)
          --type <type>       Register type: holding or input (default: "holding")
          --start <address>   Start register address (default: 0)
          --end <address>     End register address (default: 100)
          --batch <size>      Batch size for reads (default: 10)
          --baud <rate>       Baud rate for RTU (default: 9600)
          --parity <parity>   Parity for RTU (choices: "none", "even", "odd", default:
                              "none")
          --data-bits <bits>  Data bits for RTU (default: 8)
          --stop-bits <bits>  Stop bits for RTU (default: 1)
          --timeout <ms>      Response timeout in milliseconds (default: 1000)
          -h, --help          display help for command
        "
      `)
    })
  })

  describe('Required Options Validation', () => {
    it('should require --port option', async () => {
      await expect(
        program.parseAsync(['node', 'ya-modbus-profile', '--slave-id', '1'])
      ).rejects.toThrow()

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it('should require --slave-id option', async () => {
      await expect(
        program.parseAsync(['node', 'ya-modbus-profile', '--port', '/dev/ttyUSB0'])
      ).rejects.toThrow()

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('Option Parsing', () => {
    it('should parse RTU options correctly', async () => {
      const mockRunProfileScan = jest.fn().mockResolvedValue(undefined)
      ;(cliModule.runProfileScan as jest.Mock) = mockRunProfileScan

      await program.parseAsync([
        'node',
        'ya-modbus-profile',
        '--port',
        '/dev/ttyUSB0',
        '--slave-id',
        '52',
        '--baud',
        '9600',
        '--parity',
        'none',
      ])

      expect(mockRunProfileScan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'holding',
          startAddress: 0,
          endAddress: 100,
          batchSize: 10,
        })
      )
    })

    it('should parse register type option', async () => {
      const mockRunProfileScan = jest.fn().mockResolvedValue(undefined)
      ;(cliModule.runProfileScan as jest.Mock) = mockRunProfileScan

      await program.parseAsync([
        'node',
        'ya-modbus-profile',
        '--port',
        '/dev/ttyUSB0',
        '--slave-id',
        '1',
        '--type',
        'input',
      ])

      expect(mockRunProfileScan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'input',
        })
      )
    })

    it('should parse address range options', async () => {
      const mockRunProfileScan = jest.fn().mockResolvedValue(undefined)
      ;(cliModule.runProfileScan as jest.Mock) = mockRunProfileScan

      await program.parseAsync([
        'node',
        'ya-modbus-profile',
        '--port',
        '/dev/ttyUSB0',
        '--slave-id',
        '1',
        '--start',
        '100',
        '--end',
        '200',
      ])

      expect(mockRunProfileScan).toHaveBeenCalledWith(
        expect.objectContaining({
          startAddress: 100,
          endAddress: 200,
        })
      )
    })

    it('should validate parity choices', async () => {
      await expect(
        program.parseAsync([
          'node',
          'ya-modbus-profile',
          '--port',
          '/dev/ttyUSB0',
          '--slave-id',
          '1',
          '--parity',
          'invalid',
        ])
      ).rejects.toThrow()

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('TCP Connection Validation', () => {
    it('should validate TCP port number', async () => {
      await expect(
        program.parseAsync([
          'node',
          'ya-modbus-profile',
          '--port',
          'localhost:invalid',
          '--slave-id',
          '1',
        ])
      ).rejects.toThrow()

      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error:',
        expect.stringContaining('Invalid port number')
      )
    })

    it('should validate TCP port range', async () => {
      await expect(
        program.parseAsync([
          'node',
          'ya-modbus-profile',
          '--port',
          'localhost:99999',
          '--slave-id',
          '1',
        ])
      ).rejects.toThrow()

      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error:',
        expect.stringContaining('Must be between')
      )
    })
  })
})
