import { validateDefaultConfig, validateSupportedConfig } from './config-validator.js'

describe('validateDefaultConfig', () => {
  describe('valid configurations', () => {
    test('should accept valid serial config', () => {
      const config = {
        baudRate: 9600,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 1,
      }

      expect(() => validateDefaultConfig(config)).not.toThrow()
    })

    test('should accept valid serial config with minimal properties', () => {
      const config = {
        baudRate: 9600,
      }

      expect(() => validateDefaultConfig(config)).not.toThrow()
    })

    test('should accept valid TCP config', () => {
      const config = {
        defaultPort: 502,
        defaultAddress: 1,
      }

      expect(() => validateDefaultConfig(config)).not.toThrow()
    })

    test('should accept valid TCP config with minimal properties', () => {
      const config = {
        defaultPort: 502,
      }

      expect(() => validateDefaultConfig(config)).not.toThrow()
    })
  })

  describe('invalid config shape', () => {
    test('should reject null', () => {
      expect(() => validateDefaultConfig(null)).toThrow('Invalid DEFAULT_CONFIG: must be an object')
    })

    test('should reject undefined', () => {
      expect(() => validateDefaultConfig(undefined)).toThrow(
        'Invalid DEFAULT_CONFIG: must be an object'
      )
    })

    test('should reject non-object types', () => {
      expect(() => validateDefaultConfig('string')).toThrow(
        'Invalid DEFAULT_CONFIG: must be an object'
      )
      expect(() => validateDefaultConfig(123)).toThrow('Invalid DEFAULT_CONFIG: must be an object')
      expect(() => validateDefaultConfig(true)).toThrow('Invalid DEFAULT_CONFIG: must be an object')
    })

    test('should reject object without baudRate or defaultPort', () => {
      const config = {
        someOtherProperty: 'value',
      }

      expect(() => validateDefaultConfig(config)).toThrow(
        'Invalid DEFAULT_CONFIG: must have either "baudRate" (serial) or "defaultPort" (TCP)'
      )
    })
  })

  describe('invalid serial config properties', () => {
    test('should reject non-number baudRate', () => {
      const config = {
        baudRate: '9600', // string instead of number
      }

      expect(() => validateDefaultConfig(config)).toThrow(
        'Invalid DEFAULT_CONFIG: baudRate must be a number, got string'
      )
    })

    test('should reject non-string parity', () => {
      const config = {
        baudRate: 9600,
        parity: 1, // number instead of string
      }

      expect(() => validateDefaultConfig(config)).toThrow(
        'Invalid DEFAULT_CONFIG: parity must be a string, got number'
      )
    })

    test('should reject non-number dataBits', () => {
      const config = {
        baudRate: 9600,
        dataBits: '8', // string instead of number
      }

      expect(() => validateDefaultConfig(config)).toThrow(
        'Invalid DEFAULT_CONFIG: dataBits must be a number, got string'
      )
    })

    test('should reject non-number stopBits', () => {
      const config = {
        baudRate: 9600,
        stopBits: '1', // string instead of number
      }

      expect(() => validateDefaultConfig(config)).toThrow(
        'Invalid DEFAULT_CONFIG: stopBits must be a number, got string'
      )
    })

    test('should reject non-number defaultAddress in serial config', () => {
      const config = {
        baudRate: 9600,
        defaultAddress: '1', // string instead of number
      }

      expect(() => validateDefaultConfig(config)).toThrow(
        'Invalid DEFAULT_CONFIG: defaultAddress must be a number, got string'
      )
    })
  })

  describe('invalid TCP config properties', () => {
    test('should reject non-number defaultPort', () => {
      const config = {
        defaultPort: '502', // string instead of number
      }

      expect(() => validateDefaultConfig(config)).toThrow(
        'Invalid DEFAULT_CONFIG: defaultPort must be a number, got string'
      )
    })

    test('should reject non-number defaultAddress in TCP config', () => {
      const config = {
        defaultPort: 502,
        defaultAddress: '1', // string instead of number
      }

      expect(() => validateDefaultConfig(config)).toThrow(
        'Invalid DEFAULT_CONFIG: defaultAddress must be a number, got string'
      )
    })
  })
})

