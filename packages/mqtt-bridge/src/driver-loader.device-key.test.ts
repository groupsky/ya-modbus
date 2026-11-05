/**
 * The `device` key of a device config selects a model of a driver that supports several
 * (DEVICES). The bridge passes it to createDriver and uses the defaults and supported settings
 * of that model.
 *
 * Uses the real DriverLoader and TransportManager. Only modbus-serial is replaced, so the tests
 * see the settings that the serial port is opened with.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { LoadedDriver } from '@ya-modbus/driver-loader'
import type { DeviceDriver, DriverConfig } from '@ya-modbus/driver-types'
import { TransportManager } from '@ya-modbus/transport'

import { checkDriver, DriverLoader } from './driver-loader.js'
import type { RTUConnection } from './types.js'

jest.mock('modbus-serial')

const driver: DeviceDriver = {
  name: 'meter',
  manufacturer: 'Test',
  model: 'TEST',
  dataPoints: [],
  readDataPoint: () => Promise.resolve(0),
  writeDataPoint: () => Promise.resolve(),
  readDataPoints: () => Promise.resolve({}),
}

const createDriver = jest.fn((_config: DriverConfig) => Promise.resolve(driver))

/** A driver with two models: `fast` works at 19200 even parity only */
const multiModelDriver: LoadedDriver = {
  createDriver,
  defaultConfig: { baudRate: 9600, parity: 'none', dataBits: 8, stopBits: 1, defaultAddress: 1 },
  devices: {
    basic: { manufacturer: 'Test', model: 'BASIC' },
    fast: {
      manufacturer: 'Test',
      model: 'FAST',
      defaultConfig: {
        baudRate: 19200,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 1,
      },
      supportedConfig: { validBaudRates: [19200], validParity: ['even'] },
    },
  },
}

/** A driver without DEVICES */
const singleModelDriver: LoadedDriver = {
  createDriver,
  defaultConfig: { baudRate: 9600, parity: 'none', dataBits: 8, stopBits: 1, defaultAddress: 1 },
}

const rtu = (settings: Partial<RTUConnection> = {}): RTUConnection => ({
  type: 'rtu',
  port: '/dev/ttyUSB0',
  slaveId: 1,
  ...settings,
})

const load = (loadedDriver: LoadedDriver) => () => Promise.resolve(loadedDriver)

describe('DriverLoader device key', () => {
  let connectRTUBuffered: jest.Mock<(port: string, options: object) => Promise<void>>
  let loader: DriverLoader

  function useDriver(loadedDriver: LoadedDriver): void {
    loader = new DriverLoader(load(loadedDriver), new TransportManager())
  }

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    createDriver.mockClear()
    connectRTUBuffered = jest.fn(() => Promise.resolve())
    jest.requireMock<jest.Mock>('modbus-serial').mockImplementation(() => ({
      isOpen: true,
      connectRTUBuffered,
      setID: jest.fn(),
      setTimeout: jest.fn(),
      on: jest.fn(),
      close: jest.fn((callback: () => void) => callback()),
    }))
  })

  afterEach(async () => {
    await loader.closeAllTransports()
    jest.restoreAllMocks()
  })

  it('should pass the device key to createDriver', async () => {
    useDriver(multiModelDriver)

    await loader.loadDriver('ya-modbus-driver-test', rtu(), 'meter', 'basic')

    expect(createDriver).toHaveBeenCalledWith(expect.objectContaining({ device: 'basic' }))
  })

  it('should not pass a device key to createDriver without one', async () => {
    useDriver(multiModelDriver)

    await loader.loadDriver('ya-modbus-driver-test', rtu(), 'meter')

    expect(createDriver.mock.calls[0]?.[0]).not.toHaveProperty('device')
  })

  it('should open the port with the defaults of the model', async () => {
    useDriver(multiModelDriver)

    await loader.loadDriver('ya-modbus-driver-test', rtu(), 'meter', 'fast')

    expect(connectRTUBuffered).toHaveBeenCalledWith('/dev/ttyUSB0', {
      baudRate: 19200,
      dataBits: 8,
      parity: 'even',
      stopBits: 1,
    })
  })

  it('should reject a setting that the model does not support', async () => {
    useDriver(multiModelDriver)

    await expect(
      loader.loadDriver('ya-modbus-driver-test', rtu({ baudRate: 9600 }), 'meter', 'fast')
    ).rejects.toThrow('Invalid baud rate 9600. This driver supports: 19200')
    expect(createDriver).not.toHaveBeenCalled()
  })

  it('should reject an unknown key with the list of valid keys', async () => {
    useDriver(multiModelDriver)

    await expect(
      loader.loadDriver('ya-modbus-driver-test', rtu(), 'meter', 'slow')
    ).rejects.toThrow('Unknown device "slow" for ya-modbus-driver-test. Valid devices: basic, fast')
    expect(connectRTUBuffered).not.toHaveBeenCalled()
  })

  it('should reject a key for a driver without DEVICES', async () => {
    useDriver(singleModelDriver)

    await expect(
      loader.loadDriver('ya-modbus-driver-test', rtu(), 'meter', 'basic')
    ).rejects.toThrow('ya-modbus-driver-test supports one model only (it has no DEVICES)')
  })

  describe('checkDriver', () => {
    it('should reject an unknown key', async () => {
      await expect(
        checkDriver(
          { driver: 'ya-modbus-driver-test', connection: rtu(), device: 'slow' },
          load(multiModelDriver)
        )
      ).rejects.toThrow('Valid devices: basic, fast')
    })

    it('should check the settings against the model', async () => {
      await expect(
        checkDriver(
          { driver: 'ya-modbus-driver-test', connection: rtu({ parity: 'none' }), device: 'fast' },
          load(multiModelDriver)
        )
      ).rejects.toThrow('Invalid parity')
    })

    it('should accept a valid key', async () => {
      await expect(
        checkDriver(
          { driver: 'ya-modbus-driver-test', connection: rtu(), device: 'fast' },
          load(multiModelDriver)
        )
      ).resolves.toBeUndefined()
    })
  })
})
