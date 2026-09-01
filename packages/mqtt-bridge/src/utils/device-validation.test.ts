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

  it('should reject scoped driver with path traversal attempt', () => {
    const invalidDrivers = [
      '@ya-modbus/driver-../evil',
      '@ya-modbus/driver-test/../hack',
      '@ya-modbus/driver-..\\evil',
    ]

    invalidDrivers.forEach((driver) => {
      const config = {
        deviceId: 'device1',
        driver,
        connection: {
          type: 'tcp',
          host: 'localhost',
          port: 502,
          slaveId: 1,
        },
      }

      expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
    })
  })

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

  it('should throw error for invalid driver package name format', () => {
    const config = {
      deviceId: 'device1',
      driver: 'malicious-driver',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
    expect(() => validateDeviceConfig(config)).toThrow(
      '@ya-modbus/driver-<name> or ya-modbus-driver-<name>'
    )
  })

  it('should throw error for driver with path traversal attempts', () => {
    const invalidDrivers = [
      '../../malicious-code',
      'ya-modbus-driver-../evil',
      'ya-modbus-driver-test/../../hack',
      'ya-modbus-driver-test\\..\\evil',
    ]

    invalidDrivers.forEach((driver) => {
      const config = {
        deviceId: 'device1',
        driver,
        connection: {
          type: 'tcp',
          host: 'localhost',
          port: 502,
          slaveId: 1,
        },
      }

      expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
    })
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

  describe('RTU connection defaults', () => {
    it('should apply defaults for omitted RTU serial parameters', () => {
      const config = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          slaveId: 1,
          // parity, dataBits, stopBits omitted - should get defaults
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
