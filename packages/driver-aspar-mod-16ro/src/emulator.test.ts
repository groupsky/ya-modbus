/**
 * The driver against an emulated MOD-16RO over a real TCP connection: every data point is
 * read, and every output is written.
 *
 * The emulator keeps holding registers (FC 03), input registers (FC 04) and coils apart. A real
 * module shows a written coil 0x330 + n in bit n of register 0x33; the emulator does not, so the
 * write tests check the coils.
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

const OUTPUT_IDS = Array.from({ length: 16 }, (_, i) => `output_${i + 1}`)

/** A module on a 115200 8E1 bus, firmware 1.1, with outputs 4 and 15 on */
const REGISTERS = {
  holding: {
    0x00: 0x0b07,
    0x01: 0x0002,
  },
  input: {
    0x02: 6,
    0x03: 0x0801,
    0x04: 2,
    0x05: 0,
    0x06: 0,
    0x08: 0,
    0x0c: 0,
    0x20: 0x86a0,
    0x21: 0x0001, // 100000
    0x22: 12,
    0x23: 0,
    0x24: 0x869f,
    0x25: 0x0001, // 99999
    0x33: 0x4008,
  },
}

describe('driver with an emulated MOD-16RO', () => {
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
      firmware_version: 1.1,
      module_type: 7,
      switches: 2,
      baud_rate: 115200,
      data_bits: 8,
      stop_bits: 1,
      parity: 'even',
      response_delay_ms: 0,
      modbus_mode: 'RTU',
      watchdog_ms: 0,
      default_output_state: 0,
      received_packets: 100000,
      incorrect_packets: 12,
      sent_packets: 99999,
      outputs: 0x4008,
      ...Object.fromEntries(OUTPUT_IDS.map((id) => [id, false])),
      output_4: true,
      output_15: true,
    })
  })

  it('reads each data point alone to the same value as in the full read', async () => {
    const ids = driver.dataPoints.map((point) => point.id)
    const all = await driver.readDataPoints(ids)

    for (const id of ids) {
      expect({ [id]: await driver.readDataPoint(id) }).toEqual({ [id]: all[id] })
    }
  })

  it.each(OUTPUT_IDS.map((id, bit) => [id, 0x330 + bit]))(
    'switches %s on and off with coil %d',
    async (id, coil) => {
      const device = emulator.getDevice(2)

      await driver.writeDataPoint(id, true)
      expect(device?.getCoil(coil)).toBe(true)

      await driver.writeDataPoint(id, false)
      expect(device?.getCoil(coil)).toBe(false)
    }
  )

  it('writes one output and leaves the other outputs alone', async () => {
    const device = emulator.getDevice(2)

    await driver.writeDataPoint('output_16', true)

    const on = Array.from({ length: 16 }, (_, bit) => 0x330 + bit).filter((coil) =>
      device?.getCoil(coil)
    )
    expect(on).toEqual([0x33f])
  })

  it('writes nothing for a read-only data point', async () => {
    await expect(driver.writeDataPoint('outputs', 0xffff)).rejects.toThrow('read-only')

    expect(emulator.getDevice(2)?.getInputRegister(0x33)).toBe(0x4008)
    expect(emulator.getDevice(2)?.getHoldingRegister(0x33)).toBe(0)
  })
})
