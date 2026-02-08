import { readFile } from 'node:fs/promises'

import { describe, it, expect, jest } from '@jest/globals'

import { loadConfig } from './config.js'

jest.mock('node:fs/promises')

const mockedReadFile = readFile as jest.MockedFunction<typeof readFile>

describe('loadConfig', () => {
  it('should load valid configuration from file', async () => {
    const configJson = JSON.stringify({
      mqtt: {
        url: 'mqtt://localhost:1883',
        clientId: 'test-bridge',
      },
      stateDir: './state',
    })

    mockedReadFile.mockResolvedValue(configJson)

    const config = await loadConfig('/path/to/config.json')

    expect(config).toEqual({
      mqtt: {
        url: 'mqtt://localhost:1883',
        clientId: 'test-bridge',
      },
      stateDir: './state',
    })
    expect(mockedReadFile).toHaveBeenCalledWith('/path/to/config.json', 'utf-8')
  })

  it('should default to localhost if mqtt.url is missing', async () => {
    const configJson = JSON.stringify({
      mqtt: {},
    })

    mockedReadFile.mockResolvedValue(configJson)

    const config = await loadConfig('/path/to/config.json')

    expect(config.mqtt.url).toBe('mqtt://localhost:1883')
  })

  it('should not throw if mqtt is missing', async () => {
    const configJson = JSON.stringify({})

    mockedReadFile.mockResolvedValue(configJson)

    const config = await loadConfig('/path/to/config.json')

    expect(config.mqtt.url).toBe('mqtt://localhost:1883')
  })

  it('should throw error for invalid URL protocol', async () => {
    const configJson = JSON.stringify({
      mqtt: {
        url: 'http://localhost:1883',
      },
    })

    mockedReadFile.mockResolvedValue(configJson)

    await expect(loadConfig('/path/to/config.json')).rejects.toThrow(
      'URL must start with mqtt://, mqtts://, ws://, or wss://'
    )
  })

  it('should accept mqtts protocol', async () => {
    const configJson = JSON.stringify({
      mqtt: {
        url: 'mqtts://broker.example.com:8883',
      },
    })

    mockedReadFile.mockResolvedValue(configJson)

    const config = await loadConfig('/path/to/config.json')

    expect(config.mqtt.url).toBe('mqtts://broker.example.com:8883')
  })

  it('should throw error for invalid JSON', async () => {
    mockedReadFile.mockResolvedValue('invalid json')

    await expect(loadConfig('/path/to/config.json')).rejects.toThrow()
  })

  it('should load config with optional fields', async () => {
    const configJson = JSON.stringify({
      mqtt: {
        url: 'mqtt://localhost:1883',
        clientId: 'test',
        username: 'user',
        password: 'pass',
        reconnectPeriod: 10000,
      },
      stateDir: '/tmp/state',
      topicPrefix: 'test',
    })

    mockedReadFile.mockResolvedValue(configJson)

    const config = await loadConfig('/path/to/config.json')

    expect(config).toEqual({
      mqtt: {
        url: 'mqtt://localhost:1883',
        clientId: 'test',
        username: 'user',
        password: 'pass',
        reconnectPeriod: 10000,
      },
      stateDir: '/tmp/state',
      topicPrefix: 'test',
    })
  })

  it('should load devices from config file', async () => {
    const configJson = JSON.stringify({
      mqtt: { url: 'mqtt://localhost:1883' },
      devices: [
        {
          deviceId: 'test-device',
          driver: '@ya-modbus/driver-ex9em',
          connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
          polling: { interval: 2000 },
        },
      ],
    })

    mockedReadFile.mockResolvedValue(configJson)
    const config = await loadConfig('/path/to/config.json')

    expect(config.devices).toBeDefined()
    expect(config.devices).toHaveLength(1)
    expect(config.devices?.[0].deviceId).toBe('test-device')
    expect(config.devices?.[0].driver).toBe('@ya-modbus/driver-ex9em')
  })
})
