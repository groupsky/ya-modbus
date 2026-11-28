/**
 * The driver against an emulated MBSL32DI over a real TCP connection: every data point is
 * read, and no write reaches the module.
 */

import { createServer, type AddressInfo } from 'node:net'

import type { DeviceDriver } from '@ya-modbus/driver-types'
import { ModbusEmulator } from '@ya-modbus/emulator'
import { createTCPTransport } from '@ya-modbus/transport'

import { createDriver } from './index.js'

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

const INPUT_IDS = Array.from({ length: 32 }, (_, i) => `input_${i + 1}`)

/** A module with inputs 3, 17 and 32 on */
const REGISTERS = {
  holding: {
    0x0000: 0x0004,
    0x0001: 0x8001,
  },
}

describe('driver with an emulated MBSL32DI', () => {
  let emulator: ModbusEmulator
  let driver: DeviceDriver
  let close: () => Promise<void>

  beforeEach(async () => {
    const port = await getFreePort()
    emulator = new ModbusEmulator({ transport: 'tcp', host: HOST, port })
    emulator.addDevice({ slaveId: 2, registers: REGISTERS })
    await emulator.start()

    const transport = await createTCPTransport({ host: HOST, port, slaveId: 2, timeout: 2000 })
    driver = await createDriver({ transport, slaveId: 2 })
    close = () => transport.close()
  })

  afterEach(async () => {
    await close()
    await emulator.stop()
  })

  it('reads every data point', async () => {
    const ids = driver.dataPoints.map((point) => point.id)

    expect(await driver.readDataPoints(ids)).toEqual({
      inputs: 0x80010004,
      ...Object.fromEntries(INPUT_IDS.map((id) => [id, false])),
      input_3: true,
      input_17: true,
      input_32: true,
    })
  })

  it('reads each data point alone to the same value as in the full read', async () => {
    const ids = driver.dataPoints.map((point) => point.id)
    const all = await driver.readDataPoints(ids)

    for (const id of ids) {
      expect({ [id]: await driver.readDataPoint(id) }).toEqual({ [id]: all[id] })
    }
  })

  it('writes nothing', async () => {
    await expect(driver.writeDataPoint('inputs', 0)).rejects.toThrow('read-only')
    await expect(driver.writeDataPoint('input_3', false)).rejects.toThrow('read-only')

    expect(emulator.getDevice(2)?.getHoldingRegister(0x0000)).toBe(0x0004)
    expect(emulator.getDevice(2)?.getHoldingRegister(0x0001)).toBe(0x8001)
  })
})
