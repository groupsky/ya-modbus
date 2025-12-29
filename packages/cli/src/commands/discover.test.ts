import type { DiscoveredDevice } from '../discovery/scanner.js'
import * as scanner from '../discovery/scanner.js'
import * as driverLoader from '../driver-loader/loader.js'

import { discoverCommand } from './discover.js'

jest.mock('../discovery/scanner.js')
jest.mock('../driver-loader/loader.js')

describe('Discover Command', () => {
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance
  let stdoutWriteSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock console methods to capture output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
    stdoutWriteSpy = jest.spyOn(process.stdout, 'write').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    stdoutWriteSpy.mockRestore()
  })

  const mockDevices: DiscoveredDevice[] = [
    {
      slaveId: 52,
      baudRate: 9600,
      parity: 'none',
      dataBits: 8,
      stopBits: 1,
      identification: {
        present: true,
        responseTimeMs: 45.67,
      },
    },
  ]

  describe('silent mode', () => {
    beforeEach(() => {
      jest.spyOn(scanner, 'scanForDevices').mockResolvedValue(mockDevices)
      jest.spyOn(driverLoader, 'loadDriver').mockResolvedValue({
        createDriver: jest.fn(),
        defaultConfig: undefined,
        supportedConfig: undefined,
      })
    })

    test('should suppress all progress messages in silent mode', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        silent: true,
        format: 'table',
      })

      // Should NOT log any progress messages
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Starting Modbus device discovery')
      )
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Strategy:'))
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Timeout:'))
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Testing'))
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Discovery complete'))

      // Should NOT write progress to stdout
      expect(stdoutWriteSpy).not.toHaveBeenCalled()

      // Should still output the final result table
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Slave ID'))
    })

    test('should suppress driver loading messages in silent mode', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        driver: 'ya-modbus-driver-test',
        silent: true,
        format: 'table',
      })

      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Using driver:'))
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('DEFAULT_CONFIG'))
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('SUPPORTED_CONFIG'))
    })

    test('should suppress device found messages in silent mode', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        silent: true,
        format: 'table',
      })

      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('✓ Found device:'))
    })

    test('should output JSON in silent mode', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        silent: true,
        format: 'json',
      })

      // Should NOT log progress messages
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Starting Modbus device discovery')
      )

      // Should output JSON result
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('"slaveId": 52'))
    })

    test('should suppress fallback message in silent mode when driver fails to load', async () => {
      jest.spyOn(driverLoader, 'loadDriver').mockRejectedValue(new Error('Driver not found'))

      await discoverCommand({
        port: '/dev/ttyUSB0',
        silent: true,
        format: 'table',
      })

      // Should NOT log fallback messages
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        'No driver available, using generic Modbus parameters...'
      )
    })

    test('should not show progress bar in silent mode', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        silent: true,
        format: 'table',
      })

      // Verify onProgress callback doesn't write to stdout
      const scanCall = (scanner.scanForDevices as jest.Mock).mock.calls[0]
      const scanOptions = scanCall[1]

      // Call the onProgress callback
      scanOptions.onProgress(10, 100, 1)

      // Should not have written to stdout
      expect(stdoutWriteSpy).not.toHaveBeenCalled()
    })

    test('should disable verbose mode when silent is enabled', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        verbose: true,
        silent: true,
        format: 'table',
      })

      // Verify onTestAttempt callback is not set
      const scanCall = (scanner.scanForDevices as jest.Mock).mock.calls[0]
      const scanOptions = scanCall[1]

      expect(scanOptions.onTestAttempt).toBeUndefined()
    })
  })

  describe('normal mode (not silent)', () => {
    beforeEach(() => {
      jest.spyOn(scanner, 'scanForDevices').mockResolvedValue(mockDevices)
      jest.spyOn(driverLoader, 'loadDriver').mockResolvedValue({
        createDriver: jest.fn(),
        defaultConfig: undefined,
        supportedConfig: undefined,
      })
    })

    test('should show all progress messages in normal mode', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        format: 'table',
      })

      // Should log progress messages
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting Modbus device discovery')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Strategy:'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Timeout:'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Testing'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Discovery complete'))
    })

    test('should show device found messages in normal mode', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        format: 'table',
      })

      // Verify onDeviceFound callback shows message
      const scanCall = (scanner.scanForDevices as jest.Mock).mock.calls[0]
      const scanOptions = scanCall[1]

      // Call the onDeviceFound callback
      scanOptions.onDeviceFound(mockDevices[0])

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Found device:'))
    })

    test('should show progress bar in normal mode', async () => {
      // Mock clearLine and cursorTo before running command
      const mockClearLine = jest.fn()
      const mockCursorTo = jest.fn()
      process.stdout.clearLine = mockClearLine
      process.stdout.cursorTo = mockCursorTo

      await discoverCommand({
        port: '/dev/ttyUSB0',
        format: 'table',
      })

      const scanCall = (scanner.scanForDevices as jest.Mock).mock.calls[0]
      const scanOptions = scanCall[1]

      // Call onProgress callback
      scanOptions.onProgress(10, 100, 1)

      // Should write progress to stdout
      expect(stdoutWriteSpy).toHaveBeenCalled()
      expect(mockClearLine).toHaveBeenCalledWith(0)
      expect(mockCursorTo).toHaveBeenCalledWith(0)
    })

    test('should not show progress bar in json format', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        format: 'json',
      })

      const scanCall = (scanner.scanForDevices as jest.Mock).mock.calls[0]
      const scanOptions = scanCall[1]

      // Call onProgress callback
      scanOptions.onProgress(10, 100, 1)

      // Should not write to stdout in JSON format
      expect(stdoutWriteSpy).not.toHaveBeenCalled()
    })
  })

  describe('maxDevices parameter', () => {
    beforeEach(() => {
      jest.spyOn(scanner, 'scanForDevices').mockResolvedValue(mockDevices)
    })

    test('should show "Find all devices" when maxDevices = 0', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        maxDevices: 0,
        format: 'table',
      })

      expect(consoleLogSpy).toHaveBeenCalledWith('Mode: Find all devices')
    })

    test('should show "Find up to N device(s)" when maxDevices > 0', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        maxDevices: 3,
        format: 'table',
      })

      expect(consoleLogSpy).toHaveBeenCalledWith('Mode: Find up to 3 device(s)')
    })
  })

  describe('driver loading', () => {
    test('should show local driver message when auto-detected', async () => {
      jest.spyOn(scanner, 'scanForDevices').mockResolvedValue(mockDevices)
      jest.spyOn(driverLoader, 'loadDriver').mockResolvedValue({
        createDriver: jest.fn(),
        defaultConfig: undefined,
        supportedConfig: undefined,
      })

      await discoverCommand({
        port: '/dev/ttyUSB0',
        format: 'table',
      })

      expect(consoleLogSpy).toHaveBeenCalledWith('Using local driver package')
    })

    test('should show driver name when using specific driver', async () => {
      jest.spyOn(scanner, 'scanForDevices').mockResolvedValue(mockDevices)
      jest.spyOn(driverLoader, 'loadDriver').mockResolvedValue({
        createDriver: jest.fn(),
        defaultConfig: undefined,
        supportedConfig: undefined,
      })

      await discoverCommand({
        port: '/dev/ttyUSB0',
        driver: 'ya-modbus-driver-test',
        format: 'table',
      })

      expect(consoleLogSpy).toHaveBeenCalledWith('Using driver: ya-modbus-driver-test')
    })

    test('should show DEFAULT_CONFIG message when driver provides it', async () => {
      jest.spyOn(scanner, 'scanForDevices').mockResolvedValue(mockDevices)
      jest.spyOn(driverLoader, 'loadDriver').mockResolvedValue({
        createDriver: jest.fn(),
        defaultConfig: {
          baudRate: 9600,
          parity: 'none',
          dataBits: 8,
          stopBits: 1,
          defaultAddress: 52,
        },
        supportedConfig: undefined,
      })

      await discoverCommand({
        port: '/dev/ttyUSB0',
        driver: 'ya-modbus-driver-test',
        format: 'table',
      })

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Using driver DEFAULT_CONFIG for parameter prioritization'
      )
    })

    test('should show SUPPORTED_CONFIG message when driver provides it', async () => {
      jest.spyOn(scanner, 'scanForDevices').mockResolvedValue(mockDevices)
      jest.spyOn(driverLoader, 'loadDriver').mockResolvedValue({
        createDriver: jest.fn(),
        defaultConfig: undefined,
        supportedConfig: {
          validBaudRates: [9600, 19200],
          validParity: ['none', 'even'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 247],
        },
      })

      await discoverCommand({
        port: '/dev/ttyUSB0',
        driver: 'ya-modbus-driver-test',
        format: 'table',
      })

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Using driver SUPPORTED_CONFIG to limit parameter combinations'
      )
    })

    test('should continue with generic parameters when driver fails to load', async () => {
      jest.spyOn(scanner, 'scanForDevices').mockResolvedValue(mockDevices)
      jest.spyOn(driverLoader, 'loadDriver').mockRejectedValue(new Error('Driver not found'))

      await discoverCommand({
        port: '/dev/ttyUSB0',
        format: 'table',
      })

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'No driver available, using generic Modbus parameters...'
      )
    })

    test('should show error details in verbose mode when driver fails to load', async () => {
      jest.spyOn(scanner, 'scanForDevices').mockResolvedValue(mockDevices)
      jest
        .spyOn(driverLoader, 'loadDriver')
        .mockRejectedValue(new Error('package.json not found in current directory'))

      await discoverCommand({
        port: '/dev/ttyUSB0',
        format: 'table',
        verbose: true,
      })

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'No driver available, using generic Modbus parameters...'
      )
      expect(consoleLogSpy).toHaveBeenCalledWith('  (package.json not found in current directory)')
    })

    test('should fallback gracefully when explicit --driver fails to load', async () => {
      jest.spyOn(scanner, 'scanForDevices').mockResolvedValue(mockDevices)
      jest
        .spyOn(driverLoader, 'loadDriver')
        .mockRejectedValue(new Error('Driver package not found: nonexistent-driver'))

      // Even with explicit --driver, discover gracefully falls back
      // (unlike list-devices/show-defaults which require a driver)
      await discoverCommand({
        port: '/dev/ttyUSB0',
        driver: 'nonexistent-driver',
        format: 'table',
        verbose: true,
      })

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'No driver available, using generic Modbus parameters...'
      )
      expect(consoleLogSpy).toHaveBeenCalledWith('  (Driver package not found: nonexistent-driver)')
      // Verify scan still executed with generic parameters
      expect(scanner.scanForDevices).toHaveBeenCalled()
    })
  })

  describe('verbose mode', () => {
    beforeEach(() => {
      jest.spyOn(scanner, 'scanForDevices').mockResolvedValue(mockDevices)
    })

    test('should show verbose message when enabled', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        verbose: true,
        format: 'table',
      })

      expect(consoleLogSpy).toHaveBeenCalledWith('Verbose: Enabled')
    })

    test('should call onTestAttempt callback in verbose mode', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        verbose: true,
        format: 'table',
      })

      const scanCall = (scanner.scanForDevices as jest.Mock).mock.calls[0]
      const scanOptions = scanCall[1]

      expect(scanOptions.onTestAttempt).toBeDefined()
    })

    test('should write testing status to stdout in verbose mode', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        verbose: true,
        format: 'table',
      })

      const scanCall = (scanner.scanForDevices as jest.Mock).mock.calls[0]
      const scanOptions = scanCall[1]

      // Simulate testing callback
      scanOptions.onTestAttempt(
        {
          slaveId: 52,
          baudRate: 9600,
          parity: 'none',
          dataBits: 8,
          stopBits: 1,
        },
        'testing'
      )

      expect(stdoutWriteSpy).toHaveBeenCalledWith(expect.stringContaining('· Testing: 52@9600'))
    })

    test('should write found status to stdout in verbose mode', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        verbose: true,
        format: 'table',
      })

      const scanCall = (scanner.scanForDevices as jest.Mock).mock.calls[0]
      const scanOptions = scanCall[1]

      // Simulate found callback
      scanOptions.onTestAttempt(
        {
          slaveId: 52,
          baudRate: 9600,
          parity: 'none',
          dataBits: 8,
          stopBits: 1,
        },
        'found'
      )

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Found:   52@9600'))
    })

    test('should not show verbose output in JSON format', async () => {
      await discoverCommand({
        port: '/dev/ttyUSB0',
        verbose: true,
        format: 'json',
      })

      const scanCall = (scanner.scanForDevices as jest.Mock).mock.calls[0]
      const scanOptions = scanCall[1]

      // Simulate testing callback
      scanOptions.onTestAttempt(
        {
          slaveId: 52,
          baudRate: 9600,
          parity: 'none',
          dataBits: 8,
          stopBits: 1,
        },
        'testing'
      )

      // Should not write to stdout in JSON format
      expect(stdoutWriteSpy).not.toHaveBeenCalled()
    })
  })
})
