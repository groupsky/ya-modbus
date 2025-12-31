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
      stateFile: './bridge-state.json',
    })

    mockedReadFile.mockResolvedValue(configJson)

    const config = await loadConfig('/path/to/config.json')

    expect(config).toEqual({
      mqtt: {
        url: 'mqtt://localhost:1883',
        clientId: 'test-bridge',
      },
      stateFile: './bridge-state.json',
    })
    expect(mockedReadFile).toHaveBeenCalledWith('/path/to/config.json', 'utf-8')
  })

  it('should throw error if mqtt.url is missing', async () => {
    const configJson = JSON.stringify({
      mqtt: {},
    })

    mockedReadFile.mockResolvedValue(configJson)

    await expect(loadConfig('/path/to/config.json')).rejects.toThrow('Invalid configuration')
  })

  it('should throw error if mqtt is missing', async () => {
    const configJson = JSON.stringify({})

    mockedReadFile.mockResolvedValue(configJson)

    await expect(loadConfig('/path/to/config.json')).rejects.toThrow('Invalid configuration')
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
})
