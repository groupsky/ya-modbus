/**
 * A USB serial adapter is unplugged while the bridge polls a device, and plugged in again.
 *
 * Uses the real DriverLoader and TransportManager. Only modbus-serial is replaced by
 * clients that emit the same 'error' event as a real client when the adapter is gone.
 */

import { EventEmitter } from 'node:events'

import { jest } from '@jest/globals'
import type { DeviceDriver, DriverConfig } from '@ya-modbus/driver-types'
import { TransportManager } from '@ya-modbus/transport'

import { DriverLoader } from './driver-loader.js'
import {
  createTestBridgeConfig,
  startTestBroker,
  waitForPublish,
  withTimeout,
  type TestBroker,
} from './utils/test-utils.js'

import { createBridge } from './index.js'

jest.mock('modbus-serial')

/** Test signals: 'client' when a modbus-serial client is created, 'failed' after a failed poll */
const events = new EventEmitter()

/** Wait until an event was emitted `count` times */
function waitForEvents(event: string, count: number): Promise<void> {
  let seen = 0
  let listener: (() => void) | undefined
  const promise = new Promise<void>((resolve) => {
    listener = () => {
      seen++
      if (seen >= count) resolve()
    }
    events.on(event, listener)
  })
  return withTimeout(promise, 5000, () => `Saw ${seen} of ${count} '${event}' events`).finally(
    () => {
      if (listener) events.off(event, listener)
    }
  )
}

/** Driver that reads one holding register */
function createDriver({ transport }: DriverConfig): Promise<DeviceDriver> {
  const readValue = async (): Promise<number> =>
    (await transport.readHoldingRegisters(0, 1)).readUInt16BE(0)

  return Promise.resolve({
    name: 'meter',
    manufacturer: 'Test',
    model: 'TEST',
    dataPoints: [{ id: 'value', name: 'Value', type: 'integer' }],
    readDataPoint: readValue,
    writeDataPoint: () => Promise.reject(new Error('read only')),
    readDataPoints: async () => {
      try {
        return { value: await readValue() }
      } catch (error) {
        events.emit('failed')
        throw error
      }
    },
  })
}

describe('serial adapter unplugged while the bridge polls a device', () => {
  let broker: TestBroker
  let now: number
  let pluggedIn: boolean
  let clients: EventEmitter[]

  beforeEach(async () => {
    broker = await startTestBroker()
    now = performance.now()
    jest.spyOn(performance, 'now').mockImplementation(() => now)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    pluggedIn = true
    clients = []

    jest.requireMock<jest.Mock>('modbus-serial').mockImplementation(() => {
      const client = Object.assign(new EventEmitter(), {
        isOpen: true,
        connectRTUBuffered: jest.fn(() =>
          pluggedIn
            ? Promise.resolve()
            : Promise.reject(
                new Error('Error: No such file or directory, cannot open /dev/ttyUSB0')
              )
        ),
        setID: jest.fn(),
        setTimeout: jest.fn(),
        close: jest.fn((callback: () => void) => callback()),
        readHoldingRegisters: jest.fn(() =>
          Promise.resolve({ data: [42], buffer: Buffer.from([0, 42]) })
        ),
      })
      clients.push(client)
      events.emit('client')
      return client
    })
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await broker.close()
  })

  test('reports polling errors while the port is gone and reads again after it is back', async () => {
    const loadDriver = jest.fn(() => Promise.resolve({ createDriver }))
    const driverLoader = new DriverLoader(loadDriver, new TransportManager())
    const bridge = createBridge(createTestBridgeConfig(broker), { driverLoader })
    await bridge.start()

    try {
      const firstData = waitForPublish(broker, 'modbus/meter/data', 2000)
      await bridge.addDevice({
        deviceId: 'meter',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          parity: 'none',
          dataBits: 8,
          stopBits: 1,
          slaveId: 1,
        },
        polling: { interval: 100, maxRetries: 2, retryBackoff: 100 },
      })
      await firstData

      // Unplug: modbus-serial emits a SerialPortError, which crashes the process without a listener
      pluggedIn = false
      const failedPolls = waitForEvents('failed', 3)
      clients[0]?.emit('error', {
        name: 'SerialPortError',
        message: 'EIO: i/o error, write',
        errno: 'ECONNREFUSED',
      })
      await failedPolls

      expect(bridge.getDevice('meter')).toMatchObject({
        consecutiveFailures: expect.any(Number),
        errors: ['Connection to /dev/ttyUSB0 lost: EIO: i/o error, write'],
      })
      expect(bridge.getDevice('meter')?.consecutiveFailures).toBeGreaterThanOrEqual(2)
      // Polling goes on, but the port is not reopened before the backoff
      expect(clients).toHaveLength(1)

      // After the backoff the next poll tries to reopen the port, which is still gone
      const reopenAttempt = waitForEvents('client', 1)
      // The poll that tries to reopen, and one more, so the device status shows the first one
      const failedAfterReopen = waitForEvents('failed', 2)
      now += 1000
      await reopenAttempt
      await failedAfterReopen
      expect(bridge.getDevice('meter')?.errors).toEqual([
        'Connection to /dev/ttyUSB0 lost: Error: No such file or directory, cannot open /dev/ttyUSB0',
      ])

      // Plug in again: after the doubled backoff the next poll reopens the port and reads
      pluggedIn = true
      const recovered = waitForPublish(broker, 'modbus/meter/data', 3000)
      now += 2000
      const { payload } = await recovered

      expect(JSON.parse(payload.toString())).toMatchObject({ data: { value: 42 } })
      expect(bridge.getDevice('meter')?.consecutiveFailures).toBe(0)
      expect(clients).toHaveLength(3)
    } finally {
      await bridge.stop()
    }
  })
})
