import {
  crossValidateConfigs,
  validateDefaultConfig,
  validateDevices,
  validateSupportedConfig,
} from './config-validator.js'

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

describe('validateDevices', () => {
  describe('valid configurations', () => {
    test('should accept valid devices registry with minimal properties', () => {
      const devices = {
        'device-1': {
          manufacturer: 'Acme',
          model: 'X1',
        },
      }

      expect(() => validateDevices(devices)).not.toThrow()
      expect(validateDevices(devices)).toEqual(devices)
    })

    test('should accept valid devices registry with all properties', () => {
      const devices = {
        'device-1': {
          manufacturer: 'Acme',
          model: 'X1',
          description: 'A test device',
          defaultConfig: {
            baudRate: 9600,
            parity: 'even',
            dataBits: 8,
            stopBits: 1,
            defaultAddress: 1,
          },
          supportedConfig: { validBaudRates: [9600, 19200] },
        },
      }

      expect(() => validateDevices(devices)).not.toThrow()
    })

    test('should accept multiple devices', () => {
      const devices = {
        'device-1': { manufacturer: 'Acme', model: 'X1' },
        'device-2': { manufacturer: 'Acme', model: 'X2' },
        'device-3': { manufacturer: 'Other', model: 'Y1' },
      }

      expect(() => validateDevices(devices)).not.toThrow()
    })
  })

  describe('invalid config shape', () => {
    test('should reject null', () => {
      expect(() => validateDevices(null)).toThrow('Invalid DEVICES: must be an object')
    })

    test('should reject undefined', () => {
      expect(() => validateDevices(undefined)).toThrow('Invalid DEVICES: must be an object')
    })

    test('should reject non-object types', () => {
      expect(() => validateDevices('string')).toThrow('Invalid DEVICES: must be an object')
      expect(() => validateDevices(123)).toThrow('Invalid DEVICES: must be an object')
      expect(() => validateDevices(true)).toThrow('Invalid DEVICES: must be an object')
    })

    test('should reject arrays', () => {
      expect(() => validateDevices([])).toThrow('Invalid DEVICES: must be an object, not an array')
      expect(() => validateDevices([{ manufacturer: 'Acme', model: 'X1' }])).toThrow(
        'Invalid DEVICES: must be an object, not an array'
      )
    })

    test('should reject empty object', () => {
      expect(() => validateDevices({})).toThrow('Invalid DEVICES: must contain at least one device')
    })
  })

  describe('invalid device entries', () => {
    test('should reject non-object device entry', () => {
      expect(() => validateDevices({ 'device-1': null })).toThrow(
        'Invalid DEVICES["device-1"]: must be an object'
      )
      expect(() => validateDevices({ 'device-1': 'string' })).toThrow(
        'Invalid DEVICES["device-1"]: must be an object'
      )
    })

    test('should reject missing manufacturer', () => {
      expect(() => validateDevices({ 'device-1': { model: 'X1' } })).toThrow(
        'Invalid DEVICES["device-1"]: manufacturer must be a string'
      )
    })

    test('should reject non-string manufacturer', () => {
      expect(() => validateDevices({ 'device-1': { manufacturer: 123, model: 'X1' } })).toThrow(
        'Invalid DEVICES["device-1"]: manufacturer must be a string'
      )
    })

    test('should reject missing model', () => {
      expect(() => validateDevices({ 'device-1': { manufacturer: 'Acme' } })).toThrow(
        'Invalid DEVICES["device-1"]: model must be a string'
      )
    })

    test('should reject non-string model', () => {
      expect(() => validateDevices({ 'device-1': { manufacturer: 'Acme', model: 123 } })).toThrow(
        'Invalid DEVICES["device-1"]: model must be a string'
      )
    })

    test('should reject non-string description', () => {
      expect(() =>
        validateDevices({ 'device-1': { manufacturer: 'Acme', model: 'X1', description: 123 } })
      ).toThrow('Invalid DEVICES["device-1"]: description must be a string')
    })
  })

  describe('nested config validation', () => {
    test('should reject invalid nested defaultConfig', () => {
      const devices = {
        'device-1': {
          manufacturer: 'Acme',
          model: 'X1',
          defaultConfig: { baudRate: '9600' }, // string instead of number
        },
      }

      expect(() => validateDevices(devices)).toThrow('Invalid DEVICES["device-1"].defaultConfig:')
    })

    test('should reject invalid nested supportedConfig', () => {
      const devices = {
        'device-1': {
          manufacturer: 'Acme',
          model: 'X1',
          supportedConfig: { validBaudRates: 9600 }, // number instead of array
        },
      }

      expect(() => validateDevices(devices)).toThrow('Invalid DEVICES["device-1"].supportedConfig:')
    })
  })

  describe('device-specific config cross-validation', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

    beforeEach(() => {
      consoleWarnSpy.mockClear()
    })

    afterAll(() => {
      consoleWarnSpy.mockRestore()
    })

    test('should warn when device has inconsistent defaultConfig and supportedConfig', () => {
      const devices = {
        'device-1': {
          manufacturer: 'Acme',
          model: 'X1',
          defaultConfig: {
            baudRate: 115200,
            parity: 'even' as const,
            dataBits: 8 as const,
            stopBits: 1 as const,
            defaultAddress: 1,
          },
          supportedConfig: {
            validBaudRates: [9600],
          },
        },
      }

      validateDevices(devices)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '\nWarning: DEVICES["device-1"] has configuration inconsistencies:'
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '  - baudRate: 115200 is not in validBaudRates: [9600]'
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith('  This may indicate a driver authoring error\n')
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Run: ya-modbus show-defaults --driver <package> to inspect configuration\n'
      )
    })

    test('should not warn when device has consistent configs', () => {
      const devices = {
        'device-1': {
          manufacturer: 'Acme',
          model: 'X1',
          defaultConfig: {
            baudRate: 9600,
            parity: 'even' as const,
            dataBits: 8 as const,
            stopBits: 1 as const,
            defaultAddress: 1,
          },
          supportedConfig: {
            validBaudRates: [9600, 19200],
          },
        },
      }

      validateDevices(devices)

      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    test('should not warn when device has only defaultConfig', () => {
      const devices = {
        'device-1': {
          manufacturer: 'Acme',
          model: 'X1',
          defaultConfig: {
            baudRate: 9600,
            parity: 'even' as const,
            dataBits: 8 as const,
            stopBits: 1 as const,
            defaultAddress: 1,
          },
        },
      }

      validateDevices(devices)

      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    test('should not warn when device has only supportedConfig', () => {
      const devices = {
        'device-1': {
          manufacturer: 'Acme',
          model: 'X1',
          supportedConfig: {
            validBaudRates: [9600, 19200],
          },
        },
      }

      validateDevices(devices)

      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })
  })
})

describe('crossValidateConfigs', () => {
  describe('valid configurations (no warnings)', () => {
    test('should return no warnings for valid serial config', () => {
      const defaultConfig = {
        baudRate: 9600,
        parity: 'even' as const,
        dataBits: 8 as const,
        stopBits: 1 as const,
        defaultAddress: 1,
      }
      const supportedConfig = {
        validBaudRates: [9600, 19200],
        validParity: ['none' as const, 'even' as const, 'odd' as const],
        validDataBits: [7 as const, 8 as const],
        validStopBits: [1 as const, 2 as const],
        validAddressRange: [1, 247] as const,
      }

      const warnings = crossValidateConfigs(defaultConfig, supportedConfig)
      expect(warnings).toEqual([])
    })

    test('should return no warnings for valid TCP config', () => {
      const defaultConfig = {
        defaultPort: 502,
        defaultAddress: 1,
      }
      const supportedConfig = {
        validPorts: [502, 503],
        validAddressRange: [1, 247] as const,
      }

      const warnings = crossValidateConfigs(defaultConfig, supportedConfig)
      expect(warnings).toEqual([])
    })

    test('should return no warnings when supported config has no constraints', () => {
      const defaultConfig = {
        baudRate: 9600,
        parity: 'even' as const,
        dataBits: 8 as const,
        stopBits: 1 as const,
        defaultAddress: 1,
      }
      const supportedConfig = {}

      const warnings = crossValidateConfigs(defaultConfig, supportedConfig)
      expect(warnings).toEqual([])
    })

    test('should return no warnings when default config only has required properties', () => {
      const defaultConfig = {
        baudRate: 9600,
      }
      const supportedConfig = {
        validBaudRates: [9600, 19200],
      }

      const warnings = crossValidateConfigs(defaultConfig, supportedConfig)
      expect(warnings).toEqual([])
    })
  })

  describe('invalid serial configurations', () => {
    test.each([
      {
        field: 'baudRate' as const,
        value: 115200,
        constraint: 'validBaudRates' as const,
        validValues: [9600],
        expectedWarning: 'baudRate: 115200 is not in validBaudRates: [9600]',
      },
      {
        field: 'parity' as const,
        value: 'odd' as const,
        constraint: 'validParity' as const,
        validValues: ['none' as const, 'even' as const],
        expectedWarning: 'parity: "odd" is not in validParity: ["none", "even"]',
      },
      {
        field: 'dataBits' as const,
        value: 7 as const,
        constraint: 'validDataBits' as const,
        validValues: [8 as const],
        expectedWarning: 'dataBits: 7 is not in validDataBits: [8]',
      },
      {
        field: 'stopBits' as const,
        value: 2 as const,
        constraint: 'validStopBits' as const,
        validValues: [1 as const],
        expectedWarning: 'stopBits: 2 is not in validStopBits: [1]',
      },
    ])(
      'should warn when $field is not in $constraint',
      ({ field, value, constraint, validValues, expectedWarning }) => {
        const defaultConfig = {
          baudRate: field === 'baudRate' ? value : 9600,
          parity: (field === 'parity' ? value : 'even') as const,
          dataBits: (field === 'dataBits' ? value : 8) as const,
          stopBits: (field === 'stopBits' ? value : 1) as const,
          defaultAddress: 1,
        }
        const supportedConfig = {
          [constraint]: validValues,
        }

        const warnings = crossValidateConfigs(defaultConfig, supportedConfig)
        expect(warnings).toEqual([expectedWarning])
      }
    )

    test.each([
      { value: 0, description: 'below minimum' },
      { value: 248, description: 'above maximum' },
      { value: 250, description: 'outside validAddressRange' },
    ])('should warn when defaultAddress is $description ($value)', ({ value }) => {
      const defaultConfig = {
        baudRate: 9600,
        parity: 'even' as const,
        dataBits: 8 as const,
        stopBits: 1 as const,
        defaultAddress: value,
      }
      const supportedConfig = {
        validAddressRange: [1, 247] as const,
      }

      const warnings = crossValidateConfigs(defaultConfig, supportedConfig)
      expect(warnings).toEqual([`defaultAddress: ${value} is not in validAddressRange: [1, 247]`])
    })

    test.each([
      { value: 1, description: 'at minimum boundary' },
      { value: 247, description: 'at maximum boundary' },
    ])('should not warn when defaultAddress is $description ($value)', ({ value }) => {
      const defaultConfig = {
        baudRate: 9600,
        parity: 'even' as const,
        dataBits: 8 as const,
        stopBits: 1 as const,
        defaultAddress: value,
      }
      const supportedConfig = {
        validAddressRange: [1, 247] as const,
      }

      const warnings = crossValidateConfigs(defaultConfig, supportedConfig)
      expect(warnings).toEqual([])
    })

    test('should return multiple warnings when multiple constraints are violated', () => {
      const defaultConfig = {
        baudRate: 115200,
        parity: 'odd' as const,
        dataBits: 7 as const,
        stopBits: 2 as const,
        defaultAddress: 250,
      }
      const supportedConfig = {
        validBaudRates: [9600],
        validParity: ['none' as const, 'even' as const],
        validDataBits: [8 as const],
        validStopBits: [1 as const],
        validAddressRange: [1, 247] as const,
      }

      const warnings = crossValidateConfigs(defaultConfig, supportedConfig)
      expect(warnings).toEqual([
        'baudRate: 115200 is not in validBaudRates: [9600]',
        'parity: "odd" is not in validParity: ["none", "even"]',
        'dataBits: 7 is not in validDataBits: [8]',
        'stopBits: 2 is not in validStopBits: [1]',
        'defaultAddress: 250 is not in validAddressRange: [1, 247]',
      ])
    })
  })

  describe('invalid TCP configurations', () => {
    test('should warn when defaultPort is not in validPorts', () => {
      const defaultConfig = {
        defaultPort: 1502,
        defaultAddress: 1,
      }
      const supportedConfig = {
        validPorts: [502],
      }

      const warnings = crossValidateConfigs(defaultConfig, supportedConfig)
      expect(warnings).toEqual(['defaultPort: 1502 is not in validPorts: [502]'])
    })

    test.each([
      { value: 0, description: 'below minimum' },
      { value: 250, description: 'outside validAddressRange' },
    ])('should warn when TCP defaultAddress is $description ($value)', ({ value }) => {
      const defaultConfig = {
        defaultPort: 502,
        defaultAddress: value,
      }
      const supportedConfig = {
        validAddressRange: [1, 247] as const,
      }

      const warnings = crossValidateConfigs(defaultConfig, supportedConfig)
      expect(warnings).toEqual([`defaultAddress: ${value} is not in validAddressRange: [1, 247]`])
    })

    test('should not warn when TCP defaultAddress is at boundary', () => {
      const defaultConfig = {
        defaultPort: 502,
        defaultAddress: 1,
      }
      const supportedConfig = {
        validAddressRange: [1, 247] as const,
      }

      const warnings = crossValidateConfigs(defaultConfig, supportedConfig)
      expect(warnings).toEqual([])
    })

    test('should return multiple warnings for TCP when multiple constraints are violated', () => {
      const defaultConfig = {
        defaultPort: 1502,
        defaultAddress: 250,
      }
      const supportedConfig = {
        validPorts: [502],
        validAddressRange: [1, 247] as const,
      }

      const warnings = crossValidateConfigs(defaultConfig, supportedConfig)
      expect(warnings).toEqual([
        'defaultPort: 1502 is not in validPorts: [502]',
        'defaultAddress: 250 is not in validAddressRange: [1, 247]',
      ])
    })
  })
})
