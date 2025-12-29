/**
 * Type-level tests for device driver configuration interfaces
 *
 * These tests verify that the type definitions compile correctly and
 * enforce the expected constraints at compile time.
 */

import type {
  DefaultSerialConfig,
  DefaultTCPConfig,
  DefaultConfig,
  SupportedSerialConfig,
  SupportedTCPConfig,
  SupportedConfig,
  DeviceInfo,
  DeviceRegistry,
} from './device-driver.js'

describe('DefaultSerialConfig', () => {
  it('should accept valid serial configuration', () => {
    const validConfig = {
      baudRate: 9600,
      parity: 'even' as const,
      dataBits: 8 as const,
      stopBits: 1 as const,
      defaultAddress: 1,
    } as const satisfies DefaultSerialConfig

    expect(validConfig.baudRate).toBe(9600)
    expect(validConfig.parity).toBe('even')
    expect(validConfig.dataBits).toBe(8)
    expect(validConfig.stopBits).toBe(1)
    expect(validConfig.defaultAddress).toBe(1)
  })

  it('should preserve literal types with satisfies', () => {
    const config = {
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 1,
    } as const satisfies DefaultSerialConfig

    // Type assertion to verify literal type is preserved
    const _parityType: 'even' = config.parity
    const _dataBitsType: 8 = config.dataBits
    const _stopBitsType: 1 = config.stopBits

    expect(_parityType).toBe('even')
    expect(_dataBitsType).toBe(8)
    expect(_stopBitsType).toBe(1)
  })

  it('should support all valid parity options', () => {
    const noneConfig: DefaultSerialConfig = {
      baudRate: 9600,
      parity: 'none',
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 1,
    }

    const evenConfig: DefaultSerialConfig = {
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 1,
    }

    const oddConfig: DefaultSerialConfig = {
      baudRate: 9600,
      parity: 'odd',
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 1,
    }

    expect(noneConfig.parity).toBe('none')
    expect(evenConfig.parity).toBe('even')
    expect(oddConfig.parity).toBe('odd')
  })

  it('should support both 7 and 8 data bits', () => {
    const sevenBits: DefaultSerialConfig = {
      baudRate: 9600,
      parity: 'even',
      dataBits: 7,
      stopBits: 1,
      defaultAddress: 1,
    }

    const eightBits: DefaultSerialConfig = {
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 1,
    }

    expect(sevenBits.dataBits).toBe(7)
    expect(eightBits.dataBits).toBe(8)
  })

  it('should support both 1 and 2 stop bits', () => {
    const oneStopBit: DefaultSerialConfig = {
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 1,
    }

    const twoStopBits: DefaultSerialConfig = {
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 2,
      defaultAddress: 1,
    }

    expect(oneStopBit.stopBits).toBe(1)
    expect(twoStopBits.stopBits).toBe(2)
  })
})

describe('DefaultTCPConfig', () => {
  it('should accept valid TCP configuration', () => {
    const validConfig = {
      defaultAddress: 1,
      defaultPort: 502,
    } as const satisfies DefaultTCPConfig

    expect(validConfig.defaultAddress).toBe(1)
    expect(validConfig.defaultPort).toBe(502)
  })

  it('should preserve literal types with satisfies', () => {
    const config = {
      defaultAddress: 1,
      defaultPort: 502,
    } as const satisfies DefaultTCPConfig

    // Type assertion to verify literal type is preserved
    const _addressType: 1 = config.defaultAddress
    const _portType: 502 = config.defaultPort

    expect(_addressType).toBe(1)
    expect(_portType).toBe(502)
  })
})

describe('DefaultConfig union type', () => {
  it('should accept DefaultSerialConfig', () => {
    const serialConfig: DefaultConfig = {
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 1,
    }

    expect(serialConfig.defaultAddress).toBe(1)
    expect('baudRate' in serialConfig).toBe(true)
  })

  it('should accept DefaultTCPConfig', () => {
    const tcpConfig: DefaultConfig = {
      defaultAddress: 1,
      defaultPort: 502,
    }

    expect(tcpConfig.defaultAddress).toBe(1)
    expect('defaultPort' in tcpConfig).toBe(true)
  })
})