describe('validateSupportedConfig', () => {
  describe('valid configurations', () => {
    test('should accept valid serial config with all properties', () => {
      const config = {
        validBaudRates: [9600, 19200],
        validParity: ['none', 'even', 'odd'],
        validDataBits: [7, 8],
        validStopBits: [1, 2],
        validAddressRange: [1, 247],
      }

      expect(() => validateSupportedConfig(config)).not.toThrow()
    })

    test('should accept valid config with partial properties', () => {
      const config = {
        validBaudRates: [9600],
      }

      expect(() => validateSupportedConfig(config)).not.toThrow()
    })

    test('should accept valid TCP config', () => {
      const config = {
        validPorts: [502, 503],
        validAddressRange: [1, 247],
      }

      expect(() => validateSupportedConfig(config)).not.toThrow()
    })

    test('should accept empty config object', () => {
      const config = {}

      expect(() => validateSupportedConfig(config)).not.toThrow()
    })
  })

  describe('invalid config shape', () => {
    test('should reject null', () => {
      expect(() => validateSupportedConfig(null)).toThrow(
        'Invalid SUPPORTED_CONFIG: must be an object'
      )
    })

    test('should reject undefined', () => {
      expect(() => validateSupportedConfig(undefined)).toThrow(
        'Invalid SUPPORTED_CONFIG: must be an object'
      )
    })

    test('should reject non-object types', () => {
      expect(() => validateSupportedConfig('string')).toThrow(
        'Invalid SUPPORTED_CONFIG: must be an object'
      )
      expect(() => validateSupportedConfig(123)).toThrow(
        'Invalid SUPPORTED_CONFIG: must be an object'
      )
      expect(() => validateSupportedConfig(true)).toThrow(
        'Invalid SUPPORTED_CONFIG: must be an object'
      )
    })
  })

  describe('invalid array properties', () => {
    test('should reject non-array validBaudRates', () => {
      const config = {
        validBaudRates: 9600, // number instead of array
      }

      expect(() => validateSupportedConfig(config)).toThrow(
        'Invalid SUPPORTED_CONFIG: validBaudRates must be an array, got number'
      )
    })

    test('should reject non-array validParity', () => {
      const config = {
        validParity: 'even', // string instead of array
      }

      expect(() => validateSupportedConfig(config)).toThrow(
        'Invalid SUPPORTED_CONFIG: validParity must be an array, got string'
      )
    })

    test('should reject non-array validDataBits', () => {
      const config = {
        validDataBits: 8, // number instead of array
      }

      expect(() => validateSupportedConfig(config)).toThrow(
        'Invalid SUPPORTED_CONFIG: validDataBits must be an array, got number'
      )
    })

    test('should reject non-array validStopBits', () => {
      const config = {
        validStopBits: 1, // number instead of array
      }

      expect(() => validateSupportedConfig(config)).toThrow(
        'Invalid SUPPORTED_CONFIG: validStopBits must be an array, got number'
      )
    })

    test('should reject non-array validAddressRange', () => {
      const config = {
        validAddressRange: '[1, 247]', // string instead of array
      }

      expect(() => validateSupportedConfig(config)).toThrow(
        'Invalid SUPPORTED_CONFIG: validAddressRange must be an array, got string'
      )
    })

    test('should reject validAddressRange with wrong length', () => {
      const configWithOneElement = {
        validAddressRange: [1], // should be [min, max]
      }

      expect(() => validateSupportedConfig(configWithOneElement)).toThrow(
        'Invalid SUPPORTED_CONFIG: validAddressRange must be a 2-element array [min, max]'
      )

      const configWithThreeElements = {
        validAddressRange: [1, 100, 247], // should be [min, max]
      }

      expect(() => validateSupportedConfig(configWithThreeElements)).toThrow(
        'Invalid SUPPORTED_CONFIG: validAddressRange must be a 2-element array [min, max]'
      )
    })

    test('should reject non-array validPorts', () => {
      const config = {
        validPorts: 502, // number instead of array
      }

      expect(() => validateSupportedConfig(config)).toThrow(
        'Invalid SUPPORTED_CONFIG: validPorts must be an array, got number'
      )
    })
  })

  describe('edge cases', () => {
    test('should accept string values for validBaudRates items (runtime values)', () => {
      // Note: We only validate the array type, not the items
      const config = {
        validBaudRates: ['9600', '19200'], // This will be caught by validation.ts when used
      }

      expect(() => validateSupportedConfig(config)).not.toThrow()
    })

    test('should accept object as validParity (wrong but only checks array)', () => {
      const config = {
        validParity: { even: true }, // object instead of array
      }

      expect(() => validateSupportedConfig(config)).toThrow(
        'Invalid SUPPORTED_CONFIG: validParity must be an array, got object'
      )
    })
  })
})
