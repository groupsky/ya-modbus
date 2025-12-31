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
})
