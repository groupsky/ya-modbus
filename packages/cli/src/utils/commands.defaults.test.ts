import type { LoadedDriver } from '../driver-loader/loader.js'

import { applyDriverDefaults, type TransportOptions } from './commands.js'

describe('applyDriverDefaults', () => {
  test('should return options unchanged (pass-through)', () => {
    const options: TransportOptions = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      timeout: 1000,
    }

    const result = applyDriverDefaults(options, undefined)

    expect(result).toEqual(options)
    expect(result).toBe(options) // Should be same reference
  })

  test('should return options unchanged even with driver metadata', () => {
    const options: TransportOptions = {
      port: '/dev/ttyUSB0',
      slaveId: 5,
    }

    const driverMetadata: LoadedDriver = {
      createDriver: jest.fn(),
    }

    const result = applyDriverDefaults(options, driverMetadata)

    expect(result).toEqual(options)
    expect(result).toBe(options) // Should be same reference
  })

  test('should return TCP options unchanged', () => {
    const options: TransportOptions = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 5,
    }

    const result = applyDriverDefaults(options, undefined)

    expect(result).toEqual(options)
    expect(result).toBe(options)
  })
})
