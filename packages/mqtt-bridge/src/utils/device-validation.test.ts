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
    ['a file: specifier', 'file:../x'],
    ['a short name with a dot', 'x.y'],
    ['a short name with uppercase letters', 'XYMD1'],
  ])('should reject %s and list the allowed forms', (_description, driver) => {
    const config = {
      deviceId: 'device1',
      driver,
      connection: { type: 'tcp', host: 'localhost', port: 502, slaveId: 1 },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
    expect(() => validateDeviceConfig(config)).toThrow(
      'driver: Driver name must be a short name such as xymd1, or @ya-modbus/driver-<name>, ya-modbus-driver-<name> or @<scope>/ya-modbus-driver-<name>'
    )
  })

  it('should accept a short driver name', () => {
    const config = {
      deviceId: 'device1',
      driver: 'xymd1',
      connection: { type: 'tcp', host: 'localhost', port: 502, slaveId: 1 },
    }

    expect(() => validateDeviceConfig(config)).not.toThrow()
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
        maxRetryBackoff: 120000,
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

  it.each([0, -1, 1.5])('should throw error for maxRetryBackoff %p', (maxRetryBackoff) => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: { type: 'tcp', host: 'localhost', port: 502, slaveId: 1 },
      polling: { interval: 5000, maxRetryBackoff },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
  })

  it('should throw error for an unknown polling key', () => {
    const config = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: { type: 'tcp', host: 'localhost', port: 502, slaveId: 1 },
      polling: { interval: 5000, maxRetryBackof: 60000 },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
  })

  describe('interval and retryDelay', () => {
    const build = (polling: object): object => ({
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: { type: 'tcp', host: 'localhost', port: 502, slaveId: 1 },
      polling,
    })

    it('should accept a continuous mode config without interval', () => {
      expect(() => validateDeviceConfig(build({ mode: 'continuous' }))).not.toThrow()
      expect(() =>
        validateDeviceConfig(build({ mode: 'continuous', retryDelay: 2000 }))
      ).not.toThrow()
    })

    it.each([{}, { mode: 'interval' }])(
      'should require interval in interval mode: %p',
      (polling) => {
        expect(() => validateDeviceConfig(build(polling))).toThrow(
          "polling.interval: Polling interval is required unless mode is 'continuous'"
        )
      }
    )

    it.each([100, 86400000])('should accept retryDelay %p ms', (retryDelay) => {
      expect(() => validateDeviceConfig(build({ interval: 1000, retryDelay }))).not.toThrow()
    })

    it.each([99, 86400001, 1.5])('should reject retryDelay %p ms', (retryDelay) => {
      expect(() => validateDeviceConfig(build({ interval: 1000, retryDelay }))).toThrow(
        'polling.retryDelay'
      )
    })

    it('should check maxRetryBackoff against the default retryBackoff (2 x retryDelay)', () => {
      expect(() =>
        validateDeviceConfig(build({ interval: 1000, retryDelay: 3000, maxRetryBackoff: 5999 }))
      ).toThrow('Max retry backoff must not be below the retry backoff')
      expect(() =>
        validateDeviceConfig(build({ mode: 'continuous', maxRetryBackoff: 9999 }))
      ).toThrow('Max retry backoff must not be below the retry backoff')
      expect(() =>
        validateDeviceConfig(build({ mode: 'continuous', maxRetryBackoff: 10000 }))
      ).not.toThrow()
    })
  })

  describe('maxRetryBackoff below the retry backoff', () => {
    const build = (polling: object): object => ({
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: { type: 'tcp', host: 'localhost', port: 502, slaveId: 1 },
      polling,
    })

    it('should throw error when below the configured retryBackoff', () => {
      expect(() =>
        validateDeviceConfig(build({ interval: 1000, retryBackoff: 5000, maxRetryBackoff: 4999 }))
      ).toThrow('maxRetryBackoff: Max retry backoff must not be below the retry backoff')
    })

    it('should throw error when below the default retryBackoff (2 x interval)', () => {
      expect(() => validateDeviceConfig(build({ interval: 1000, maxRetryBackoff: 1999 }))).toThrow(
        'Max retry backoff must not be below the retry backoff'
      )
    })

    it('should accept a value equal to the retryBackoff', () => {
      expect(() =>
        validateDeviceConfig(build({ interval: 1000, retryBackoff: 5000, maxRetryBackoff: 5000 }))
      ).not.toThrow()
      expect(() =>
        validateDeviceConfig(build({ interval: 1000, maxRetryBackoff: 2000 }))
      ).not.toThrow()
    })
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
        name: 'polling.maxRetryBackoff',
        build: (ms: number) => ({
          ...device,
          connection: tcp,
          polling: { interval: 5000, maxRetryBackoff: ms },
        }),
        message: 'Max retry backoff must not exceed 24 hours',
      },
      {
        name: 'RTU connection.timeout',
        build: (ms: number) => ({ ...device, connection: { ...rtu, timeout: ms } }),
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

  describe('connection.attempts and connection.retryDelay', () => {
    const device = { deviceId: 'device1', driver: 'ya-modbus-driver-test' }
    const rtu = { type: 'rtu', port: '/dev/ttyUSB0', slaveId: 1 }
    const tcp = { type: 'tcp', host: 'localhost', slaveId: 1 }

    it.each([
      [rtu, { attempts: 1, retryDelay: 0 }],
      [tcp, { attempts: 10, retryDelay: 60000 }],
    ])('should accept %p with %p', (connection, retry) => {
      const config = { ...device, connection: { ...connection, ...retry } }

      expect(() => validateDeviceConfig(config)).not.toThrow()
    })

    it.each([
      [{ attempts: 0 }, 'connection.attempts: Attempts must be at least 1'],
      [{ attempts: 11 }, 'connection.attempts: Attempts must not exceed 10'],
      [{ attempts: 1.5 }, 'connection.attempts'],
      [{ retryDelay: -1 }, 'connection.retryDelay'],
      [{ retryDelay: 60001 }, 'connection.retryDelay: Retry delay must not exceed 60 seconds'],
    ])('should reject %p', (retry, message) => {
      const config = { ...device, connection: { ...rtu, ...retry } }

      expect(() => validateDeviceConfig(config)).toThrow(message)
    })
  })

  // The error names the field that is wrong and the values it allows (#611)
  describe('connection field errors', () => {
    const rtu = { type: 'rtu', port: '/dev/ttyUSB0', slaveId: 1 }
    const tcp = { type: 'tcp', host: 'localhost', slaveId: 1 }
    const slaveId = 'connection.slaveId: Slave ID must be a whole number from 0 to 247'
    const timeout =
      'connection.timeout: Connection timeout must be a whole number of milliseconds from 1 to 86400000 (24 hours)'
    const delay =
      'connection.interDeviceDelay: Inter-device delay must be a whole number of milliseconds from 0 to 60000 (60 seconds)'
    const serialPort =
      'connection.port: Serial port must be a device path, for example /dev/ttyUSB0'
    const baudRate = 'connection.baudRate: Baud rate must be a number above 0, for example 9600'
    const host = 'connection.host: Host must be a host name or IP address'
    const tcpPort = 'connection.port: TCP port must be a whole number from 1 to 65535'

    it.each([
      [undefined, 'connection: Connection is required'],
      [{ slaveId: 1 }, "connection.type: Connection type must be 'rtu' or 'tcp'"],
      [{ ...rtu, type: 'serial' }, "connection.type: Connection type must be 'rtu' or 'tcp'"],
      [{ type: 'rtu', slaveId: 1 }, 'connection.port: Serial port is required'],
      [{ ...rtu, port: '' }, serialPort],
      [{ ...rtu, port: 1 }, serialPort],
      [{ ...rtu, baudRate: 0 }, baudRate],
      [{ ...rtu, baudRate: '9600' }, baudRate],
      [{ type: 'rtu', port: '/dev/ttyUSB0' }, 'connection.slaveId: Slave ID is required'],
      [{ ...rtu, slaveId: 300 }, slaveId],
      [{ ...rtu, slaveId: -1 }, slaveId],
      [{ ...rtu, slaveId: 1.5 }, slaveId],
      [{ ...rtu, slaveId: '1' }, slaveId],
      [{ ...rtu, slaveId: 1e20 }, slaveId],
      [{ ...rtu, parity: 'evn' }, "connection.parity: Parity must be 'none', 'even' or 'odd'"],
      [{ ...rtu, dataBits: 9 }, 'connection.dataBits: Data bits must be 7 or 8'],
      [{ ...rtu, stopBits: 3 }, 'connection.stopBits: Stop bits must be 1 or 2'],
      [{ ...rtu, timeout: 0 }, timeout],
      [{ ...rtu, timeout: 86400001 }, timeout],
      [{ ...rtu, interDeviceDelay: -1 }, delay],
      [{ ...rtu, interDeviceDelay: 60001 }, delay],
      [
        { ...rtu, pollOrder: 'Fixed' },
        "connection.pollOrder: Poll order must be 'arrival' or 'fixed'",
      ],
      [{ ...rtu, paritty: 'even' }, 'connection: Unrecognized key: "paritty"'],
      [{ type: 'tcp', slaveId: 1 }, 'connection.host: Host is required'],
      [{ ...tcp, host: '' }, host],
      [{ ...tcp, port: 0 }, tcpPort],
      [{ ...tcp, port: 65536 }, tcpPort],
      [{ ...tcp, port: 1.5 }, tcpPort],
      [{ type: 'tcp', host: 'localhost' }, 'connection.slaveId: Slave ID is required'],
      [{ ...tcp, slaveId: 248 }, slaveId],
      [{ ...tcp, timeout: 0 }, timeout],
      [{ ...tcp, pollOrder: 1 }, "connection.pollOrder: Poll order must be 'arrival' or 'fixed'"],
    ])('should name the field and its values for connection %p', (connection, message) => {
      const config = { deviceId: 'device1', driver: 'ya-modbus-driver-test', connection }

      expect(() => validateDeviceConfig(config)).toThrow(
        new Error(`Invalid device configuration: ${message}`)
      )
    })
  })

  // The order in which the devices on one line take turns (#682)
  describe('connection.pollOrder', () => {
    const device = { deviceId: 'device1', driver: 'ya-modbus-driver-test' }
    const connections = [
      ['RTU', { type: 'rtu', port: '/dev/ttyUSB0', slaveId: 1 }],
      ['TCP', { type: 'tcp', host: 'localhost', slaveId: 1 }],
    ] as const

    it.each(connections.flatMap(([name, c]) => ['arrival', 'fixed'].map((v) => [v, name, c])))(
      'should accept %p for a %s connection',
      (pollOrder, _name, connection) => {
        const config = { ...device, connection: { ...connection, pollOrder } }

        expect(() => validateDeviceConfig(config)).not.toThrow()
      }
    )

    it.each(
      connections.flatMap(([name, c]) => ['Fixed', 'config', 1, null].map((v) => [v, name, c]))
    )('should reject %p for a %s connection', (pollOrder, _name, connection) => {
      const config = { ...device, connection: { ...connection, pollOrder } }

      expect(() => validateDeviceConfig(config)).toThrow(
        "connection.pollOrder: Poll order must be 'arrival' or 'fixed'"
      )
    })
  })

  describe('device', () => {
    const device = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: { type: 'tcp', host: 'localhost', slaveId: 1 },
    }

    it('should accept a device key', () => {
      expect(() => validateDeviceConfig({ ...device, device: 'fast' })).not.toThrow()
    })

    it.each(['', 1, null])('should reject %p', (key) => {
      expect(() => validateDeviceConfig({ ...device, device: key })).toThrow(
        'Invalid device configuration: device'
      )
    })
  })

  describe('allowWrites', () => {
    const device = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: { type: 'tcp', host: 'localhost', slaveId: 1 },
    }

    it.each([true, false])('should accept %p', (allowWrites) => {
      expect(() => validateDeviceConfig({ ...device, allowWrites })).not.toThrow()
    })

    it.each(['true', 1, null])('should reject %p', (allowWrites) => {
      expect(() => validateDeviceConfig({ ...device, allowWrites })).toThrow(
        'Invalid device configuration: allowWrites'
      )
    })
  })

  describe('publish', () => {
    const device = {
      deviceId: 'device1',
      driver: 'ya-modbus-driver-test',
      connection: { type: 'tcp', host: 'localhost', slaveId: 1 },
    }

    it.each([{ mode: 'every-poll' }, { mode: 'on-change' }, { mode: 'on-change', heartbeat: 1 }])(
      'should accept %p',
      (publish) => {
        expect(() => validateDeviceConfig({ ...device, publish })).not.toThrow()
      }
    )

    it.each([
      [{}, 'publish.mode'],
      [{ mode: 'changes' }, 'publish.mode'],
      [{ mode: 'on-change', heartbeat: 0 }, 'publish.heartbeat'],
      [{ mode: 'on-change', heartbeat: 86400001 }, 'publish.heartbeat: Heartbeat must not exceed'],
      [{ mode: 'on-change', hearbeat: 1000 }, 'publish: Unrecognized key'],
    ])('should reject %p', (publish, message) => {
      expect(() => validateDeviceConfig({ ...device, publish })).toThrow(
        `Invalid device configuration: ${message}`
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
