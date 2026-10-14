import { describe, it, expect } from '@jest/globals'

import { validateConfig } from './config-validator.js'

describe('validateConfig', () => {
  it('should validate valid config', () => {
    const config = {
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
    }

    expect(() => validateConfig(config)).not.toThrow()
  })

  it('should throw error for invalid URL protocol', () => {
    const config = {
      mqtt: {
        url: 'http://localhost:1883',
      },
    }

    expect(() => validateConfig(config)).toThrow('Invalid configuration')
    expect(() => validateConfig(config)).toThrow('URL must start with mqtt://')
  })

  it('should throw error for invalid URL format', () => {
    const config = {
      mqtt: {
        url: 'not-a-url',
      },
    }

    expect(() => validateConfig(config)).toThrow('Invalid configuration')
  })

  it('should throw error for missing mqtt object', () => {
    const config = {}

    expect(() => validateConfig(config)).toThrow('Invalid configuration')
  })

  it('should validate config with all options', () => {
    const config = {
      mqtt: {
        url: 'mqtts://broker:8883',
        clientId: 'test',
        username: 'user',
        password: 'pass',
        reconnectPeriod: 5000,
      },
      stateDir: '/tmp/state',
      topicPrefix: 'test',
    }

    expect(() => validateConfig(config)).not.toThrow()
  })

  it('should throw error for invalid reconnectPeriod', () => {
    const config = {
      mqtt: {
        url: 'mqtt://localhost:1883',
        reconnectPeriod: -1,
      },
    }

    expect(() => validateConfig(config)).toThrow('Invalid configuration')
  })

  it('should accept reconnectPeriod of 24 hours', () => {
    const config = { mqtt: { url: 'mqtt://localhost:1883', reconnectPeriod: 86400000 } }

    expect(() => validateConfig(config)).not.toThrow()
  })

  // The MQTT client sets a timer with this value. setTimeout runs delays above 2^31-1 ms after
  // 1 ms, which would make the client reconnect in a tight loop.
  it.each([86400001, 2 ** 31 - 1, 2 ** 31])('should reject reconnectPeriod of %p ms', (ms) => {
    const config = { mqtt: { url: 'mqtt://localhost:1883', reconnectPeriod: ms } }

    expect(() => validateConfig(config)).toThrow('Reconnect period must not exceed 24 hours')
  })

  it('should validate config with devices array', () => {
    const config = {
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
      devices: [
        {
          deviceId: 'device1',
          driver: '@ya-modbus/driver-ex9em',
          connection: {
            type: 'rtu',
            port: '/dev/ttyUSB0',
            baudRate: 9600,
            slaveId: 1,
          },
          polling: {
            interval: 2000,
          },
        },
      ],
    }

    expect(() => validateConfig(config)).not.toThrow()
  })

  it('should validate config with multiple devices', () => {
    const config = {
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
      devices: [
        {
          deviceId: 'rtu-device',
          driver: '@ya-modbus/driver-ex9em',
          connection: {
            type: 'rtu',
            port: '/dev/ttyUSB0',
            baudRate: 9600,
            slaveId: 1,
          },
        },
        {
          deviceId: 'tcp-device',
          driver: '@ya-modbus/driver-xymd1',
          connection: {
            type: 'tcp',
            host: 'localhost',
            port: 502,
            slaveId: 2,
          },
        },
      ],
    }

    expect(() => validateConfig(config)).not.toThrow()
  })

  it('should throw error for invalid device config in devices array', () => {
    const config = {
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
      devices: [
        {
          deviceId: '',
          driver: '@ya-modbus/driver-ex9em',
          connection: {
            type: 'rtu',
            port: '/dev/ttyUSB0',
            baudRate: 9600,
            slaveId: 1,
          },
        },
      ],
    }

    expect(() => validateConfig(config)).toThrow('Invalid configuration')
    expect(() => validateConfig(config)).toThrow('deviceId')
  })

  it('should throw error for invalid driver name in devices array', () => {
    const config = {
      mqtt: {
        url: 'mqtt://localhost:1883',
      },
      devices: [
        {
          deviceId: 'device1',
          driver: 'invalid-driver',
          connection: {
            type: 'rtu',
            port: '/dev/ttyUSB0',
            baudRate: 9600,
            slaveId: 1,
          },
        },
      ],
    }

    expect(() => validateConfig(config)).toThrow('Invalid configuration')
    expect(() => validateConfig(config)).toThrow('driver')
  })

  it.each(['a/b', 'a+', 'a#', '$SYS', 'a\u0000b'])(
    'should throw error for topicPrefix with MQTT special characters: %j',
    (topicPrefix) => {
      const config = { mqtt: { url: 'mqtt://localhost:1883' }, topicPrefix }

      expect(() => validateConfig(config)).toThrow('Topic prefix must not contain MQTT special')
    }
  )

  // The error has to name the invalid device, not only the field
  it('should name the invalid device when only one of several devices is invalid', () => {
    const rtuDevice = (
      deviceId: string
    ): { deviceId: string; driver: string; connection: object } => ({
      deviceId,
      driver: '@ya-modbus/driver-ex9em',
      connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
    })
    const config = {
      mqtt: { url: 'mqtt://localhost:1883' },
      devices: [rtuDevice('device1'), rtuDevice('device+2'), rtuDevice('device3')],
    }

    expect(() => validateConfig(config)).toThrow(
      /devices\.1\.deviceId: Device ID must not contain MQTT special characters/
    )
    expect(() => validateConfig(config)).not.toThrow(/devices\.[02]\./)
  })

  it.each([
    {
      config: { mqtt: { url: 'mqtt://localhost:1883' }, topicprefix: 'x' },
      error: 'Invalid configuration: Unrecognized key: "topicprefix"',
    },
    {
      config: { mqtt: { url: 'mqtt://localhost:1883', clientid: 'x' } },
      error: 'Invalid configuration: mqtt: Unrecognized key: "clientid"',
    },
  ])('should reject an unknown key: $error', ({ config, error }) => {
    expect(() => validateConfig(config)).toThrow(error)
  })

  // Unlike loadConfig, validateConfig checks the merged config as it is and fills in nothing
  it('should throw error when mqtt.url is missing', () => {
    expect(() => validateConfig({ mqtt: {} })).toThrow('mqtt.url')
  })
})
