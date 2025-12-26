import type { DefaultSerialConfig, DefaultTCPConfig } from '@ya-modbus/driver-types'

import type { LoadedDriver } from '../driver-loader/loader.js'

import { applyDriverDefaults, type TransportOptions } from './commands.js'

describe('applyDriverDefaults', () => {
  describe('TCP connections', () => {
    test('should return options unchanged when host is present (TCP connection)', () => {
      const options: TransportOptions = {
        host: '192.168.1.100',
        port: 502,
        slaveId: 5,
        timeout: 1000,
      }

      const driverMetadata: LoadedDriver = {
        createDriver: jest.fn(),
        defaultConfig: {
          baudRate: 9600,
          parity: 'even',
          dataBits: 8,
          stopBits: 1,
          defaultAddress: 1,
        } as DefaultSerialConfig,
      }

      const result = applyDriverDefaults(options, driverMetadata)

      // TCP options should pass through unchanged (serial defaults don't apply)
      expect(result).toEqual(options)
      expect(result).toBe(options) // Should be same reference
    })
  })

  describe('No driver metadata', () => {
    test('should return options unchanged when driverMetadata is undefined', () => {
      const options: TransportOptions = {
        port: '/dev/ttyUSB0',
        slaveId: 1,
      }

      const result = applyDriverDefaults(options, undefined)

      expect(result).toEqual(options)
      expect(result).toBe(options)
    })

    test('should return options unchanged when defaultConfig is null', () => {
      const options: TransportOptions = {
        port: '/dev/ttyUSB0',
        slaveId: 1,
      }

      const driverMetadata: LoadedDriver = {
        createDriver: jest.fn(),
        defaultConfig: null as unknown as undefined, // Simulating broken third-party driver
      }

      const result = applyDriverDefaults(options, driverMetadata)

      expect(result).toEqual(options)
      expect(result).toBe(options)
    })

    test('should return options unchanged when defaultConfig is undefined', () => {
      const options: TransportOptions = {
        port: '/dev/ttyUSB0',
        slaveId: 1,
      }

      const driverMetadata: LoadedDriver = {
        createDriver: jest.fn(),
        defaultConfig: undefined,
      }

      const result = applyDriverDefaults(options, driverMetadata)

      expect(result).toEqual(options)
      expect(result).toBe(options)
    })

    test('should return options unchanged when defaultConfig is TCP config (not serial)', () => {
      const options: TransportOptions = {
        port: '/dev/ttyUSB0',
        slaveId: 1,
      }

      const driverMetadata: LoadedDriver = {
        createDriver: jest.fn(),
        defaultConfig: {
          defaultAddress: 1,
          defaultPort: 502,
        } as DefaultTCPConfig,
      }

      const result = applyDriverDefaults(options, driverMetadata)

      // TCP config doesn't have baudRate, so it won't be applied to RTU
      expect(result).toEqual(options)
      expect(result).toBe(options)
    })
  })

  describe('Serial (RTU) connections with defaults', () => {
    const defaultSerialConfig: DefaultSerialConfig = {
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 1,
    }

    test('should apply all defaults when user provides minimal options', () => {
      const options: TransportOptions = {
        port: '/dev/ttyUSB0',
        slaveId: 2, // User specified
      }

      const driverMetadata: LoadedDriver = {
        createDriver: jest.fn(),
        defaultConfig: defaultSerialConfig,
      }

      const result = applyDriverDefaults(options, driverMetadata)

      expect(result).toEqual({
        port: '/dev/ttyUSB0',
        slaveId: 2, // User value preserved
        baudRate: 9600, // From driver
        parity: 'even', // From driver
        dataBits: 8, // From driver
        stopBits: 1, // From driver
      })
      expect(result).not.toBe(options) // New object created
    })

    test('should preserve slaveId 0 (broadcast address)', () => {
      const options: TransportOptions = {
        port: '/dev/ttyUSB0',
        slaveId: 0, // Valid Modbus broadcast address
      }

      const driverMetadata: LoadedDriver = {
        createDriver: jest.fn(),
        defaultConfig: defaultSerialConfig,
      }

      const result = applyDriverDefaults(options, driverMetadata)

      // slaveId uses ?? operator, so 0 is preserved (valid broadcast address)
      expect(result.slaveId).toBe(0)
    })

    test('should preserve all user values when all are specified', () => {
      const options: TransportOptions = {
        port: '/dev/ttyUSB1',
        baudRate: 19200,
        parity: 'none',
        dataBits: 7,
        stopBits: 2,
        slaveId: 5,
        timeout: 2000,
      }

      const driverMetadata: LoadedDriver = {
        createDriver: jest.fn(),
        defaultConfig: defaultSerialConfig,
      }

      const result = applyDriverDefaults(options, driverMetadata)

      // All user values should be preserved
      expect(result).toEqual(options)
      expect(result).not.toBe(options) // New object created
    })

    test('should apply partial defaults when user specifies some values', () => {
      const options: TransportOptions = {
        port: '/dev/ttyUSB0',
        baudRate: 19200, // User override
        slaveId: 3, // User value
        // parity, dataBits, stopBits not specified
      }

      const driverMetadata: LoadedDriver = {
        createDriver: jest.fn(),
        defaultConfig: defaultSerialConfig,
      }

      const result = applyDriverDefaults(options, driverMetadata)

      expect(result).toEqual({
        port: '/dev/ttyUSB0',
        baudRate: 19200, // User value preserved
        parity: 'even', // From driver default
        dataBits: 8, // From driver default
        stopBits: 1, // From driver default
        slaveId: 3, // User value preserved
      })
    })

    test('should handle timeout being preserved', () => {
      const options: TransportOptions = {
        port: '/dev/ttyUSB0',
        slaveId: 1,
        timeout: 5000,
      }

      const driverMetadata: LoadedDriver = {
        createDriver: jest.fn(),
        defaultConfig: defaultSerialConfig,
      }

      const result = applyDriverDefaults(options, driverMetadata)

      expect(result.timeout).toBe(5000)
      expect(result.baudRate).toBe(9600) // Default applied
    })

    test('should use slaveId from driver default when undefined', () => {
      const options: TransportOptions = {
        port: '/dev/ttyUSB0',
        slaveId: undefined, // Not specified, will use default
      }

      const driverMetadata: LoadedDriver = {
        createDriver: jest.fn(),
        defaultConfig: {
          ...defaultSerialConfig,
          defaultAddress: 10, // Different default
        },
      }

      const result = applyDriverDefaults(options, driverMetadata)

      // Should use driver default when slaveId is undefined
      expect(result.slaveId).toBe(10)
    })
  })

  describe('Edge cases', () => {
    test('should handle string port value', () => {
      const options: TransportOptions = {
        port: '/dev/ttyS0',
        slaveId: 1,
      }

      const driverMetadata: LoadedDriver = {
        createDriver: jest.fn(),
        defaultConfig: {
          baudRate: 9600,
          parity: 'even',
          dataBits: 8,
          stopBits: 1,
          defaultAddress: 1,
        } as DefaultSerialConfig,
      }

      const result = applyDriverDefaults(options, driverMetadata)

      expect(result.port).toBe('/dev/ttyS0')
      expect(result.baudRate).toBe(9600)
    })

    test('should handle numeric port value for TCP', () => {
      const options: TransportOptions = {
        host: '192.168.1.100',
        port: 5020, // Numeric port
        slaveId: 1,
      }

      const driverMetadata: LoadedDriver = {
        createDriver: jest.fn(),
        defaultConfig: {
          baudRate: 9600,
          parity: 'even',
          dataBits: 8,
          stopBits: 1,
          defaultAddress: 1,
        } as DefaultSerialConfig,
      }

      const result = applyDriverDefaults(options, driverMetadata)

      // Should pass through unchanged (TCP)
      expect(result.port).toBe(5020)
      expect(result.baudRate).toBeUndefined()
    })

    test('should handle partial serial config in driver', () => {
      const options: TransportOptions = {
        port: '/dev/ttyUSB0',
        slaveId: 1,
      }

      // Driver only provides some defaults
      const partialConfig = {
        baudRate: 19200,
        // Missing parity, dataBits, stopBits, defaultAddress
      }

      const driverMetadata: LoadedDriver = {
        createDriver: jest.fn(),
        defaultConfig: partialConfig as DefaultSerialConfig,
      }

      const result = applyDriverDefaults(options, driverMetadata)

      // Should still recognize as serial config and apply baudRate
      expect(result.baudRate).toBe(19200)
      // Missing fields should be undefined (not filled by CLI defaults here)
      expect(result.parity).toBeUndefined()
      expect(result.dataBits).toBeUndefined()
      expect(result.stopBits).toBeUndefined()
    })
  })
})
