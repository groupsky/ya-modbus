/**
 * A USB serial adapter is unplugged while the bridge polls a device, or is missing when the
 * bridge starts, and is plugged in again.
 *
 * Uses the real DriverLoader and TransportManager. Only modbus-serial is replaced by
 * clients that emit the same 'error' event as a real client when the adapter is gone.
 */

import { EventEmitter } from 'node:events'

import { jest } from '@jest/globals'
import type { DeviceDriver, DriverConfig } from '@ya-modbus/driver-types'
import { TransportManager } from '@ya-modbus/transport'

import { DriverLoader } from './driver-loader.js'
import type { DeviceConfig } from './types.js'
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

/** Device that reads one holding register over the serial port `port` */
function meter(deviceId: string, port: string): DeviceConfig {
  return {
    deviceId,
    driver: 'ya-modbus-driver-test',
    connection: {
      type: 'rtu',
      port,
      baudRate: 9600,
      parity: 'none',
      dataBits: 8,
      stopBits: 1,
      slaveId: 1,
    },
    polling: { interval: 100, maxRetries: 2, retryBackoff: 100 },
  }
}

describe('serial adapter that is gone', () => {
  let broker: TestBroker
  let now: number
  // Ports of the adapters that are not plugged in
  let unplugged: Set<string>
  let clients: EventEmitter[]

  beforeEach(async () => {
    broker = await startTestBroker()
    now = performance.now()
    jest.spyOn(performance, 'now').mockImplementation(() => now)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    unplugged = new Set()
    clients = []

    jest.requireMock<jest.Mock>('modbus-serial').mockImplementation(() => {
      const client = Object.assign(new EventEmitter(), {
        isOpen: true,
        connectRTUBuffered: jest.fn((port: string) =>
          unplugged.has(port)
            ? Promise.reject(new Error(`Error: No such file or directory, cannot open ${port}`))
            : Promise.resolve()
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
      await bridge.addDevice(meter('meter', '/dev/ttyUSB0'))
      await firstData

      // Unplug: modbus-serial emits a SerialPortError, which crashes the process without a listener
      unplugged.add('/dev/ttyUSB0')
      const failedPolls = waitForEvents('failed', 3)
      clients[0]?.emit('error', {
        name: 'SerialPortError',
        message: 'EIO: i/o error, write',
        errno: 'ECONNREFUSED',
      })
      await failedPolls

      expect(bridge.getDevice('meter')).toMatchObject({
        consecutiveFailures: expect.any(Number),
        errors: [
          'Connection to /dev/ttyUSB0 lost: EIO: i/o error, write (/dev/ttyUSB0 9600 8N1, slave 1, FC03 read holding registers, address 0 (0x0000), count 1)',
        ],
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
        'Connection to /dev/ttyUSB0 lost: Error: No such file or directory, cannot open /dev/ttyUSB0 (/dev/ttyUSB0 9600 8N1, slave 1, FC03 read holding registers, address 0 (0x0000), count 1)',
      ])

      // Plug in again: after the doubled backoff the next poll reopens the port and reads
      unplugged.delete('/dev/ttyUSB0')
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

  // One missing adapter out of several must not stop the bridge (it ran on 6 adapters)
  test('starts with an adapter missing, polls the other devices and reads it after it is plugged in', async () => {
    const loadDriver = jest.fn(() => Promise.resolve({ createDriver }))
    // The default TransportManager of the bridge
    const bridge = createBridge(createTestBridgeConfig(broker), {
      driverLoader: new DriverLoader(loadDriver),
    })
    await bridge.start()
    unplugged.add('/dev/ttyUSB1')
    const missing =
      'Could not open /dev/ttyUSB1: Error: No such file or directory, cannot open /dev/ttyUSB1'
    // Two devices on the missing adapter, and one on another adapter
    const missing1 = meter('missing1', '/dev/ttyUSB1')
    const missing2 = {
      ...meter('missing2', '/dev/ttyUSB1'),
      connection: { ...missing1.connection, slaveId: 2 },
    }

    try {
      const errorStatus1 = waitForPublish(broker, 'modbus/missing1/status', 2000)
      const errorStatus2 = waitForPublish(broker, 'modbus/missing2/status', 2000)
      const otherData = waitForPublish(broker, 'modbus/other/data', 2000)
      await bridge.addDevice(missing1)
      await bridge.addDevice(missing2)
      await bridge.addDevice(meter('other', '/dev/ttyUSB0'))

      for (const status of [errorStatus1, errorStatus2]) {
        expect(JSON.parse((await status).payload.toString())).toMatchObject({
          state: 'error',
          errors: [missing],
        })
      }
      expect(console.warn).toHaveBeenCalledWith(
        `Device missing1 is not connected, the bridge keeps trying to open its port: ${missing}`
      )
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Device missing2'))
      await otherData
      expect(bridge.getDevice('missing1')).toMatchObject({ state: 'error' })
      expect(bridge.getDevice('missing2')).toMatchObject({ state: 'error' })
      expect(bridge.getDevice('other')).toMatchObject({ state: 'connected' })

      // Plug in: after the backoff the next poll opens the port, and both devices read
      unplugged.delete('/dev/ttyUSB1')
      const connectedStatus = waitForPublish(broker, 'modbus/missing1/status', 3000)
      const recovered1 = waitForPublish(broker, 'modbus/missing1/data', 3000)
      const recovered2 = waitForPublish(broker, 'modbus/missing2/data', 3000)
      now += 1000

      for (const data of [recovered1, recovered2]) {
        expect(JSON.parse((await data).payload.toString())).toMatchObject({ data: { value: 42 } })
      }
      expect(JSON.parse((await connectedStatus).payload.toString())).toMatchObject({
        state: 'connected',
      })
      expect(bridge.getDevice('missing2')).toMatchObject({ state: 'connected' })
      // Logged once per device, not on every later successful read
      const recoveries = (console.log as jest.Mock).mock.calls
        .map(([line]) => String(line))
        .filter((line) => line.startsWith('Device missing1 recovered'))
      expect(recoveries).toHaveLength(1)
    } finally {
      await bridge.stop()
    }
  })
})
