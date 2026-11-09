import { describe, it, expect, jest } from '@jest/globals'
import type { LoadedDriver } from '@ya-modbus/driver-loader'
import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'
import type { TransportManager } from '@ya-modbus/transport'

import { DriverLoader } from './driver-loader.js'
import type { DeviceConnection } from './types.js'

const connection: DeviceConnection = {
  type: 'rtu',
  port: '/dev/ttyUSB0',
  baudRate: 9600,
  slaveId: 1,
  parity: 'none',
  dataBits: 8,
  stopBits: 1,
}

const transport = {} as Transport

const createTransportManager = (): jest.Mocked<TransportManager> =>
  ({
    getTransport: jest.fn().mockResolvedValue(transport),
    releaseTransport: jest.fn().mockResolvedValue(undefined),
    closeAll: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<TransportManager>

/** A driver whose initialize() waits until finish() is called */
const createSlowDriver = (): {
  driver: DeviceDriver
  finish: () => void
  started: Promise<void>
} => {
  let finish!: () => void
  let started!: () => void
  const startedPromise = new Promise<void>((resolve) => (started = resolve))
  const driver = {
    name: 'slow',
    dataPoints: [],
    initialize: () => {
      started()
      return new Promise<void>((resolve) => (finish = resolve))
    },
    destroy: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
  } as unknown as DeviceDriver
  return { driver, finish: () => finish(), started: startedPromise }
}

describe('DriverLoader unloadDriver while the driver loads', () => {
  it('releases the transport of the load and fails the load', async () => {
    const transportManager = createTransportManager()
    const slow = createSlowDriver()
    const loaded: LoadedDriver = { createDriver: jest.fn().mockResolvedValue(slow.driver) }
    const loader = new DriverLoader(jest.fn().mockResolvedValue(loaded), transportManager)

    const load = loader.loadDriver('ya-modbus-driver-test', connection, 'device1')
    const loadResult = load.catch((error: unknown) => error)
    await slow.started

    const unload = loader.unloadDriver('device1')
    slow.finish()
    await unload

    // The remove returns after the port is released
    expect(transportManager.releaseTransport).toHaveBeenCalledWith(transport)
    expect(slow.driver.destroy).toHaveBeenCalled()
    expect(loader.getDriver('device1')).toBeUndefined()
    expect(await loadResult).toEqual(
      new Error('Device device1 was removed while its driver was loading')
    )
  })

  it('releases the transport when the load fails after the unload', async () => {
    const transportManager = createTransportManager()
    const slow = createSlowDriver()
    slow.driver.initialize = async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
      throw new Error('no answer')
    }
    const loaded: LoadedDriver = { createDriver: jest.fn().mockResolvedValue(slow.driver) }
    const loader = new DriverLoader(jest.fn().mockResolvedValue(loaded), transportManager)

    const load = loader.loadDriver('ya-modbus-driver-test', connection, 'device1')
    const loadResult = load.catch((error: unknown) => error)
    await Promise.resolve()

    await loader.unloadDriver('device1')

    expect(transportManager.releaseTransport).toHaveBeenCalledTimes(1)
    expect(await loadResult).toEqual(new Error('no answer'))
  })

  it('loads the device normally when it is not removed', async () => {
    const transportManager = createTransportManager()
    const slow = createSlowDriver()
    const loaded: LoadedDriver = { createDriver: jest.fn().mockResolvedValue(slow.driver) }
    const loader = new DriverLoader(jest.fn().mockResolvedValue(loaded), transportManager)

    const load = loader.loadDriver('ya-modbus-driver-test', connection, 'device1')
    await slow.started
    slow.finish()

    await expect(load).resolves.toBe(slow.driver)
    expect(loader.getDriver('device1')).toBe(slow.driver)
    expect(transportManager.releaseTransport).not.toHaveBeenCalled()

    // A later unload does not wait for the finished load
    await loader.unloadDriver('device1')
    expect(transportManager.releaseTransport).toHaveBeenCalledTimes(1)
  })
})
