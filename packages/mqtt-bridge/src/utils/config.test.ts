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

  it('should accept reconnectPeriod of 24 hours', async () => {
    mockedReadFile.mockResolvedValue(
      JSON.stringify({ mqtt: { url: 'mqtt://localhost:1883', reconnectPeriod: 86400000 } })
    )

    const config = await loadConfig('/path/to/config.json')

    expect(config.mqtt.reconnectPeriod).toBe(86400000)
  })

  // The MQTT client sets a timer with this value. setTimeout runs delays above 2^31-1 ms after
  // 1 ms, which would make the client reconnect in a tight loop.
  it.each([86400001, 2 ** 31 - 1, 2 ** 31])(
    'should reject reconnectPeriod of %p ms',
    async (ms) => {
      mockedReadFile.mockResolvedValue(
        JSON.stringify({ mqtt: { url: 'mqtt://localhost:1883', reconnectPeriod: ms } })
      )

      await expect(loadConfig('/path/to/config.json')).rejects.toThrow(
        'Reconnect period must not exceed 24 hours'
      )
    }
  )

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

  it.each(['a/b', 'a+', 'a#', '$SYS', 'a\u0000b'])(
    'should throw error for topicPrefix with MQTT special characters: %j',
    async (topicPrefix) => {
      mockedReadFile.mockResolvedValue(
        JSON.stringify({ mqtt: { url: 'mqtt://localhost:1883' }, topicPrefix })
      )

      await expect(loadConfig('/path/to/config.json')).rejects.toThrow(
        'Topic prefix must not contain MQTT special'
      )
    }
  )

  // The driver defaults apply when the device is added; ex9em needs even parity, not none
  it('should leave the serial settings that an RTU device does not set to the driver', async () => {
    mockedReadFile.mockResolvedValue(
      JSON.stringify({
        devices: [
          {
            deviceId: 'rtu-device',
            driver: '@ya-modbus/driver-ex9em',
            connection: { type: 'rtu', port: '/dev/ttyUSB0', slaveId: 1 },
          },
        ],
      })
    )

    const config = await loadConfig('/path/to/config.json')

    expect(config.devices?.[0].connection).toStrictEqual({
      type: 'rtu',
      port: '/dev/ttyUSB0',
      slaveId: 1,
    })
  })

  it('should keep optional device fields out of the config when they are not set', async () => {
    mockedReadFile.mockResolvedValue(
      JSON.stringify({
        devices: [
          {
            deviceId: 'tcp-device',
            driver: '@ya-modbus/driver-xymd1',
            connection: { type: 'tcp', host: 'localhost', slaveId: 2 },
          },
        ],
      })
    )

    const config = await loadConfig('/path/to/config.json')

    expect(config.devices).toStrictEqual([
      {
        deviceId: 'tcp-device',
        driver: '@ya-modbus/driver-xymd1',
        connection: { type: 'tcp', host: 'localhost', slaveId: 2 },
      },
    ])
  })

  it('should name the invalid device when only one of several devices is invalid', async () => {
    const rtuDevice = (
      deviceId: string
    ): { deviceId: string; driver: string; connection: object } => ({
      deviceId,
      driver: '@ya-modbus/driver-ex9em',
      connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
    })
    mockedReadFile.mockResolvedValue(
      JSON.stringify({ devices: [rtuDevice('device1'), rtuDevice(''), rtuDevice('device3')] })
    )

    await expect(loadConfig('/path/to/config.json')).rejects.toThrow(
      'Invalid configuration: devices.1.deviceId: Device ID must not be empty'
    )
  })
})
