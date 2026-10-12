import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createTransport } from '@ya-modbus/transport'

import packageJson from '../package.json'

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
      expect(program.name()).toBe('ya-modbus-profile')
    })

    it('should have correct description', () => {
      expect(program.description()).toBe('Profile Modbus devices by scanning register ranges')
    })

    it('should have the version from package.json', () => {
      expect(program.version()).toBe(packageJson.version)
    })

    it('should display help information with --help', async () => {
      const helpOutput = await captureHelpOutput(['node', 'ya-modbus-profile', '--help'])
      expect(helpOutput).toMatchInlineSnapshot(`
        "Usage: ya-modbus-profile [options]

        Profile Modbus devices by scanning register ranges

        Options:
          -V, --version          output the version number
          --port <port>          Serial port (e.g., /dev/ttyUSB0) or TCP host:port
          --slave-id <id>        Modbus slave ID (1-247)
          --type <type>          Register type: holding or input (default: "holding")
          --start <address>      Start register address (default: 0)
          --end <address>        End register address (default: 100)
          --batch <size>         Batch size for reads (default: 10)
          --baud <rate>          Baud rate for RTU (default: 9600)
          --parity <parity>      Parity for RTU (choices: "none", "even", "odd",
                                 default: "none")
          --data-bits <bits>     Data bits for RTU (default: 8)
          --stop-bits <bits>     Stop bits for RTU (default: 1)
          --timeout <ms>         Response timeout in milliseconds (default: 1000)
          -f, --format <format>  Output format: table, json or yaml (default: table, or
                                 taken from the --output file extension) (choices:
                                 "table", "json", "yaml")
          --output <file>        Write the result to a json or yaml file instead of
                                 printing it
          -h, --help             display help for command
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

    it.each(['table', 'json', 'yaml'])('should parse format option as %s', async (format) => {
      const mockRunProfileScan = jest.fn().mockResolvedValue(undefined)
      ;(cliModule.runProfileScan as jest.Mock) = mockRunProfileScan

      await program.parseAsync([
        'node',
        'ya-modbus-profile',
        '--port',
        '/dev/ttyUSB0',
        '--slave-id',
        '1',
        '--format',
        format,
      ])

      expect(mockRunProfileScan).toHaveBeenCalledWith(expect.objectContaining({ format }))
    })

    it('should default format to table when not specified', async () => {
      const mockRunProfileScan = jest.fn().mockResolvedValue(undefined)
      ;(cliModule.runProfileScan as jest.Mock) = mockRunProfileScan

      await program.parseAsync([
        'node',
        'ya-modbus-profile',
        '--port',
        '/dev/ttyUSB0',
        '--slave-id',
        '1',
      ])

      expect(mockRunProfileScan).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'table',
        })
      )
    })

    it('should validate format choices', async () => {
      await expect(
        program.parseAsync([
          'node',
          'ya-modbus-profile',
          '--port',
          '/dev/ttyUSB0',
          '--slave-id',
          '1',
          '--format',
          'invalid',
        ])
      ).rejects.toThrow()

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('Output File', () => {
    const connectionArgs = [
      'node',
      'ya-modbus-profile',
      '--port',
      '/dev/ttyUSB0',
      '--slave-id',
      '1',
    ]
    const file = (name: string): string => join(tmpdir(), name)

    it.each([
      { args: ['--output', file('scan.json')], format: 'json', name: 'scan.json' },
      { args: ['--output', file('scan.yaml')], format: 'yaml', name: 'scan.yaml' },
      { args: ['--output', file('scan.yml')], format: 'yaml', name: 'scan.yml' },
      {
        args: ['--format', 'yaml', '--output', file('scan.json')],
        format: 'yaml',
        name: 'scan.json',
      },
      { args: ['-f', 'json', '--output', file('scan.txt')], format: 'json', name: 'scan.txt' },
    ])('should write $format to $name for $args', async ({ args, format, name }) => {
      const mockRunProfileScan = jest.fn().mockResolvedValue(undefined)
      ;(cliModule.runProfileScan as jest.Mock) = mockRunProfileScan

      await program.parseAsync([...connectionArgs, ...args])

      expect(mockRunProfileScan).toHaveBeenCalledWith(
        expect.objectContaining({ format, outputFile: file(name) })
      )
    })

    it('should not pass an output file when --output is not given', async () => {
      const mockRunProfileScan = jest.fn().mockResolvedValue(undefined)
      ;(cliModule.runProfileScan as jest.Mock) = mockRunProfileScan

      await program.parseAsync([...connectionArgs, '--format', 'yaml'])

      expect(mockRunProfileScan).toHaveBeenCalledTimes(1)
      expect(mockRunProfileScan.mock.calls[0][0]).not.toHaveProperty('outputFile')
    })

    it('should report the error and exit with code 1 when the result cannot be written', async () => {
      const message = `Cannot write to ${file('scan.json')}: ENOSPC. The report is printed to stdout instead.`
      ;(cliModule.runProfileScan as jest.Mock) = jest.fn().mockRejectedValue(new Error(message))

      await expect(
        program.parseAsync([...connectionArgs, '--output', file('scan.json')])
      ).rejects.toThrow('process.exit called')

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', message)
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it.each([
      {
        name: 'a file name that does not tell the format',
        args: ['--output', file('scan.txt')],
        message: `Cannot tell the output format from "${file('scan.txt')}". Use a .json, .yaml or .yml file name, or set --format json or --format yaml`,
      },
      {
        name: 'the table format',
        args: ['--format', 'table', '--output', file('scan.json')],
        message: 'The table format cannot be written to a file. Use --format json or --format yaml',
      },
      {
        name: 'a directory that does not exist',
        args: ['--output', join(tmpdir(), randomUUID(), 'scan.json')],
        message: expect.stringContaining('ENOENT'),
      },
      {
        name: 'a path that is a directory',
        args: ['--format', 'json', '--output', tmpdir()],
        message: expect.stringContaining('EISDIR'),
      },
    ])('should reject $name before connecting', async ({ args, message }) => {
      await expect(program.parseAsync([...connectionArgs, ...args])).rejects.toThrow()

      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', message)
      expect(createTransport).not.toHaveBeenCalled()
      expect(cliModule.runProfileScan).not.toHaveBeenCalled()
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

  describe('Parameter Validation', () => {
    const connectionArgs = ['node', 'ya-modbus-profile', '--port', '/dev/ttyUSB0']

    it.each([
      {
        name: 'slave ID 0',
        args: ['--slave-id', '0'],
        message: 'Invalid slave ID: 0. Must be between 1 and 247 (Modbus specification)',
      },
      {
        name: 'slave ID 248',
        args: ['--slave-id', '248'],
        message: 'Invalid slave ID: 248. Must be between 1 and 247 (Modbus specification)',
      },
      {
        name: 'start address greater than end address',
        args: ['--slave-id', '1', '--start', '100', '--end', '50'],
        message: 'Invalid address range: start (100) is greater than end (50)',
      },
      {
        name: 'end address above 65535',
        args: ['--slave-id', '1', '--end', '65536'],
        message: 'Invalid end address: 65536. Must be between 0 and 65535',
      },
      {
        // Regression: a batch size of 0 made the scan loop run forever
        name: 'batch size 0',
        args: ['--slave-id', '1', '--batch', '0'],
        message: 'Invalid batch size: 0. Must be between 1 and 125 (Modbus limit for one read)',
      },
      {
        name: 'negative batch size',
        args: ['--slave-id', '1', '--batch', '-1'],
        message: 'Invalid batch size: -1. Must be between 1 and 125 (Modbus limit for one read)',
      },
      {
        name: 'batch size above the Modbus limit',
        args: ['--slave-id', '1', '--batch', '200'],
        message: 'Invalid batch size: 200. Must be between 1 and 125 (Modbus limit for one read)',
      },
      {
        name: 'timeout 0',
        args: ['--slave-id', '1', '--timeout', '0'],
        message: 'Invalid timeout: 0. Must be between 1 and 2147483647 milliseconds',
      },
      {
        name: 'timeout above the setTimeout limit',
        args: ['--slave-id', '1', '--timeout', '2147483648'],
        message: 'Invalid timeout: 2147483648. Must be between 1 and 2147483647 milliseconds',
      },
      {
        name: 'baud rate 0',
        args: ['--slave-id', '1', '--baud', '0'],
        message: 'Invalid baud rate: 0. Must be greater than 0',
      },
    ])('should reject $name before connecting', async ({ args, message }) => {
      await expect(program.parseAsync([...connectionArgs, ...args])).rejects.toThrow()

      expect(processExitSpy).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', message)
      expect(createTransport).not.toHaveBeenCalled()
      expect(cliModule.runProfileScan).not.toHaveBeenCalled()
    })

    it.each([
      { option: '--slave-id', value: 'abc' },
      { option: '--slave-id', value: '1.5' },
      { option: '--batch', value: '10abc' },
      { option: '--start', value: '' },
    ])('should reject non-integer $option value "$value"', async ({ option, value }) => {
      const stderrWriteSpy = jest.spyOn(process.stderr, 'write').mockImplementation()

      try {
        const args = [...connectionArgs, '--slave-id', '1', option, value]
        await expect(program.parseAsync(args)).rejects.toThrow()

        expect(processExitSpy).toHaveBeenCalledWith(1)
        const stderrOutput = stderrWriteSpy.mock.calls.map((call) => call[0]).join('')
        expect(stderrOutput).toContain(`option '${option}`)
        expect(stderrOutput).toContain('Expected a whole number')
        expect(cliModule.runProfileScan).not.toHaveBeenCalled()
      } finally {
        stderrWriteSpy.mockRestore()
      }
    })

    it('should accept values at the limits of the allowed ranges', async () => {
      const mockRunProfileScan = jest.fn().mockResolvedValue(undefined)
      ;(cliModule.runProfileScan as jest.Mock) = mockRunProfileScan

      await program.parseAsync([
        ...connectionArgs,
        '--slave-id',
        '247',
        '--start',
        '0',
        '--end',
        '65535',
        '--batch',
        '125',
        '--timeout',
        '1',
      ])

      expect(processExitSpy).not.toHaveBeenCalled()
      expect(mockRunProfileScan).toHaveBeenCalledWith(
        expect.objectContaining({ startAddress: 0, endAddress: 65535, batchSize: 125 })
      )
    })
  })
})
