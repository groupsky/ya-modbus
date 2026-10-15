import { describe, it, expect } from '@jest/globals'

import { validateDeviceConfig } from './device-validation.js'

describe('validateDeviceConfig', () => {
  it('should validate valid TCP device config', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
    }

    expect(() => validateDeviceConfig(config)).not.toThrow()
  })

  it('should validate valid RTU device config', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
      },
    }

    expect(() => validateDeviceConfig(config)).not.toThrow()
  })

  it('should validate valid scoped driver name', () => {
    const config = {
      deviceId: 'device1',
      driver: '@ya-modbus/driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
    }

    expect(() => validateDeviceConfig(config)).not.toThrow()
  })

  it.each([['@org/ya-modbus-driver-solar'], ['@my-org/ya-modbus-driver-sh5k-20']])(
    'should accept scoped third-party driver %s',
    (driver) => {
      const config = {
        deviceId: 'device1',
        driver,
        connection: { type: 'tcp', host: 'localhost', port: 502, slaveId: 1 },
      }

      expect(() => validateDeviceConfig(config)).not.toThrow()
    }
  )

  it('should throw error for deviceId with MQTT special characters', () => {
    const invalidIds = ['device+1', 'device#1', 'device/1', '$device1']

    invalidIds.forEach((deviceId) => {
      const config = {
        deviceId,
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'tcp',
          host: 'localhost',
          port: 502,
          slaveId: 1,
        },
      }

      expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
      expect(() => validateDeviceConfig(config)).toThrow('must not contain MQTT special characters')
    })
  })

  it('should throw error for empty deviceId', () => {
    const config = {
      deviceId: '',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
  })

  it('should throw error for missing driver', () => {
    const config = {
      deviceId: 'device1',
      driver: '',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
  })

  it.each([
    ['a scoped package that is not a driver', '@org/not-a-driver'],
    ['an empty name after the monorepo prefix', '@ya-modbus/driver-'],
    ['a parent directory path', '../x'],
    ['traversal after the unscoped prefix', 'ya-modbus-driver-../evil'],
    ['traversal with backslashes', 'ya-modbus-driver-test\\..\\evil'],
  ])('should reject %s and list the allowed forms', (_description, driver) => {
    const config = {
      deviceId: 'device1',
      driver,
      connection: { type: 'tcp', host: 'localhost', port: 502, slaveId: 1 },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
    expect(() => validateDeviceConfig(config)).toThrow(
      'driver: Driver package name must be @ya-modbus/driver-<name>, ya-modbus-driver-<name> or @<scope>/ya-modbus-driver-<name>'
    )
  })

  it('should throw error for driver with uppercase letters', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-Test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
    expect(() => validateDeviceConfig(config)).toThrow('lowercase')
  })

  it('should accept driver with numbers and hyphens', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-sungrow-sh5k-20',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
    }

    expect(() => validateDeviceConfig(config)).not.toThrow()
  })

  it('should throw error for invalid slaveId', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 300, // Out of range (max 247)
      },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
  })

  describe('boundary values', () => {
    const device = (connection: object, polling?: object): Record<string, unknown> => ({
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection,
      ...(polling && { polling }),
    })
    const rtu = { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600 }
    const tcp = { type: 'tcp', host: 'localhost' }

    it.each([0, 1, 247])('should accept slaveId %p', (slaveId) => {
      expect(() => validateDeviceConfig(device({ ...rtu, slaveId }))).not.toThrow()
      expect(() => validateDeviceConfig(device({ ...tcp, slaveId }))).not.toThrow()
    })

    it.each([-1, 248, 1.5])('should reject slaveId %p', (slaveId) => {
      expect(() => validateDeviceConfig(device({ ...rtu, slaveId }))).toThrow(
        'Invalid device configuration'
      )
      expect(() => validateDeviceConfig(device({ ...tcp, slaveId }))).toThrow(
        'Invalid device configuration'
      )
    })

    it.each([1, 502, 65535])('should accept TCP port %p', (port) => {
      expect(() => validateDeviceConfig(device({ ...tcp, slaveId: 1, port }))).not.toThrow()
    })

    it.each([0, -1, 65536, 1.5])('should reject TCP port %p', (port) => {
      expect(() => validateDeviceConfig(device({ ...tcp, slaveId: 1, port }))).toThrow(
        'Invalid device configuration'
      )
    })

    it.each([100, 86400000])('should accept polling interval %p ms', (interval) => {
      expect(() => validateDeviceConfig(device({ ...tcp, slaveId: 1 }, { interval }))).not.toThrow()
    })

    it.each([99, 86400001])('should reject polling interval %p ms', (interval) => {
      expect(() => validateDeviceConfig(device({ ...tcp, slaveId: 1 }, { interval }))).toThrow(
        'Invalid device configuration'
      )
    })
  })

  it('should accept valid polling config', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
      polling: {
        interval: 5000,
        maxRetries: 3,
        retryBackoff: 10000,
      },
    }

    expect(() => validateDeviceConfig(config)).not.toThrow()
  })

  it('should accept polling config with interval mode', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
      polling: {
        interval: 5000,
        mode: 'interval' as const,
      },
    }

    expect(() => validateDeviceConfig(config)).not.toThrow()
  })

  it('should accept polling config with continuous mode', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
      polling: {
        interval: 5000,
        mode: 'continuous' as const,
      },
    }

    expect(() => validateDeviceConfig(config)).not.toThrow()
  })

  it('should throw error for invalid polling mode', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
      polling: {
        interval: 5000,
        mode: 'invalid',
      },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
  })

  it('should throw error for polling interval = 0', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
      polling: {
        interval: 0,
      },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
    expect(() => validateDeviceConfig(config)).toThrow('at least 100ms')
  })

  it('should throw error for negative polling interval', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
      polling: {
        interval: -1000,
      },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
  })

  it('should throw error for polling interval below 100ms', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
      polling: {
        interval: 50,
      },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
    expect(() => validateDeviceConfig(config)).toThrow('at least 100ms')
  })

  it('should throw error for polling interval above 24 hours', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
      polling: {
        interval: 86400001, // Over 24 hours
      },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
    expect(() => validateDeviceConfig(config)).toThrow('24 hours')
  })

  it('should throw error for negative maxRetries', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
      polling: {
        interval: 5000,
        maxRetries: -1,
      },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
  })

  it('should throw error for maxRetries > 100', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
      polling: {
        interval: 5000,
        maxRetries: 101,
      },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
    expect(() => validateDeviceConfig(config)).toThrow('not exceed 100')
  })

  it('should throw error for negative retryBackoff', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
      polling: {
        interval: 5000,
        retryBackoff: -1000,
      },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
  })

  it('should throw error for zero retryBackoff', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
      polling: {
        interval: 5000,
        retryBackoff: 0,
      },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
  })

  // setTimeout runs a delay above 2^31-1 ms after 1 ms. For retryBackoff that turns the backoff
  // of a failing device into a tight retry loop that floods the bus, and for timeouts it makes
  // every request time out at once. So every duration in a device config is capped at 24 hours.
  describe('duration limits', () => {
    const device = { deviceId: 'device1', driver: 'ya-modbus-driver-test' }
    const rtu = { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 }
    const tcp = { type: 'tcp', host: 'localhost', slaveId: 1 }

    const durationFields = [
      {
        name: 'polling.interval',
        build: (ms: number) => ({ ...device, connection: tcp, polling: { interval: ms } }),
        message: 'Polling interval must not exceed 24 hours',
      },
      {
        name: 'polling.retryBackoff',
        build: (ms: number) => ({
          ...device,
          connection: tcp,
          polling: { interval: 5000, retryBackoff: ms },
        }),
        message: 'Retry backoff must not exceed 24 hours',
      },
      {
        name: 'RTU connection.timeout',
        build: (ms: number) => ({ ...device, connection: { ...rtu, timeout: ms } }),
        // A union of connection types reports only "Invalid input" without the reason
        message: 'Invalid device configuration: connection',
      },
      {
        name: 'TCP connection.timeout',
        build: (ms: number) => ({ ...device, connection: { ...tcp, timeout: ms } }),
        message: 'Invalid device configuration: connection',
      },
    ]

    it.each(durationFields)('should accept $name of exactly 24 hours', ({ build }) => {
      expect(() => validateDeviceConfig(build(86400000))).not.toThrow()
    })

    const tooLong = durationFields.flatMap((field) =>
      [86400001, 2 ** 31 - 1, 2 ** 31].map((ms) => ({ ...field, ms }))
    )

    it.each(tooLong)('should reject $name of $ms ms', ({ build, ms, message }) => {
      expect(() => validateDeviceConfig(build(ms))).toThrow(message)
    })
  })

  describe('RTU connection defaults', () => {
    it('should accept an RTU connection without serial settings (the driver defaults apply)', () => {
      const config = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          slaveId: 1,
        },
      }

      expect(() => validateDeviceConfig(config)).not.toThrow()
    })

    it('should accept explicit RTU serial parameters', () => {
      const config = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          slaveId: 1,
          parity: 'even',
          dataBits: 7,
          stopBits: 2,
        },
      }

      expect(() => validateDeviceConfig(config)).not.toThrow()
    })

    it('should accept timeout for RTU connection', () => {
      const config = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          slaveId: 1,
          timeout: 5000,
        },
      }

      expect(() => validateDeviceConfig(config)).not.toThrow()
    })
  })

  // Pause before a request to a device after a request to another slave on the same port (#655)
  describe('connection.interDeviceDelay', () => {
    const device = { deviceId: 'device1', driver: 'ya-modbus-driver-test' }
    const rtu = { type: 'rtu', port: '/dev/ttyUSB0', slaveId: 1 }

    it.each([0, 150, 60000])('should accept %p ms for an RTU connection', (ms) => {
      const config = { ...device, connection: { ...rtu, interDeviceDelay: ms } }

      expect(() => validateDeviceConfig(config)).not.toThrow()
    })

    it.each([-1, 60001, 1.5, '150', null])('should reject %p for an RTU connection', (value) => {
      const config = { ...device, connection: { ...rtu, interDeviceDelay: value } }

      expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration: connection')
    })

    it('should reject it for a TCP connection', () => {
      const config = {
        ...device,
        connection: { type: 'tcp', host: 'localhost', slaveId: 1, interDeviceDelay: 150 },
      }

      expect(() => validateDeviceConfig(config)).toThrow(
        'Invalid device configuration: connection: Unrecognized key: "interDeviceDelay"'
      )
    })
  })

  it.each([
    {
      config: { connection: { type: 'rtu', port: '/dev/ttyUSB0', slaveId: 1, paritty: 'odd' } },
      error: 'connection: Unrecognized key: "paritty"',
    },
    {
      config: {
        connection: { type: 'tcp', host: 'localhost', slaveId: 1 },
        polling: { interval: 1000, maxretries: 5 },
      },
      error: 'polling: Unrecognized key: "maxretries"',
    },
    {
      config: { connection: { type: 'tcp', host: 'localhost', slaveId: 1 }, enable: false },
      error: 'Unrecognized key: "enable"',
    },
  ])('should reject an unknown key: $error', ({ config, error }) => {
    const device = { deviceId: 'device1', driver: 'ya-modbus-driver-test', ...config }

    expect(() => validateDeviceConfig(device)).toThrow(`Invalid device configuration: ${error}`)
  })

  describe('TCP connection optional port', () => {
    it('should accept TCP connection without port (defaults to 502)', () => {
      const config = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'tcp',
          host: 'localhost',
          slaveId: 1,
          // port omitted - should default to 502
        },
      }

      expect(() => validateDeviceConfig(config)).not.toThrow()
    })

    it('should accept TCP connection with explicit port', () => {
      const config = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'tcp',
          host: 'localhost',
          port: 8502,
          slaveId: 1,
        },
      }

      expect(() => validateDeviceConfig(config)).not.toThrow()
    })

    it('should accept timeout for TCP connection', () => {
      const config = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'tcp',
          host: 'localhost',
          port: 502,
          slaveId: 1,
          timeout: 3000,
        },
      }

      expect(() => validateDeviceConfig(config)).not.toThrow()
    })
  })
})
