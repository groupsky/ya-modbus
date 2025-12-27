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

    test('should suppress error messages in silent mode when driver fails to load', async () => {
      jest.spyOn(driverLoader, 'loadDriver').mockRejectedValue(new Error('Driver not found'))

      await discoverCommand({
        port: '/dev/ttyUSB0',
        driver: 'nonexistent-driver',
        silent: true,
        format: 'table',
      })

      // Should NOT log error messages
      expect(consoleErrorSpy).not.toHaveBeenCalled()
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
  })
})
