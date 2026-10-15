/**
 * Devices on one serial port: the pause before a request to a device after a request to another
 * device, and the log of requests that are sent again (#655).
 *
 * Uses the real DriverLoader and TransportManager. Only modbus-serial is replaced.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { LoadedDriver } from '@ya-modbus/driver-loader'
import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'
import { TransportManager } from '@ya-modbus/transport'

import { DriverLoader } from './driver-loader.js'
import type { DeviceConnection, RTUConnection } from './types.js'

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

function rtu(settings: Partial<RTUConnection> = {}): RTUConnection {
  return { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1, ...settings }
}

describe('DriverLoader with devices on one port', () => {
  let loader: DriverLoader
  // Transports that the drivers got, in the order the drivers were loaded
  let transports: Transport[]
  // Slave ID and time of each read that reached the client
  let reads: Array<[slaveId: number, at: number]>
  let readHoldingRegisters: jest.Mock<() => Promise<unknown>>
  let start: number
  const debug = process.env['YA_MODBUS_DEBUG']

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    start = performance.now()
    transports = []
    reads = []
    let slaveId = 0
    readHoldingRegisters = jest.fn(() => {
      reads.push([slaveId, performance.now() - start])
      return Promise.resolve({ data: [0], buffer: Buffer.from([0, 0]) })
    })
    jest.requireMock<jest.Mock>('modbus-serial').mockImplementation(() => ({
      isOpen: true,
      connectRTUBuffered: () => Promise.resolve(),
      connectTCP: () => Promise.resolve(),
      setID: (id: number) => {
        slaveId = id
      },
      setTimeout: () => undefined,
      on: () => undefined,
      close: (callback: () => void) => callback(),
      readHoldingRegisters,
    }))

    const loadedDriver: LoadedDriver = {
      createDriver: ({ transport }) => {
        transports.push(transport)
        return Promise.resolve(driver)
      },
    }
    loader = new DriverLoader(() => Promise.resolve(loadedDriver), new TransportManager())
  })

  afterEach(async () => {
    if (debug === undefined) delete process.env['YA_MODBUS_DEBUG']
    else process.env['YA_MODBUS_DEBUG'] = debug
    await loader.closeAllTransports()
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it.each([
    ['the default of 150 ms', {}, 150],
    ['its interDeviceDelay', { interDeviceDelay: 40 }, 40],
    ['nothing with interDeviceDelay 0', { interDeviceDelay: 0 }, 0],
  ])(
    'should wait %s before a request to a device after a request to another device',
    async (_name, settings, pause) => {
      jest.useFakeTimers()
      start = performance.now()
      await loader.loadDriver('ya-modbus-driver-test', rtu({ slaveId: 1 }), 'meter1')
      await loader.loadDriver('ya-modbus-driver-test', rtu({ slaveId: 2, ...settings }), 'meter2')
      const [meter1, meter2] = transports

      const done = meter1!.readHoldingRegisters(0, 1).then(() => meter2!.readHoldingRegisters(0, 1))
      await jest.runAllTimersAsync()
      await done

      expect(reads).toEqual([
        [1, 0],
        [2, pause],
      ])
    }
  )

  it.each<[string, DeviceConnection]>([
    ['RTU', rtu()],
    ['TCP', { type: 'tcp', host: 'localhost', slaveId: 1 }],
  ])(
    'should log each request of a %s device that is sent again when YA_MODBUS_DEBUG=1',
    async (_name, connection) => {
      process.env['YA_MODBUS_DEBUG'] = '1'
      readHoldingRegisters.mockRejectedValueOnce({ message: 'Timed out', errno: 'ETIMEDOUT' })
      await loader.loadDriver('ya-modbus-driver-test', connection, 'meter')

      await transports[0]!.readHoldingRegisters(0, 1)

      expect(console.warn).toHaveBeenCalledTimes(1)
      expect(console.warn).toHaveBeenCalledWith(
        'Device meter: request failed (try 1), sending it again: Timed out'
      )
    }
  )

  it('should not log requests that are sent again without YA_MODBUS_DEBUG', async () => {
    delete process.env['YA_MODBUS_DEBUG']
    readHoldingRegisters.mockRejectedValueOnce({ message: 'Timed out', errno: 'ETIMEDOUT' })
    await loader.loadDriver('ya-modbus-driver-test', rtu(), 'meter')

    await transports[0]!.readHoldingRegisters(0, 1)

    expect(readHoldingRegisters).toHaveBeenCalledTimes(2)
    expect(console.warn).not.toHaveBeenCalled()
  })
})
