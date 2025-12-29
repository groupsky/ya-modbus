import { loadDriver } from '../driver-loader/loader.js'

import { listDevicesCommand, type ListDevicesOptions } from './list-devices.js'

jest.mock('../driver-loader/loader.js')

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

  describe('validation', () => {
    test('should throw error if neither driver nor local is specified', async () => {
      const options: ListDevicesOptions = {}

      await expect(listDevicesCommand(options)).rejects.toThrow(
        'Either --driver or --local must be specified'
      )
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

    test('should load local driver', async () => {
      mockLoadDriver.mockResolvedValue({
        createDriver: jest.fn(),
        devices: { 'device-1': { manufacturer: 'Acme', model: 'X1' } },
      })

      await listDevicesCommand({ local: true, format: 'json' })

      expect(mockLoadDriver).toHaveBeenCalledWith({ localPackage: true })
    })
  })
})