describe('SupportedSerialConfig', () => {
  it('should accept valid supported configuration', () => {
    const supportedConfig: SupportedSerialConfig = {
      validBaudRates: [9600, 14400, 19200],
      validParity: ['even', 'none'],
      validDataBits: [8],
      validStopBits: [1],
      validAddressRange: [1, 247],
    }

    expect(supportedConfig.validBaudRates).toEqual([9600, 14400, 19200])
    expect(supportedConfig.validParity).toEqual(['even', 'none'])
    expect(supportedConfig.validDataBits).toEqual([8])
    expect(supportedConfig.validStopBits).toEqual([1])
    expect(supportedConfig.validAddressRange).toEqual([1, 247])
  })

  it('should accept partial supported configuration', () => {
    const partialConfig: SupportedSerialConfig = {
      validBaudRates: [9600, 19200],
    }

    expect(partialConfig.validBaudRates).toEqual([9600, 19200])
    expect(partialConfig.validParity).toBeUndefined()
  })

  it('should preserve literal types with as const', () => {
    const baudRates = [9600, 14400, 19200] as const
    const parity = ['even', 'none'] as const
    const dataBits = [8] as const
    const stopBits = [1] as const

    const supportedConfig: SupportedSerialConfig = {
      validBaudRates: baudRates,
      validParity: parity,
      validDataBits: dataBits,
      validStopBits: stopBits,
    }

    expect(supportedConfig.validBaudRates).toEqual([9600, 14400, 19200])
    expect(supportedConfig.validParity).toEqual(['even', 'none'])
    expect(supportedConfig.validDataBits).toEqual([8])
    expect(supportedConfig.validStopBits).toEqual([1])
  })
})

describe('SupportedTCPConfig', () => {
  it('should accept valid TCP configuration', () => {
    const supportedConfig: SupportedTCPConfig = {
      validPorts: [502, 503],
      validAddressRange: [1, 247],
    }

    expect(supportedConfig.validPorts).toEqual([502, 503])
    expect(supportedConfig.validAddressRange).toEqual([1, 247])
  })

  it('should accept partial TCP configuration', () => {
    const partialConfig: SupportedTCPConfig = {
      validPorts: [502],
    }

    expect(partialConfig.validPorts).toEqual([502])
    expect(partialConfig.validAddressRange).toBeUndefined()
  })

  it('should preserve literal types with as const satisfies', () => {
    const supportedConfig = {
      validPorts: [502],
      validAddressRange: [1, 247],
    } as const satisfies SupportedTCPConfig

    // Type assertions to verify literal types are preserved
    const _portsType: readonly [502] = supportedConfig.validPorts
    const _addressType: readonly [1, 247] = supportedConfig.validAddressRange

    expect(_portsType).toEqual([502])
    expect(_addressType).toEqual([1, 247])
  })
})

describe('SupportedConfig union type', () => {
  it('should accept SupportedSerialConfig', () => {
    const serialConfig: SupportedConfig = {
      validBaudRates: [9600, 14400, 19200],
      validParity: ['even', 'none'],
      validDataBits: [8],
      validStopBits: [1],
      validAddressRange: [1, 247],
    }

    expect(serialConfig.validBaudRates).toEqual([9600, 14400, 19200])
    expect('validBaudRates' in serialConfig).toBe(true)
  })

  it('should accept SupportedTCPConfig', () => {
    const tcpConfig: SupportedConfig = {
      validPorts: [502],
      validAddressRange: [1, 247],
    }

    expect(tcpConfig.validPorts).toEqual([502])
    expect('validPorts' in tcpConfig).toBe(true)
  })
})

