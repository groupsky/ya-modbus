import type { DefaultSerialConfig, SupportedSerialConfig } from '@ya-modbus/driver-types'

import type { LoadedDriver } from '../driver-loader/loader.js'

import {
  ValidationError,
  validateBaudRate,
  validateDataBits,
  validateParity,
  validateSerialOptions,
  validateSlaveId,
  validateStopBits,
} from './validation.js'

describe('Validation', () => {
  const xymd1SupportedConfig: SupportedSerialConfig = {
    validBaudRates: [9600, 14400, 19200],
    validParity: ['even', 'none'],
    validDataBits: [8],
    validStopBits: [1],
    validAddressRange: [1, 247],
  }

  const xymd1DefaultConfig: DefaultSerialConfig = {
    baudRate: 9600,
    parity: 'even',
    dataBits: 8,
    stopBits: 1,
    defaultAddress: 1,
  }

  const xymd1DriverMetadata: LoadedDriver = {
    createDriver: jest.fn(),
    defaultConfig: xymd1DefaultConfig,
    supportedConfig: xymd1SupportedConfig,
  }

  describe('ValidationError', () => {
    test('should create error with all properties', () => {
      const error = new ValidationError('Test error', 'baudRate', 115200, [9600, 19200])

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('ValidationError')
      expect(error.message).toBe('Test error')
      expect(error.field).toBe('baudRate')
      expect(error.value).toBe(115200)
      expect(error.validValues).toEqual([9600, 19200])
    })
  })

  describe('validateBaudRate', () => {
    test('should pass for valid baud rate', () => {
      expect(() => {
        validateBaudRate(9600, xymd1DriverMetadata)
      }).not.toThrow()

      expect(() => {
        validateBaudRate(19200, xymd1DriverMetadata)
      }).not.toThrow()
    })

    test('should throw ValidationError for invalid baud rate', () => {
      expect(() => {
        validateBaudRate(115200, xymd1DriverMetadata)
      }).toThrow(ValidationError)
    })

    test('should include correct details in ValidationError for invalid baud rate', () => {
      expect(() => {
        validateBaudRate(115200, xymd1DriverMetadata)
      }).toThrow(
        expect.objectContaining({
          name: 'ValidationError',
          field: 'baudRate',
          value: 115200,
        })
      )

      expect(() => {
        validateBaudRate(115200, xymd1DriverMetadata)
      }).toThrow(/115200/)

      expect(() => {
        validateBaudRate(115200, xymd1DriverMetadata)
      }).toThrow(/9600, 14400, 19200/)

      expect(() => {
        validateBaudRate(115200, xymd1DriverMetadata)
      }).toThrow(/default: 9600/)
    })

    test('should pass when baudRate is undefined', () => {
      expect(() => {
        validateBaudRate(undefined, xymd1DriverMetadata)
      }).not.toThrow()
    })

    test('should pass when no driver metadata provided', () => {
      expect(() => {
        validateBaudRate(115200, undefined)
      }).not.toThrow()
    })

    test('should pass when no SUPPORTED_CONFIG provided', () => {
      const metadata: LoadedDriver = {
        createDriver: jest.fn(),
        defaultConfig: xymd1DefaultConfig,
        supportedConfig: undefined,
      }

      expect(() => {
        validateBaudRate(115200, metadata)
      }).not.toThrow()
    })

    test('should pass when validBaudRates not specified in SUPPORTED_CONFIG', () => {
      const metadata: LoadedDriver = {
        createDriver: jest.fn(),
        supportedConfig: {
          validParity: ['even'],
        } as SupportedSerialConfig,
      }

      expect(() => {
        validateBaudRate(115200, metadata)
      }).not.toThrow()
    })
  })

  describe('validateParity', () => {
    test('should pass for valid parity', () => {
      expect(() => {
        validateParity('even', xymd1DriverMetadata)
      }).not.toThrow()

      expect(() => {
        validateParity('none', xymd1DriverMetadata)
      }).not.toThrow()
    })

    test('should throw ValidationError for invalid parity', () => {
      expect(() => {
        validateParity('odd', xymd1DriverMetadata)
      }).toThrow(ValidationError)

      expect(() => {
        validateParity('odd', xymd1DriverMetadata)
      }).toThrow(
        expect.objectContaining({
          name: 'ValidationError',
          field: 'parity',
          value: 'odd',
        })
      )

      expect(() => {
        validateParity('odd', xymd1DriverMetadata)
      }).toThrow(/odd/)

      expect(() => {
        validateParity('odd', xymd1DriverMetadata)
      }).toThrow(/even, none/)

      expect(() => {
        validateParity('odd', xymd1DriverMetadata)
      }).toThrow(/default: even/)
    })

    test('should pass when parity is undefined', () => {
      expect(() => {
        validateParity(undefined, xymd1DriverMetadata)
      }).not.toThrow()
    })
  })

  describe('validateDataBits', () => {
    test('should pass for valid data bits', () => {
      expect(() => {
        validateDataBits(8, xymd1DriverMetadata)
      }).not.toThrow()
    })

    test('should throw ValidationError for invalid data bits', () => {
      expect(() => {
        validateDataBits(7, xymd1DriverMetadata)
      }).toThrow(ValidationError)

      expect(() => {
        validateDataBits(7, xymd1DriverMetadata)
      }).toThrow(
        expect.objectContaining({
          field: 'dataBits',
          value: 7,
        })
      )

      expect(() => {
        validateDataBits(7, xymd1DriverMetadata)
      }).toThrow(/7/)

      expect(() => {
        validateDataBits(7, xymd1DriverMetadata)
      }).toThrow(/8/)

      expect(() => {
        validateDataBits(7, xymd1DriverMetadata)
      }).toThrow(/default: 8/)
    })

    test('should pass when dataBits is undefined', () => {
      expect(() => {
        validateDataBits(undefined, xymd1DriverMetadata)
      }).not.toThrow()
    })
  })

  describe('validateStopBits', () => {
    test('should pass for valid stop bits', () => {
      expect(() => {
        validateStopBits(1, xymd1DriverMetadata)
      }).not.toThrow()
    })

    test('should throw ValidationError for invalid stop bits', () => {
      expect(() => {
        validateStopBits(2, xymd1DriverMetadata)
      }).toThrow(ValidationError)

      expect(() => {
        validateStopBits(2, xymd1DriverMetadata)
      }).toThrow(
        expect.objectContaining({
          field: 'stopBits',
          value: 2,
        })
      )

      expect(() => {
        validateStopBits(2, xymd1DriverMetadata)
      }).toThrow(/2/)

      expect(() => {
        validateStopBits(2, xymd1DriverMetadata)
      }).toThrow(/1/)

      expect(() => {
        validateStopBits(2, xymd1DriverMetadata)
      }).toThrow(/default: 1/)
    })

    test('should pass when stopBits is undefined', () => {
      expect(() => {
        validateStopBits(undefined, xymd1DriverMetadata)
      }).not.toThrow()
    })
  })

  describe('validateSlaveId', () => {
    test('should pass for valid slave ID', () => {
      expect(() => {
        validateSlaveId(1, xymd1DriverMetadata)
      }).not.toThrow()

      expect(() => {
        validateSlaveId(247, xymd1DriverMetadata)
      }).not.toThrow()

      expect(() => {
        validateSlaveId(100, xymd1DriverMetadata)
      }).not.toThrow()
    })

    test('should throw ValidationError for slave ID below minimum', () => {
      expect(() => {
        validateSlaveId(0, xymd1DriverMetadata)
      }).toThrow(ValidationError)

      expect(() => {
        validateSlaveId(0, xymd1DriverMetadata)
      }).toThrow(
        expect.objectContaining({
          field: 'slaveId',
          value: 0,
        })
      )

      expect(() => {
        validateSlaveId(0, xymd1DriverMetadata)
      }).toThrow(/0/)

      expect(() => {
        validateSlaveId(0, xymd1DriverMetadata)
      }).toThrow(/1-247/)

      expect(() => {
        validateSlaveId(0, xymd1DriverMetadata)
      }).toThrow(/default: 1/)
    })

    test('should throw ValidationError for slave ID above maximum', () => {
      expect(() => {
        validateSlaveId(248, xymd1DriverMetadata)
      }).toThrow(ValidationError)

      expect(() => {
        validateSlaveId(248, xymd1DriverMetadata)
      }).toThrow(
        expect.objectContaining({
          field: 'slaveId',
          value: 248,
        })
      )

      expect(() => {
        validateSlaveId(248, xymd1DriverMetadata)
      }).toThrow(/248/)

      expect(() => {
        validateSlaveId(248, xymd1DriverMetadata)
      }).toThrow(/1-247/)
    })

    test('should pass when slaveId is undefined', () => {
      expect(() => {
        validateSlaveId(undefined, xymd1DriverMetadata)
      }).not.toThrow()
    })
  })

  describe('validateSerialOptions', () => {
    test('should pass for all valid options', () => {
      expect(() => {
        validateSerialOptions(
          {
            baudRate: 9600,
            parity: 'even',
            dataBits: 8,
            stopBits: 1,
            slaveId: 10,
          },
          xymd1DriverMetadata
        )
      }).not.toThrow()
    })

    test('should throw on first invalid option encountered', () => {
      expect(() => {
        validateSerialOptions(
          {
            baudRate: 115200, // Invalid
            parity: 'odd', // Also invalid but shouldn't reach here
          },
          xymd1DriverMetadata
        )
      }).toThrow(ValidationError)

      // Should fail on baudRate first (not parity)
      expect(() => {
        validateSerialOptions(
          {
            baudRate: 115200,
            parity: 'odd',
          },
          xymd1DriverMetadata
        )
      }).toThrow(
        expect.objectContaining({
          field: 'baudRate',
        })
      )
    })

    test('should pass for partial options', () => {
      expect(() => {
        validateSerialOptions(
          {
            baudRate: 19200,
            // Other options not specified
          },
          xymd1DriverMetadata
        )
      }).not.toThrow()
    })

    test('should pass when no driver metadata provided', () => {
      expect(() => {
        validateSerialOptions(
          {
            baudRate: 115200,
            parity: 'odd',
            dataBits: 7,
            stopBits: 2,
            slaveId: 0,
          },
          undefined
        )
      }).not.toThrow()
    })

    test('should pass for empty options', () => {
      expect(() => {
        validateSerialOptions({}, xymd1DriverMetadata)
      }).not.toThrow()
    })
  })

  describe('Error message formatting', () => {
    test('should include valid values in error message', () => {
      const metadata: LoadedDriver = {
        createDriver: jest.fn(),
        supportedConfig: {
          validBaudRates: [2400, 4800, 9600],
        } as SupportedSerialConfig,
      }

      expect(() => {
        validateBaudRate(1200, metadata)
      }).toThrow(/2400, 4800, 9600/)
    })

    test('should include default value when available', () => {
      expect(() => {
        validateBaudRate(115200, xymd1DriverMetadata)
      }).toThrow(/default: 9600/)
    })

    test('should not include default when not available', () => {
      const metadata: LoadedDriver = {
        createDriver: jest.fn(),
        supportedConfig: {
          validBaudRates: [9600, 19200],
        } as SupportedSerialConfig,
        // No defaultConfig
      }

      expect(() => {
        validateBaudRate(115200, metadata)
      }).toThrow(ValidationError)

      expect(() => {
        validateBaudRate(115200, metadata)
      }).toThrow(/115200/)

      expect(() => {
        validateBaudRate(115200, metadata)
      }).toThrow(/9600, 19200/)

      // Should NOT contain default
      expect(() => {
        validateBaudRate(115200, metadata)
      }).not.toThrow(/default:/)
    })
  })
})
