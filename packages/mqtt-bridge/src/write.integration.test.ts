/**
 * A write message writes a register of an emulated device, and the bridge reads the device at
 * once and publishes the new value.
 *
 * Uses the real DriverLoader, TransportManager and modbus-serial, over TCP to the emulator.
 */

import { createServer, type AddressInfo } from 'node:net'

import { jest } from '@jest/globals'
import type { DeviceDriver, DriverConfig } from '@ya-modbus/driver-types'
import { ModbusEmulator } from '@ya-modbus/emulator'
import mqtt from 'mqtt'

import { DriverLoader } from './driver-loader.js'
import type { MqttBridge } from './types.js'
import {
  createTestBridgeConfig,
  startTestBroker,
  waitForPublish,
  waitForSubscribe,
  type TestBroker,
} from './utils/test-utils.js'

import { createBridge } from './index.js'

const HOST = '127.0.0.1'

/** A free TCP port. The emulator takes port 0 as 502. */
const getFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, HOST, () => {
      const { port } = probe.address() as AddressInfo
      probe.close((err) => (err ? reject(err) : resolve(port)))
    })
  })

/** Driver of a thermostat whose setpoint is holding register 0 */
function createDriver({ transport }: DriverConfig): Promise<DeviceDriver> {
  const readSetpoint = async (): Promise<number> =>
    (await transport.readHoldingRegisters(0, 1)).readUInt16BE(0)

  return Promise.resolve({
    name: 'thermostat',
    manufacturer: 'Test',
    model: 'TEST',
    dataPoints: [{ id: 'setpoint', name: 'Setpoint', type: 'integer', access: 'rw' }],
    readDataPoint: readSetpoint,
    writeDataPoint: (_id: string, value: unknown) =>
      transport.writeSingleRegister(0, value as number),
    readDataPoints: async () => ({ setpoint: await readSetpoint() }),
  })
}

describe('write message to an emulated device', () => {
  let broker: TestBroker
  let emulator: ModbusEmulator
  let bridge: MqttBridge

  beforeEach(async () => {
    broker = await startTestBroker()
    const port = await getFreePort()
    emulator = new ModbusEmulator({ transport: 'tcp', host: HOST, port })
    emulator.addDevice({ slaveId: 1, registers: { holding: { 0: 20 } } })
    await emulator.start()

    const loadDriver = jest.fn(() => Promise.resolve({ createDriver }))
    bridge = createBridge(createTestBridgeConfig(broker), {
      driverLoader: new DriverLoader(loadDriver),
    })
    await bridge.start()

    const subscribed = waitForSubscribe(broker, 'modbus/thermostat/set')
    await bridge.addDevice({
      deviceId: 'thermostat',
      driver: 'ya-modbus-driver-test',
      connection: { type: 'tcp', host: HOST, port, slaveId: 1 },
      // No poll during the test, so the data message comes from the read after the write
      polling: { interval: 3600000 },
      allowWrites: true,
    })
    await subscribed
  })

  afterEach(async () => {
    await bridge.stop()
    await emulator.stop()
    await broker.close()
  })

  it('writes the point, then publishes the new value and an ok result', async () => {
    const messages = Promise.all([
      waitForPublish(broker, 'modbus/thermostat/data', 2000),
      waitForPublish(broker, 'modbus/thermostat/set/result', 2000),
    ])

    const sender = await mqtt.connectAsync(broker.url)
    await sender.publishAsync('modbus/thermostat/set', JSON.stringify({ setpoint: 23 }))
    await sender.endAsync()

    const [data, result] = await messages
    expect(JSON.parse(data.payload.toString())).toMatchObject({
      deviceId: 'thermostat',
      data: { setpoint: 23 },
    })
    expect(JSON.parse(result.payload.toString())).toMatchObject({
      deviceId: 'thermostat',
      ok: true,
      values: { setpoint: 23 },
    })
  })
})
