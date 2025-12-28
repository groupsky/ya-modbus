import type ModbusRTU from 'modbus-serial'

import { identifyDevice } from './device-identifier.js'
import type { GeneratorOptions } from './parameter-generator.js'
import { scanForDevices, type ScanOptions } from './scanner.js'

// Mock modbus-serial
jest.mock('modbus-serial')

// Mock device-identifier
jest.mock('./device-identifier.js', () => ({
  identifyDevice: jest.fn(),
}))

describe('scanForDevices', () => {
  let mockClient: jest.Mocked<Partial<ModbusRTU>>

  beforeEach(() => {
    jest.clearAllMocks()

    mockClient = {
      connectRTUBuffered: jest.fn().mockResolvedValue(undefined),
      setID: jest.fn(),
      setTimeout: jest.fn(),
      close: jest.fn((callback: () => void) => callback()),
    }

    // Default ModbusRTU constructor to return our mock
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ModbusRTUConstructor = require('modbus-serial') as jest.MockedClass<typeof ModbusRTU>
    ModbusRTUConstructor.mockImplementation(() => mockClient as ModbusRTU)
  })

  describe('basic scanning', () => {
    test('scans all parameter combinations and finds devices', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      // Mock device found at slave ID 52
      mockIdentify.mockImplementation((client) => {
        // Get the slave ID from the last setID call
        const slaveId = (client.setID as jest.Mock).mock.lastCall?.[0]
        if (slaveId === 52) {
          return {
            present: true,
            responseTimeMs: 45.67,
            supportsFC43: true,
            vendorName: 'Test Vendor',
          }
        }
        return {
          present: false,
          responseTimeMs: 10,
          timeout: true,
        }
      })

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [50, 55],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 100,
      }

      const devices = await scanForDevices(generatorOptions, scanOptions)

      expect(devices).toHaveLength(1)
      expect(devices[0]).toMatchObject({
        slaveId: 52,
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        identification: {
          present: true,
          responseTimeMs: 45.67,
          supportsFC43: true,
          vendorName: 'Test Vendor',
        },
      })
    })

    test('returns empty array when no devices found', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      mockIdentify.mockResolvedValue({
        present: false,
        responseTimeMs: 10,
        timeout: true,
      })

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validAddressRange: [1, 3],
          validBaudRates: [9600],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
      }

      const devices = await scanForDevices(generatorOptions, scanOptions)

      expect(devices).toHaveLength(0)
    })
  })

  describe('connection reuse optimization', () => {
    test('reuses connection for all slave IDs with same serial params', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      mockIdentify.mockResolvedValue({
        present: false,
        responseTimeMs: 10,
        timeout: true,
      })

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 5],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
      }

      await scanForDevices(generatorOptions, scanOptions)

      // Should connect only once for all 5 slave IDs
      expect(mockClient.connectRTUBuffered).toHaveBeenCalledTimes(1)
      expect(mockClient.connectRTUBuffered).toHaveBeenCalledWith('/dev/ttyUSB0', {
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      })

      // Should call setID 5 times (once per slave ID)
      expect(mockClient.setID).toHaveBeenCalledTimes(5)
      expect(mockClient.setID).toHaveBeenCalledWith(1)
      expect(mockClient.setID).toHaveBeenCalledWith(2)
      expect(mockClient.setID).toHaveBeenCalledWith(3)
      expect(mockClient.setID).toHaveBeenCalledWith(4)
      expect(mockClient.setID).toHaveBeenCalledWith(5)

      // Should close connection once
      expect(mockClient.close).toHaveBeenCalledTimes(1)
    })

    test('creates new connection for different serial params', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      mockIdentify.mockResolvedValue({
        present: false,
        responseTimeMs: 10,
        timeout: true,
      })

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600, 19200],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 2],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
      }

      await scanForDevices(generatorOptions, scanOptions)

      // Should connect twice (once per baud rate)
      expect(mockClient.connectRTUBuffered).toHaveBeenCalledTimes(2)
      expect(mockClient.connectRTUBuffered).toHaveBeenCalledWith('/dev/ttyUSB0', {
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      })
      expect(mockClient.connectRTUBuffered).toHaveBeenCalledWith('/dev/ttyUSB0', {
        baudRate: 19200,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      })
    })
  })

  describe('maxDevices limit', () => {
    test('stops after finding maxDevices devices', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      // All devices present
      mockIdentify.mockResolvedValue({
        present: true,
        responseTimeMs: 45.67,
      })

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 10],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
        maxDevices: 2,
      }

      const devices = await scanForDevices(generatorOptions, scanOptions)

      expect(devices).toHaveLength(2)
      // Should have stopped early
      expect(mockClient.setID).toHaveBeenCalledTimes(2) // Only tested 2 slave IDs
    })

    test('finds all devices when maxDevices is 0', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      mockIdentify.mockResolvedValue({
        present: true,
        responseTimeMs: 45.67,
      })

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 5],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
        maxDevices: 0, // Unlimited
      }

      const devices = await scanForDevices(generatorOptions, scanOptions)

      expect(devices).toHaveLength(5) // Found all 5
      expect(mockClient.setID).toHaveBeenCalledTimes(5)
    })

    test('stops between parameter groups when maxDevices reached', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      // All devices present
      mockIdentify.mockResolvedValue({
        present: true,
        responseTimeMs: 45.67,
      })

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600, 19200], // Two baud rates = two parameter groups
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 5], // 5 slave IDs per group
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
        maxDevices: 3, // Stop after finding 3 devices
      }

      const devices = await scanForDevices(generatorOptions, scanOptions)

      expect(devices).toHaveLength(3)
      // Should have tested 3 slave IDs in first group only
      expect(mockClient.setID).toHaveBeenCalledTimes(3)
      // connectRTUBuffered should be called only once (for first group at 9600 baud)
      expect(mockClient.connectRTUBuffered).toHaveBeenCalledTimes(1)
      expect(mockClient.connectRTUBuffered).toHaveBeenCalledWith('/dev/ttyUSB0', {
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      })
    })
  })

  describe('progress callbacks', () => {
    test('calls onProgress callback with correct values', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>
      mockIdentify.mockResolvedValue({
        present: false,
        responseTimeMs: 10,
        timeout: true,
      })

      const onProgress = jest.fn()

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 3],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
        onProgress,
      }

      await scanForDevices(generatorOptions, scanOptions)

      expect(onProgress).toHaveBeenCalledTimes(3)
      expect(onProgress).toHaveBeenNthCalledWith(1, 1, 3, 0) // (current, total, found)
      expect(onProgress).toHaveBeenNthCalledWith(2, 2, 3, 0)
      expect(onProgress).toHaveBeenNthCalledWith(3, 3, 3, 0)
    })

    test('calls onDeviceFound when device discovered', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      mockIdentify.mockImplementation((client) => {
        const slaveId = (client.setID as jest.Mock).mock.lastCall?.[0]
        if (slaveId === 2) {
          return { present: true, responseTimeMs: 45.67 }
        }
        return { present: false, responseTimeMs: 10, timeout: true }
      })

      const onDeviceFound = jest.fn()

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 3],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
        onDeviceFound,
      }

      await scanForDevices(generatorOptions, scanOptions)

      expect(onDeviceFound).toHaveBeenCalledTimes(1)
      expect(onDeviceFound).toHaveBeenCalledWith(
        expect.objectContaining({
          slaveId: 2,
          identification: expect.objectContaining({
            present: true,
          }),
        })
      )
    })

    test('calls onTestAttempt for each test', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      mockIdentify.mockImplementation((client) => {
        const slaveId = (client.setID as jest.Mock).mock.lastCall?.[0]
        if (slaveId === 2) {
          return { present: true, responseTimeMs: 45.67 }
        }
        return { present: false, responseTimeMs: 10, timeout: true }
      })

      const onTestAttempt = jest.fn()

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 3],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
        onTestAttempt,
      }

      await scanForDevices(generatorOptions, scanOptions)

      // onTestAttempt is called for 'testing' (entry) and result ('found' or 'not-found')
      // Check that all three event types are present
      const calls = onTestAttempt.mock.calls
      const testingCalls = calls.filter((call) => call[1] === 'testing')
      const foundCalls = calls.filter((call) => call[1] === 'found')
      const notFoundCalls = calls.filter((call) => call[1] === 'not-found')

      expect(testingCalls.length).toBeGreaterThan(0) // At least one 'testing' call
      expect(foundCalls.length).toBe(1) // One device found (slave ID 2)
      expect(notFoundCalls.length).toBeGreaterThan(0) // At least one 'not-found'
    })
  })

  describe('error handling', () => {
    test('continues scanning when connection fails for a serial param group', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      // First baud rate (9600) - connection fails
      // Second baud rate (19200) - connection succeeds
      mockClient.connectRTUBuffered = jest.fn().mockImplementation((_port, options) => {
        if (options.baudRate === 9600) {
          throw new Error('Port busy')
        }
        return Promise.resolve(undefined)
      })

      mockIdentify.mockResolvedValue({
        present: false,
        responseTimeMs: 10,
        timeout: true,
      })

      const onProgress = jest.fn()

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600, 19200],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 2],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
        onProgress,
      }

      const devices = await scanForDevices(generatorOptions, scanOptions)

      expect(devices).toHaveLength(0)

      // Should have tried both baud rates
      expect(mockClient.connectRTUBuffered).toHaveBeenCalledTimes(2)

      // Progress should still be updated for skipped combinations
      expect(onProgress).toHaveBeenCalledWith(2, 4, 0) // Skipped first 2 (9600 baud)
      expect(onProgress).toHaveBeenCalledWith(4, 4, 0) // Tested last 2 (19200 baud)
    })

    test('continues scanning when device identification throws error', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      mockIdentify.mockImplementation((client) => {
        const slaveId = (client.setID as jest.Mock).mock.lastCall?.[0]
        if (slaveId === 2) {
          throw new Error('Network error')
        }
        return { present: false, responseTimeMs: 10, timeout: true }
      })

      const onTestAttempt = jest.fn()

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 3],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
        onTestAttempt,
      }

      const devices = await scanForDevices(generatorOptions, scanOptions)

      expect(devices).toHaveLength(0)

      // Should still have called onTestAttempt for the error case
      expect(onTestAttempt).toHaveBeenCalledWith(
        expect.objectContaining({ slaveId: 2 }),
        'not-found'
      )
    })

    test('closes client even when onProgress throws exception', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      mockIdentify.mockResolvedValue({
        present: false,
        responseTimeMs: 10,
        timeout: true,
      })

      const onProgress = jest.fn().mockImplementation(() => {
        throw new Error('Progress callback error')
      })

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 2],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
        onProgress,
      }

      // Expect the error to be thrown
      await expect(scanForDevices(generatorOptions, scanOptions)).rejects.toThrow(
        'Progress callback error'
      )

      // Client should still be closed despite the error
      expect(mockClient.close).toHaveBeenCalledTimes(1)
    })

    test('logs connection errors with port path in verbose mode', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      // Connection fails for this baud rate
      mockClient.connectRTUBuffered = jest.fn().mockRejectedValue(new Error('Port not found'))

      mockIdentify.mockResolvedValue({
        present: false,
        responseTimeMs: 10,
        timeout: true,
      })

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 2],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
        verbose: true,
      }

      await scanForDevices(generatorOptions, scanOptions)

      // Should log error with port path included
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('/dev/ttyUSB0'))
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('9600'))
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Port not found'))

      consoleWarnSpy.mockRestore()
    })
  })

  describe('delay logic', () => {
    test('waits delay after finding device when continuing scan', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      mockIdentify.mockImplementation((client) => {
        const slaveId = (client.setID as jest.Mock).mock.lastCall?.[0]
        if (slaveId === 1) {
          return { present: true, responseTimeMs: 45.67 }
        }
        return { present: false, responseTimeMs: 10, timeout: true }
      })

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 3],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 50,
        maxDevices: 0, // Continue scan after finding device
      }

      const start = Date.now()
      await scanForDevices(generatorOptions, scanOptions)
      const elapsed = Date.now() - start

      // Should have waited at least 50ms after finding device
      expect(elapsed).toBeGreaterThanOrEqual(50)
    })

    test('does not wait delay after finding device when maxDevices reached', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      mockIdentify.mockResolvedValue({
        present: true,
        responseTimeMs: 45.67,
      })

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 3],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 200, // Long delay
        maxDevices: 1, // Stop after first device
      }

      const start = Date.now()
      await scanForDevices(generatorOptions, scanOptions)
      const elapsed = Date.now() - start

      // Should NOT have waited the 200ms delay (stopped immediately)
      expect(elapsed).toBeLessThan(200)
    })

    test('waits remainder of delay when timeout < delay and no response', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      mockIdentify.mockResolvedValue({
        present: false,
        responseTimeMs: 10, // Quick response (timeout)
        timeout: true,
      })

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 2],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 10, // Very short timeout
        delayMs: 50, // Delay > timeout
      }

      const start = Date.now()
      await scanForDevices(generatorOptions, scanOptions)
      const elapsed = Date.now() - start

      // Should have waited at least (50ms - 10ms) × 2 tests = 80ms
      expect(elapsed).toBeGreaterThanOrEqual(80)
    })

    test('waits remainder of delay when identifyDevice throws error and delay > timeout', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      // Simulate identification error (exception thrown)
      mockIdentify.mockRejectedValue(new Error('Identification failed'))

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
        supportedConfig: {
          validBaudRates: [9600],
          validParity: ['none'],
          validDataBits: [8],
          validStopBits: [1],
          validAddressRange: [1, 2],
        },
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 10, // Very short timeout
        delayMs: 50, // Delay > timeout
      }

      const start = Date.now()
      await scanForDevices(generatorOptions, scanOptions)
      const elapsed = Date.now() - start

      // Should have waited at least (50ms - 10ms) × 2 tests = 80ms
      // Even though identifyDevice throws error, we still wait the remainder
      expect(elapsed).toBeGreaterThanOrEqual(80)
    })
  })
})
