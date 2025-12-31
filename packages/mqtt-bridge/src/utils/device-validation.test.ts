import { describe, it, expect } from '@jest/globals'

import { validateDeviceConfig } from './device-validation.js'

describe('validateDeviceConfig', () => {
  it('should validate valid TCP device config', () => {
    const config = {
      deviceId: 'device1',
      driver: 'test-driver',
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
      driver: 'test-driver',
      connection: {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
      },
    }

    expect(() => validateDeviceConfig(config)).not.toThrow()
  })

  it('should throw error for deviceId with MQTT special characters', () => {
    const invalidIds = ['device+1', 'device#1', 'device/1', '$device1']

    invalidIds.forEach((deviceId) => {
      const config = {
        deviceId,
        driver: 'test-driver',
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
      driver: 'test-driver',
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

  it('should throw error for invalid slaveId', () => {
    const config = {
      deviceId: 'device1',
      driver: 'test-driver',
      connection: {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 300, // Out of range (max 247)
      },
    }

    expect(() => validateDeviceConfig(config)).toThrow('Invalid device configuration')
  })
})
