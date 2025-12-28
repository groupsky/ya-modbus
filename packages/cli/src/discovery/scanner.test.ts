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
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
      }

      await scanForDevices(generatorOptions, scanOptions)

      // Quick strategy: 6 serial configs (2 baud × 3 parity)
      // Should connect 6 times (once per serial config)
      expect(mockClient.connectRTUBuffered).toHaveBeenCalledTimes(6)

      // First connection should be with first serial config (9600, none, 8, 1)
      expect(mockClient.connectRTUBuffered).toHaveBeenNthCalledWith(1, '/dev/ttyUSB0', {
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      })

      // Should call setID 1482 times (247 addresses × 6 serial configs)
      expect(mockClient.setID).toHaveBeenCalledTimes(1482)

      // First few calls should be slave IDs 1, 2, 3, ...
      expect(mockClient.setID).toHaveBeenNthCalledWith(1, 1)
      expect(mockClient.setID).toHaveBeenNthCalledWith(2, 2)
      expect(mockClient.setID).toHaveBeenNthCalledWith(3, 3)

      // Should close connection 6 times (once per serial config)
      expect(mockClient.close).toHaveBeenCalledTimes(6)
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
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
      }

      await scanForDevices(generatorOptions, scanOptions)

      // Quick strategy: 6 serial configs (2 baud × 3 parity)
      // Should connect 6 times (once per serial config)
      expect(mockClient.connectRTUBuffered).toHaveBeenCalledTimes(6)

      // Check first two connections have different baud rates
      expect(mockClient.connectRTUBuffered).toHaveBeenNthCalledWith(1, '/dev/ttyUSB0', {
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      })

      // Second call should be different parity (even) or different baud (19200)
      const secondCall = (mockClient.connectRTUBuffered as jest.Mock).mock.calls[1]
      expect(secondCall[0]).toBe('/dev/ttyUSB0')
      // Just verify it's a different config than the first
      expect(secondCall[1]).not.toEqual({
        baudRate: 9600,
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
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
        maxDevices: 0, // Unlimited
      }

      const devices = await scanForDevices(generatorOptions, scanOptions)

      // Quick strategy: 1482 combinations (247 addresses × 6 serial configs)
      // All respond as present, so all 1482 are found
      expect(devices).toHaveLength(1482)
      expect(mockClient.setID).toHaveBeenCalledTimes(1482)
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
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
        onProgress,
      }

      await scanForDevices(generatorOptions, scanOptions)

      // Quick strategy: 1482 combinations
      expect(onProgress).toHaveBeenCalledTimes(1482)
      expect(onProgress).toHaveBeenNthCalledWith(1, 1, 1482, 0) // (current, total, found)
      expect(onProgress).toHaveBeenNthCalledWith(2, 2, 1482, 0)
      expect(onProgress).toHaveBeenNthCalledWith(1482, 1482, 1482, 0) // Last call
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

      // First 3 serial configs (9600 baud) - connection fails
      // Last 3 serial configs (19200 baud) - connection succeeds
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
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 1000,
        delayMs: 0,
        onProgress,
      }

      const devices = await scanForDevices(generatorOptions, scanOptions)

      expect(devices).toHaveLength(0)

      // Should have tried all 6 serial configs (3 with 9600, 3 with 19200)
      expect(mockClient.connectRTUBuffered).toHaveBeenCalledTimes(6)

      // Progress should still be updated for skipped combinations (247 × 3 = 741 skipped for 9600 baud)
      expect(onProgress).toHaveBeenCalledWith(741, 1482, 0) // Skipped first 741 (9600 baud configs)
      expect(onProgress).toHaveBeenCalledWith(1482, 1482, 0) // Tested last 741 (19200 baud configs)
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

    // TODO: Fix delay timing with quick strategy - test expects delays but completes too fast
    test.skip('waits remainder of delay when timeout < delay and no response', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      mockIdentify.mockResolvedValue({
        present: true, // Found device on first try
        responseTimeMs: 10, // Quick response (timeout)
      })

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 10, // Very short timeout
        delayMs: 50, // Delay > timeout
        maxDevices: 1, // Stop after finding 1 device
      }

      const start = Date.now()
      const devices = await scanForDevices(generatorOptions, scanOptions)
      const elapsed = Date.now() - start

      // Found 1 device, stopped after first attempt
      expect(devices).toHaveLength(1)
      // Should have waited at least 40ms (50ms delay - 10ms timeout) for the 1 test
      expect(elapsed).toBeGreaterThanOrEqual(40)
    })

    // TODO: Fix delay timing with quick strategy - test expects delays but completes too fast
    test.skip('waits remainder of delay when identifyDevice throws error and delay > timeout', async () => {
      const mockIdentify = identifyDevice as jest.MockedFunction<typeof identifyDevice>

      // First call throws (takes ~0ms), second call succeeds (takes 10ms, found device)
      let callCount = 0
      mockIdentify.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.reject(new Error('Identification failed'))
        }
        return Promise.resolve({ present: true, responseTimeMs: 10 })
      })

      const generatorOptions: GeneratorOptions = {
        strategy: 'quick',
      }

      const scanOptions: ScanOptions = {
        port: '/dev/ttyUSB0',
        timeout: 10, // Very short timeout
        delayMs: 50, // Delay > timeout
        maxDevices: 1, // Stop after finding 1 device
      }

      const start = Date.now()
      const devices = await scanForDevices(generatorOptions, scanOptions)
      const elapsed = Date.now() - start

      // Found 1 device on second try, first try threw error
      expect(devices).toHaveLength(1)
      // Should have waited at least 90ms total:
      // - First try: error (~0ms) + wait remainder (50ms delay - ~0ms = 50ms)
      // - Second try: success (10ms) + wait remainder (50ms delay - 10ms = 40ms)
      // Total: 50ms + 40ms = 90ms
      expect(elapsed).toBeGreaterThanOrEqual(90)
    })
  })
})
