/**
 * The serial settings of an RTU device come from the config, and the ones it leaves out from
 * the driver's DEFAULT_CONFIG. Settings outside the driver's SUPPORTED_CONFIG are rejected.
 *
 * Uses the real DriverLoader and TransportManager. Only modbus-serial is replaced, so the tests
 * see the settings that the serial port is opened with.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { LoadedDriver } from '@ya-modbus/driver-loader'
import type { DeviceDriver } from '@ya-modbus/driver-types'
import { TransportManager } from '@ya-modbus/transport'

import { DriverLoader } from './driver-loader.js'
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

/** Like the OR-WE-516: it works only with odd parity */
const oddOnlyDriver: LoadedDriver = {
  createDriver: () => Promise.resolve(driver),
  defaultConfig: { baudRate: 9600, parity: 'odd', dataBits: 8, stopBits: 1, defaultAddress: 1 },
  supportedConfig: {
    validBaudRates: [1200, 2400, 4800, 9600],
    validParity: ['odd'],
    validDataBits: [8],
    validStopBits: [1],
    validAddressRange: [1, 247],
  },
}

/** A driver without DEFAULT_CONFIG and SUPPORTED_CONFIG */
const plainDriver: LoadedDriver = { createDriver: () => Promise.resolve(driver) }

function rtu(settings: Partial<RTUConnection> = {}): RTUConnection {
  return { type: 'rtu', port: '/dev/ttyUSB0', slaveId: 1, ...settings }
}

describe('DriverLoader serial settings', () => {
  let connectRTUBuffered: jest.Mock<(port: string, options: object) => Promise<void>>
  let loader: DriverLoader

  function useDriver(loadedDriver: LoadedDriver): void {
    loader = new DriverLoader(() => Promise.resolve(loadedDriver), new TransportManager())
  }

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
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

  it('should open the port with the driver defaults for the settings that are not set', async () => {
    useDriver(oddOnlyDriver)

    await loader.loadDriver('ya-modbus-driver-test', rtu(), 'meter')

    expect(connectRTUBuffered).toHaveBeenCalledWith('/dev/ttyUSB0', {
      baudRate: 9600,
      dataBits: 8,
      parity: 'odd',
      stopBits: 1,
    })
  })

  it('should keep the settings that are set', async () => {
    useDriver(oddOnlyDriver)

    await loader.loadDriver('ya-modbus-driver-test', rtu({ baudRate: 2400 }), 'meter')

    expect(connectRTUBuffered).toHaveBeenCalledWith('/dev/ttyUSB0', {
      baudRate: 2400,
      dataBits: 8,
      parity: 'odd',
      stopBits: 1,
    })
  })

  it.each([
    [{ parity: 'none' }, "Invalid parity 'none'. This driver supports: odd (default: odd)"],
    [
      { baudRate: 19200 },
      'Invalid baud rate 19200. This driver supports: 1200, 2400, 4800, 9600 (default: 9600)',
    ],
    [{ dataBits: 7 }, 'Invalid data bits 7. This driver supports: 8 (default: 8)'],
    [{ stopBits: 2 }, 'Invalid stop bits 2. This driver supports: 1 (default: 1)'],
    [{ slaveId: 0 }, 'Invalid slave ID 0. This driver supports: 1-247 (default: 1)'],
  ] as const)(
    'should reject %p that the driver does not support, before it opens the port',
    async (settings, message) => {
      useDriver(oddOnlyDriver)

      await expect(
        loader.loadDriver('ya-modbus-driver-test', rtu(settings), 'meter')
      ).rejects.toThrow(message)
      expect(connectRTUBuffered).not.toHaveBeenCalled()
      expect(loader.getDriver('meter')).toBeUndefined()
      expect(loader.getConnectionError('meter')).toBeUndefined()
    }
  )

  it('should log the serial settings that the device uses', async () => {
    useDriver(oddOnlyDriver)

    await loader.loadDriver('ya-modbus-driver-test', rtu(), 'meter')

    expect(console.log).toHaveBeenCalledWith(
      'Device meter uses /dev/ttyUSB0: baud rate 9600, data bits 8, parity odd, stop bits 1'
    )
  })

  it('should report the connection error of the port that the device uses', async () => {
    loader = new DriverLoader(
      () => Promise.resolve(oddOnlyDriver),
      new TransportManager({ startLost: true })
    )
    connectRTUBuffered.mockRejectedValue(new Error('cannot open /dev/ttyUSB0'))

    await loader.loadDriver('ya-modbus-driver-test', rtu(), 'meter')

    expect(loader.getConnectionError('meter')?.message).toContain('cannot open /dev/ttyUSB0')
  })

  describe('driver without DEFAULT_CONFIG', () => {
    it('should use 8 data bits, no parity and 1 stop bit', async () => {
      useDriver(plainDriver)

      await loader.loadDriver('ya-modbus-driver-test', rtu({ baudRate: 19200 }), 'meter')

      expect(connectRTUBuffered).toHaveBeenCalledWith('/dev/ttyUSB0', {
        baudRate: 19200,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
      })
    })

    // The fallback must not open the port with settings the driver does not support
    it('should reject a fallback setting that the driver does not support', async () => {
      useDriver({ ...plainDriver, supportedConfig: oddOnlyDriver.supportedConfig })

      await expect(
        loader.loadDriver('ya-modbus-driver-test', rtu({ baudRate: 9600 }), 'meter')
      ).rejects.toThrow(/^Invalid parity 'none'\. This driver supports: odd$/)
      expect(connectRTUBuffered).not.toHaveBeenCalled()
    })

    it('should require baudRate', async () => {
      useDriver(plainDriver)

      await expect(loader.loadDriver('ya-modbus-driver-test', rtu(), 'meter')).rejects.toThrow(
        'baudRate is required: ya-modbus-driver-test has no DEFAULT_CONFIG'
      )
      expect(connectRTUBuffered).not.toHaveBeenCalled()
    })
  })
})
