import { EventEmitter } from 'events'

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import type { DeviceDriver } from '@ya-modbus/driver-types'
import mqtt from 'mqtt'

import type { DeviceManager } from './device-manager.js'
import type { DriverLoader } from './driver-loader.js'
import type { DeviceConfig } from './types.js'

import { createBridge } from './index.js'

jest.mock('mqtt')

const mockedMqtt = mqtt as jest.Mocked<typeof mqtt>

/**
 * The bridge starts its polling scheduler on every MQTT connect event, which includes every
 * reconnect. The real scheduler is used here because a reconnect must not add poll chains.
 */
describe('createBridge MQTT reconnect', () => {
  const INTERVAL = 1000

  const deviceConfig: DeviceConfig = {
    deviceId: 'device1',
    driver: 'ya-modbus-driver-test',
    connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
    polling: { interval: INTERVAL },
  }

  let client: EventEmitter & { connected: boolean }
  let readDataPoints: jest.Mock<DeviceDriver['readDataPoints']>

  beforeEach(() => {
    jest.useFakeTimers()

    client = Object.assign(new EventEmitter(), {
      connected: false,
      end: jest.fn((_force: boolean, _opts: object, cb?: () => void) => cb?.()),
      publish: jest.fn((_topic: string, _payload: unknown, _opts: object, cb?: () => void) =>
        cb?.()
      ),
      subscribe: jest.fn(),
    })
    mockedMqtt.connect.mockReturnValue(client as unknown as mqtt.MqttClient)

    readDataPoints = jest.fn<DeviceDriver['readDataPoints']>().mockResolvedValue({ temp: 25.5 })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const connect = (): void => {
    client.connected = true
    client.emit('connect')
  }

  const startBridgeWithDevice = async (): Promise<ReturnType<typeof createBridge>> => {
    const driver: DeviceDriver = {
      name: 'test',
      manufacturer: 'Test',
      model: 'TEST-001',
      dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
      readDataPoint: jest.fn(),
      writeDataPoint: jest.fn(),
      readDataPoints,
    }

    const bridge = createBridge(
      { mqtt: { url: 'mqtt://localhost:1883' } },
      {
        driverLoader: {
          getDriver: jest.fn().mockReturnValue(driver),
          getConnectionError: jest.fn(),
          closeAllTransports: jest.fn(),
        } as unknown as DriverLoader,
        deviceManager: {
          addDevice: jest.fn(),
          updateDeviceState: jest.fn(),
          clear: jest.fn(),
        } as unknown as DeviceManager,
      }
    )

    const startPromise = bridge.start()
    connect()
    await startPromise
    await bridge.addDevice(deviceConfig)

    return bridge
  }

  it('should poll a device once per interval after MQTT reconnects', async () => {
    const bridge = await startBridgeWithDevice()

    client.emit('offline')
    client.emit('reconnect')
    connect()
    client.emit('offline')
    client.emit('reconnect')
    connect()

    await jest.advanceTimersByTimeAsync(INTERVAL)
    expect(readDataPoints).toHaveBeenCalledTimes(1)

    await jest.advanceTimersByTimeAsync(INTERVAL)
    expect(readDataPoints).toHaveBeenCalledTimes(2)

    await bridge.stop()
  })

  it('should keep polling a device once per interval when MQTT reconnects between polls', async () => {
    const bridge = await startBridgeWithDevice()

    await jest.advanceTimersByTimeAsync(INTERVAL)
    expect(readDataPoints).toHaveBeenCalledTimes(1)

    connect()

    await jest.advanceTimersByTimeAsync(INTERVAL)
    expect(readDataPoints).toHaveBeenCalledTimes(2)

    await bridge.stop()
  })
})
