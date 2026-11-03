import { EventEmitter } from 'events'

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import type { DeviceDriver } from '@ya-modbus/driver-types'
import mqtt from 'mqtt'

import type { DriverLoader } from './driver-loader.js'
import type { DeviceConfig, MqttBridge } from './types.js'

import { createBridge } from './index.js'

jest.mock('mqtt')

/**
 * A device that refuses one register block still publishes the other block, and its status
 * names the data points that failed. The real polling scheduler and device manager are used.
 */
describe('createBridge partial reads', () => {
  const INTERVAL = 1000

  let client: EventEmitter & {
    connected: boolean
    publish: jest.Mock<(topic: string, payload: string, opts: object, cb: () => void) => void>
  }
  let energyFails: boolean
  let bridge: MqttBridge

  // Block 1 holds voltage and current, block 2 holds energy. The device refuses block 2 while
  // energyFails is true.
  const driver: DeviceDriver = {
    name: 'test',
    manufacturer: 'Test',
    model: 'TEST-001',
    dataPoints: [
      ...['voltage', 'current', 'energy'].map((id) => ({
        id,
        type: 'float' as const,
        access: 'r' as const,
      })),
      { id: 'setpoint', type: 'float', access: 'rw' },
    ],
    readDataPoint: jest.fn<DeviceDriver['readDataPoint']>(),
    writeDataPoint: jest.fn<DeviceDriver['writeDataPoint']>(),
    readDataPoints: (ids) =>
      energyFails && ids.includes('energy')
        ? Promise.reject(Object.assign(new Error('Illegal data address'), { modbusCode: 2 }))
        : Promise.resolve(Object.fromEntries(ids.map((id) => [id, 1]))),
  }

  beforeEach(async () => {
    jest.useFakeTimers()
    energyFails = true
    client = Object.assign(new EventEmitter(), {
      connected: false,
      publish: jest.fn((_topic: string, _payload: string, _opts: object, cb: () => void) => cb()),
      subscribe: jest.fn(),
      unsubscribe: jest.fn((_topic: string, cb: () => void) => cb()),
      end: jest.fn((_force: boolean, _opts: object, cb: () => void) => cb()),
    })
    jest.mocked(mqtt.connect).mockReturnValue(client as unknown as mqtt.MqttClient)

    bridge = createBridge(
      { mqtt: { url: 'mqtt://localhost:1883' } },
      {
        driverLoader: {
          loadDriver: jest.fn(() => Promise.resolve()),
          unloadDriver: jest.fn(() => Promise.resolve()),
          getDriver: () => driver,
          getConnectionError: jest.fn(),
          closeAllTransports: jest.fn(() => Promise.resolve()),
        } as unknown as DriverLoader,
      }
    )
    const started = bridge.start()
    client.connected = true
    client.emit('connect')
    await started
  })

  const addMeter = (extra: Partial<DeviceConfig> = {}): Promise<void> =>
    bridge.addDevice({
      deviceId: 'meter',
      driver: 'ya-modbus-driver-test',
      connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
      polling: { interval: INTERVAL },
      ...extra,
    })

  afterEach(async () => {
    await bridge.stop()
    jest.useRealTimers()
  })

  const published = (topic: 'data' | 'status'): Record<string, unknown>[] =>
    client.publish.mock.calls
      .filter(([t]) => t === `modbus/meter/${topic}`)
      .map(([, payload]) => JSON.parse(payload) as Record<string, unknown>)

  it('should publish the block that works, and name the failed points in the status', async () => {
    await addMeter()
    await jest.advanceTimersByTimeAsync(INTERVAL)

    expect(published('data').map((m) => m['data'])).toEqual([
      { voltage: 1, current: 1, setpoint: 1 },
    ])
    expect(published('status')).toEqual([
      expect.objectContaining({ state: 'connected', failedDataPoints: ['energy'] }),
    ])
    expect(bridge.getDevice('meter')?.state).toBe('connected')
  })

  it('should publish the status only when the failed points change', async () => {
    await addMeter()
    await jest.advanceTimersByTimeAsync(INTERVAL * 2)
    expect(published('status')).toHaveLength(1)

    energyFails = false
    await jest.advanceTimersByTimeAsync(INTERVAL)

    const status = published('status')
    expect(status).toHaveLength(2)
    expect(status[1]).toEqual(expect.objectContaining({ state: 'connected' }))
    expect(status[1]).not.toHaveProperty('failedDataPoints')
    expect(published('data').at(-1)?.['data']).toEqual({
      voltage: 1,
      current: 1,
      energy: 1,
      setpoint: 1,
    })
  })

  it('should publish on change only, also while points fail, and always after a write', async () => {
    await addMeter({ publish: { mode: 'on-change' }, allowWrites: true })
    await jest.advanceTimersByTimeAsync(INTERVAL * 2)
    expect(published('data')).toHaveLength(1)

    client.emit('message', 'modbus/meter/set', Buffer.from('{"setpoint":1}'), { retain: false })
    await jest.advanceTimersByTimeAsync(0)

    expect(driver.writeDataPoint).toHaveBeenCalledWith('setpoint', 1)
    expect(published('data')).toHaveLength(2)
  })
})
