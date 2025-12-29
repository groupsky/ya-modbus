import type { LoadedDriver } from '../driver-loader/loader.js'

import { showDefaultsCommand, type ShowDefaultsOptions } from './show-defaults.js'

// Mock dependencies
jest.mock('../driver-loader/loader.js')

const { loadDriver } = jest.requireMock('../driver-loader/loader.js')

describe('showDefaultsCommand', () => {
  // Capture console output
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  test('should display serial driver defaults', async () => {
    const driverMetadata: LoadedDriver = {
      createDriver: jest.fn(),
      defaultConfig: {
        baudRate: 9600,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 1,
      },
      supportedConfig: {
        validBaudRates: [9600, 14400, 19200],
        validParity: ['even', 'none'],
        validDataBits: [8],
        validStopBits: [1],
        validAddressRange: [1, 247],
      },
    }

    loadDriver.mockResolvedValue(driverMetadata)

    const options: ShowDefaultsOptions = {
      driver: 'ya-modbus-driver-xymd1',
    }

    await showDefaultsCommand(options)

    // Verify loadDriver was called correctly
    expect(loadDriver).toHaveBeenCalledWith({ driverPackage: 'ya-modbus-driver-xymd1' })

    // Verify output includes DEFAULT_CONFIG
    const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(output).toContain('DEFAULT_CONFIG')
    expect(output).toContain('baudRate: 9600')
    expect(output).toContain('parity: "even"')
    expect(output).toContain('dataBits: 8')
    expect(output).toContain('stopBits: 1')
    expect(output).toContain('defaultAddress: 1')

    // Verify output includes SUPPORTED_CONFIG
    expect(output).toContain('SUPPORTED_CONFIG')
    expect(output).toContain('validBaudRates: [9600,14400,19200]')
    expect(output).toContain('validParity: ["even","none"]')
  })

  test('should display TCP driver defaults', async () => {
    const driverMetadata: LoadedDriver = {
      createDriver: jest.fn(),
      defaultConfig: {
        defaultPort: 502,
        defaultAddress: 1,
      },
      supportedConfig: {
        validPorts: [502],
        validAddressRange: [1, 247],
      },
    }

    loadDriver.mockResolvedValue(driverMetadata)

    const options: ShowDefaultsOptions = {
      driver: 'ya-modbus-driver-tcp-device',
    }

    await showDefaultsCommand(options)

    const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(output).toContain('defaultPort: 502')
    expect(output).toContain('defaultAddress: 1')
  })

  test('should handle driver without defaults', async () => {
    const driverMetadata: LoadedDriver = {
      createDriver: jest.fn(),
    }

    loadDriver.mockResolvedValue(driverMetadata)

    const options: ShowDefaultsOptions = {
      driver: 'minimal-driver',
    }

    await showDefaultsCommand(options)

    const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(output).toContain('No DEFAULT_CONFIG')
    expect(output).toContain('No SUPPORTED_CONFIG')
  })

  test('should auto-detect from cwd when no driver specified', async () => {
    const driverMetadata: LoadedDriver = {
      createDriver: jest.fn(),
      defaultConfig: {
        baudRate: 19200,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 10,
      },
    }

    loadDriver.mockResolvedValue(driverMetadata)

    const options: ShowDefaultsOptions = {}

    await showDefaultsCommand(options)

    expect(loadDriver).toHaveBeenCalledWith({})

    const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    expect(output).toContain('baudRate: 19200')
  })

  test('should throw descriptive error when auto-detection fails', async () => {
    loadDriver.mockRejectedValue(
      new Error(
        'package.json not found in current directory. ' +
          'Run this command from a driver package directory or specify --driver'
      )
    )

    await expect(showDefaultsCommand({})).rejects.toThrow('package.json not found')
  })

  test('should display JSON format when requested', async () => {
    const driverMetadata: LoadedDriver = {
      createDriver: jest.fn(),
      defaultConfig: {
        baudRate: 9600,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 1,
      },
    }

    loadDriver.mockResolvedValue(driverMetadata)

    const options: ShowDefaultsOptions = {
      driver: 'ya-modbus-driver-xymd1',
      format: 'json',
    }

    await showDefaultsCommand(options)

    const output = consoleLogSpy.mock.calls.map((call) => call.join(' ')).join('\n')
    // Should be valid JSON
    expect(() => JSON.parse(output)).not.toThrow()

    const parsed = JSON.parse(output)
    expect(parsed).toEqual({
      defaultConfig: {
        baudRate: 9600,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 1,
      },
      supportedConfig: undefined,
    })
  })
})
