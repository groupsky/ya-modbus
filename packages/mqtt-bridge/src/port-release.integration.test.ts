/**
 * A device is removed from the bridge, and the serial port closes when no other device uses it.
 *
 * Uses the real DriverLoader and TransportManager. Only modbus-serial is replaced by clients
 * that lock their serial port while it is open, like a real serial port: a second client
 * cannot open a locked port, also not with other serial settings.
 */

import { EventEmitter } from 'node:events'

import { jest } from '@jest/globals'
import type { DeviceDriver, DriverConfig } from '@ya-modbus/driver-types'

import { DriverLoader } from './driver-loader.js'
import type { DeviceConfig } from './types.js'
import {
  createTestBridgeConfig,
  startTestBroker,
  waitForPublish,
  type TestBroker,
} from './utils/test-utils.js'

import { createBridge, type MqttBridge } from './index.js'

jest.mock('modbus-serial')

const PORT = '/dev/ttyUSB0'

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
    readDataPoints: async () => ({ value: await readValue() }),
  })
}

/** Device on PORT that reads one holding register */
function meter(
  deviceId: string,
  connection: { baudRate?: number; slaveId?: number }
): DeviceConfig {
  return {
    deviceId,
    driver: 'ya-modbus-driver-test',
    connection: {
      type: 'rtu',
      port: PORT,
      baudRate: connection.baudRate ?? 9600,
      parity: 'none',
      dataBits: 8,
      stopBits: 1,
      slaveId: connection.slaveId ?? 1,
    },
    polling: { interval: 100 },
  }
}

describe('serial port of a removed device', () => {
  let broker: TestBroker
  let bridge: MqttBridge
  // Serial ports that an open client has locked
  let locked: Set<string>

  beforeEach(async () => {
    broker = await startTestBroker()
    locked = new Set()
    // The bridge warns about a port that it cannot open
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    jest.requireMock<jest.Mock>('modbus-serial').mockImplementation(() => {
      let lockedPort: string | undefined
      const client = Object.assign(new EventEmitter(), {
        isOpen: false,
        connectRTUBuffered: jest.fn((port: string) => {
          if (locked.has(port)) {
            return Promise.reject(
              new Error('Error Resource temporarily unavailable Cannot lock port')
            )
          }
          locked.add(port)
          lockedPort = port
          client.isOpen = true
          return Promise.resolve()
        }),
        setID: jest.fn(),
        setTimeout: jest.fn(),
        close: jest.fn((callback: () => void) => {
          if (lockedPort !== undefined) locked.delete(lockedPort)
          client.isOpen = false
          callback()
        }),
        readHoldingRegisters: jest.fn(() =>
          Promise.resolve({ data: [42], buffer: Buffer.from([0, 42]) })
        ),
      })
      return client
    })

    const loadDriver = jest.fn(() => Promise.resolve({ createDriver }))
    // The default TransportManager of the bridge
    bridge = createBridge(createTestBridgeConfig(broker), {
      driverLoader: new DriverLoader(loadDriver),
    })
    await bridge.start()
  })

  afterEach(async () => {
    await bridge.stop()
    jest.restoreAllMocks()
    await broker.close()
  })

  // The port stayed open and locked until the bridge stopped
  test('is free for the device when it is added again with other serial settings', async () => {
    const firstData = waitForPublish(broker, 'modbus/meter/data', 2000)
    await bridge.addDevice(meter('meter', { baudRate: 9600 }))
    await firstData

    await bridge.removeDevice('meter')
    expect(locked.has(PORT)).toBe(false)

    const data = waitForPublish(broker, 'modbus/meter/data', 2000)
    await bridge.addDevice(meter('meter', { baudRate: 19200 }))

    expect(bridge.getDevice('meter')).toMatchObject({ state: 'connected' })
    expect(JSON.parse((await data).payload.toString())).toMatchObject({ data: { value: 42 } })
  })

  test('stays open while another device on the bus uses it', async () => {
    await bridge.addDevice(meter('first', { slaveId: 1 }))
    await bridge.addDevice(meter('second', { slaveId: 2 }))

    await bridge.removeDevice('first')

    const data = waitForPublish(broker, 'modbus/second/data', 2000)
    expect(JSON.parse((await data).payload.toString())).toMatchObject({ data: { value: 42 } })
    expect(locked.has(PORT)).toBe(true)

    await bridge.removeDevice('second')
    expect(locked.has(PORT)).toBe(false)
  })
})
