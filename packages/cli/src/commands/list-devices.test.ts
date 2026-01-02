import { loadDriver } from '@ya-modbus/driver-loader'

import { listDevicesCommand } from './list-devices.js'

jest.mock('@ya-modbus/driver-loader')

const mockLoadDriver = loadDriver as jest.MockedFunction<typeof loadDriver>

describe('listDevicesCommand', () => {
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  describe('auto-detection', () => {
    test('should auto-detect from cwd when no driver specified', async () => {
      mockLoadDriver.mockResolvedValue({
        createDriver: jest.fn(),
        devices: { 'device-1': { manufacturer: 'Acme', model: 'X1' } },
      })

      await listDevicesCommand({ format: 'json' })

      expect(mockLoadDriver).toHaveBeenCalledWith({})
    })

    test('should throw descriptive error when auto-detection fails', async () => {
      mockLoadDriver.mockRejectedValue(
        new Error(
          'package.json not found in current directory. ' +
            'Run this command from a driver package directory or specify --driver'
        )
      )

      await expect(listDevicesCommand({})).rejects.toThrow('package.json not found')
    })
  })

  describe('JSON output', () => {
    test('should output JSON with devices registry', async () => {
      mockLoadDriver.mockResolvedValue({
        createDriver: jest.fn(),
        devices: {
          'device-1': { manufacturer: 'Acme', model: 'X1', description: 'First device' },
          'device-2': { manufacturer: 'Acme', model: 'X2' },
        },
        defaultConfig: {
          baudRate: 9600,
          parity: 'even',
          dataBits: 8,
          stopBits: 1,
          defaultAddress: 1,
        },
      })

      await listDevicesCommand({ driver: 'test-driver', format: 'json' })

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.devices).toEqual({
        'device-1': { manufacturer: 'Acme', model: 'X1', description: 'First device' },
        'device-2': { manufacturer: 'Acme', model: 'X2' },
      })
      expect(output.defaultConfig).toBeDefined()
    })

    test('should output null devices for single-device driver', async () => {
      mockLoadDriver.mockResolvedValue({
        createDriver: jest.fn(),
        defaultConfig: {
          baudRate: 9600,
          parity: 'even',
          dataBits: 8,
          stopBits: 1,
          defaultAddress: 1,
        },
      })

      await listDevicesCommand({ driver: 'test-driver', format: 'json' })

      expect(consoleLogSpy).toHaveBeenCalledTimes(1)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.devices).toBeNull()
    })
  })

  describe('table output', () => {
    test('should display devices in table format', async () => {
      mockLoadDriver.mockResolvedValue({
        createDriver: jest.fn(),
        devices: {
          'device-1': { manufacturer: 'Acme', model: 'X1', description: 'First device' },
          'device-2': { manufacturer: 'Other', model: 'Y1' },
        },
        defaultConfig: {
          baudRate: 9600,
          parity: 'even',
          dataBits: 8,
          stopBits: 1,
          defaultAddress: 1,
        },
      })

      await listDevicesCommand({ driver: 'test-driver', format: 'table' })

      expect(consoleLogSpy).toHaveBeenCalled()
      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('Supported Devices')
      expect(output).toContain('device-1')
      expect(output).toContain('Acme')
      expect(output).toContain('X1')
      expect(output).toContain('First device')
      expect(output).toContain('device-2')
      expect(output).toContain('Other')
      expect(output).toContain('Total: 2 device(s)')
    })

    test('should indicate single-device driver', async () => {
      mockLoadDriver.mockResolvedValue({
        createDriver: jest.fn(),
        defaultConfig: {
          baudRate: 9600,
          parity: 'even',
          dataBits: 8,
          stopBits: 1,
          defaultAddress: 1,
        },
      })

      await listDevicesCommand({ driver: 'test-driver', format: 'table' })

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('single-device driver')
    })

    test('should show device-specific config when available', async () => {
      mockLoadDriver.mockResolvedValue({
        createDriver: jest.fn(),
        devices: {
          'device-1': {
            manufacturer: 'Acme',
            model: 'X1',
            defaultConfig: {
              baudRate: 19200,
              parity: 'none',
              dataBits: 8,
              stopBits: 1,
              defaultAddress: 1,
            },
          },
        },
        defaultConfig: {
          baudRate: 9600,
          parity: 'even',
          dataBits: 8,
          stopBits: 1,
          defaultAddress: 1,
        },
      })

      await listDevicesCommand({ driver: 'test-driver', format: 'table' })

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('19200 8N1') // Device-specific config
    })

    test('should fallback to driver default config when device has none', async () => {
      mockLoadDriver.mockResolvedValue({
        createDriver: jest.fn(),
        devices: {
          'device-1': { manufacturer: 'Acme', model: 'X1' },
        },
        defaultConfig: {
          baudRate: 9600,
          parity: 'even',
          dataBits: 8,
          stopBits: 1,
          defaultAddress: 1,
        },
      })

      await listDevicesCommand({ driver: 'test-driver', format: 'table' })

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('9600 8E1') // Driver default config
    })

    test('should format TCP config in table output', async () => {
      mockLoadDriver.mockResolvedValue({
        createDriver: jest.fn(),
        devices: {
          'device-1': {
            manufacturer: 'Acme',
            model: 'X1',
            defaultConfig: {
              defaultPort: 502,
              defaultAddress: 1,
            },
          },
        },
        defaultConfig: {
          defaultPort: 502,
          defaultAddress: 1,
        },
      })

      await listDevicesCommand({ driver: 'test-driver', format: 'table' })

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('TCP:502')
    })

    test('should show odd parity correctly', async () => {
      mockLoadDriver.mockResolvedValue({
        createDriver: jest.fn(),
        devices: {
          'device-1': {
            manufacturer: 'Acme',
            model: 'X1',
            defaultConfig: {
              baudRate: 19200,
              parity: 'odd',
              dataBits: 8,
              stopBits: 2,
              defaultAddress: 1,
            },
          },
        },
        defaultConfig: {
          baudRate: 9600,
          parity: 'even',
          dataBits: 8,
          stopBits: 1,
          defaultAddress: 1,
        },
      })

      await listDevicesCommand({ driver: 'test-driver', format: 'table' })

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      expect(output).toContain('19200 8O2') // Odd parity
    })

    test('should show dash for config with no recognized properties', async () => {
      mockLoadDriver.mockResolvedValue({
        createDriver: jest.fn(),
        devices: {
          'device-1': {
            manufacturer: 'Acme',
            model: 'X1',
            // Config object exists but has neither baudRate nor defaultPort
            defaultConfig: {
              defaultAddress: 1,
            } as never, // Type bypass for testing edge case
          },
        },
      })

      await listDevicesCommand({ driver: 'test-driver', format: 'table' })

      const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
      // Table row should contain a dash for the config column
      expect(output).toContain('device-1')
      expect(output).toContain('Acme')
      // The row format is: device-1 | Acme | X1 | - | (empty description)
      // Verify the table contains the dash (config column)
      expect(output).toMatch(/device-1.*Acme.*X1.*-/)
    })
  })

  describe('loading modes', () => {
    test('should load driver by package name', async () => {
      mockLoadDriver.mockResolvedValue({
        createDriver: jest.fn(),
        devices: { 'device-1': { manufacturer: 'Acme', model: 'X1' } },
      })

      await listDevicesCommand({ driver: 'my-driver-package', format: 'json' })

      expect(mockLoadDriver).toHaveBeenCalledWith({ driverPackage: 'my-driver-package' })
    })
  })
})
