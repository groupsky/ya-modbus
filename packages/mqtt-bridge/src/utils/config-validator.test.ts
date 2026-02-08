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
})