describe('DeviceInfo', () => {
  it('should accept minimal device info', () => {
    const deviceInfo: DeviceInfo = {
      manufacturer: 'ORNO',
      model: 'OR-WE-514',
    }

    expect(deviceInfo.manufacturer).toBe('ORNO')
    expect(deviceInfo.model).toBe('OR-WE-514')
    expect(deviceInfo.description).toBeUndefined()
  })

  it('should accept device info with description', () => {
    const deviceInfo: DeviceInfo = {
      manufacturer: 'ORNO',
      model: 'OR-WE-514',
      description: 'Single-phase energy meter',
    }

    expect(deviceInfo.description).toBe('Single-phase energy meter')
  })

  it('should accept device info with serial defaultConfig', () => {
    const deviceInfo: DeviceInfo = {
      manufacturer: 'ORNO',
      model: 'OR-WE-514',
      defaultConfig: {
        baudRate: 9600,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 1,
      },
    }

    expect(deviceInfo.defaultConfig).toBeDefined()
    expect('baudRate' in deviceInfo.defaultConfig!).toBe(true)
  })

  it('should accept device info with TCP defaultConfig', () => {
    const deviceInfo: DeviceInfo = {
      manufacturer: 'Acme',
      model: 'TCP-100',
      defaultConfig: {
        defaultPort: 502,
        defaultAddress: 1,
      },
    }

    expect(deviceInfo.defaultConfig).toBeDefined()
    expect('defaultPort' in deviceInfo.defaultConfig!).toBe(true)
  })

  it('should accept device info with supportedConfig', () => {
    const deviceInfo: DeviceInfo = {
      manufacturer: 'ORNO',
      model: 'OR-WE-514',
      supportedConfig: {
        validBaudRates: [9600, 19200],
        validParity: ['even', 'none'],
      },
    }

    expect(deviceInfo.supportedConfig).toBeDefined()
    expect(deviceInfo.supportedConfig!.validBaudRates).toEqual([9600, 19200])
  })

  it('should accept complete device info', () => {
    const deviceInfo: DeviceInfo = {
      manufacturer: 'ORNO',
      model: 'OR-WE-514',
      description: 'Single-phase energy meter',
      defaultConfig: {
        baudRate: 9600,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 1,
      },
      supportedConfig: {
        validBaudRates: [9600, 19200],
        validParity: ['even', 'none'],
      },
    }

    expect(deviceInfo.manufacturer).toBe('ORNO')
    expect(deviceInfo.model).toBe('OR-WE-514')
    expect(deviceInfo.description).toBe('Single-phase energy meter')
    expect(deviceInfo.defaultConfig).toBeDefined()
    expect(deviceInfo.supportedConfig).toBeDefined()
  })
})

describe('DeviceRegistry', () => {
  it('should accept empty registry at type level (rejected at runtime)', () => {
    // Note: TypeScript allows empty registries, but the CLI validates
    // that DEVICES contains at least one device at runtime.
    const registry: DeviceRegistry = {}

    expect(Object.keys(registry)).toHaveLength(0)
  })

  it('should accept registry with single device', () => {
    const registry: DeviceRegistry = {
      'or-we-514': {
        manufacturer: 'ORNO',
        model: 'OR-WE-514',
      },
    }

    expect(registry['or-we-514'].manufacturer).toBe('ORNO')
    expect(registry['or-we-514'].model).toBe('OR-WE-514')
  })

  it('should accept registry with multiple devices', () => {
    const registry: DeviceRegistry = {
      'or-we-514': {
        manufacturer: 'ORNO',
        model: 'OR-WE-514',
        description: 'Single-phase meter',
      },
      'or-we-516': {
        manufacturer: 'ORNO',
        model: 'OR-WE-516',
        description: 'Three-phase meter',
      },
    }

    expect(Object.keys(registry)).toHaveLength(2)
    expect(registry['or-we-514'].description).toBe('Single-phase meter')
    expect(registry['or-we-516'].description).toBe('Three-phase meter')
  })

  it('should preserve literal types with as const satisfies', () => {
    const registry = {
      'device-a': {
        manufacturer: 'Acme',
        model: 'A1',
      },
      'device-b': {
        manufacturer: 'Acme',
        model: 'B1',
        description: 'Device B',
      },
    } as const satisfies DeviceRegistry

    // Type assertions to verify literal types are preserved
    const _manufacturerA: 'Acme' = registry['device-a'].manufacturer
    const _modelB: 'B1' = registry['device-b'].model

    expect(_manufacturerA).toBe('Acme')
    expect(_modelB).toBe('B1')
  })

  it('should accept devices with device-specific configs', () => {
    const registry: DeviceRegistry = {
      'serial-device': {
        manufacturer: 'Acme',
        model: 'S1',
        defaultConfig: {
          baudRate: 9600,
          parity: 'even',
          dataBits: 8,
          stopBits: 1,
          defaultAddress: 1,
        },
      },
      'tcp-device': {
        manufacturer: 'Acme',
        model: 'T1',
        defaultConfig: {
          defaultPort: 502,
          defaultAddress: 1,
        },
      },
    }

    expect('baudRate' in registry['serial-device'].defaultConfig!).toBe(true)
    expect('defaultPort' in registry['tcp-device'].defaultConfig!).toBe(true)
  })
})
