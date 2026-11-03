/**
 * The driver reads every data point from an emulated inverter over Modbus TCP.
 *
 * Uses the real TCP transport and modbus-serial, against the emulator.
 */

import { createServer, type AddressInfo } from 'node:net'

import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'
import { ModbusEmulator } from '@ya-modbus/emulator'
import { createTCPTransport } from '@ya-modbus/transport'

import { createDriver, DEFAULT_CONFIG } from './index'

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

/** Holding registers of the emulated inverter: one 16-bit value per register */
const REGISTERS: Record<number, number> = {
  // active power -1.5 kW (I32 -1500)
  32080: 0xffff,
  32081: 0xfa24,
  // reactive power 0.25 kVAr (I32 250)
  32082: 0x0000,
  32083: 0x00fa,
  // power factor -0.95 (I16 -950)
  32084: 0xfc4a,
  // grid frequency 49.98 Hz
  32085: 4998,
  // efficiency 98.5 %
  32086: 9850,
  // internal temperature -5.2 °C (I16 -52)
  32087: 0xffcc,
  // insulation resistance 2.5 MΩ
  32088: 2500,
  // total energy yield 21474836.49 kWh (U32 2147483649, above 2^31)
  32106: 0x8000,
  32107: 0x0001,
  // daily energy yield 12.34 kWh (U32 1234)
  32114: 0x0000,
  32115: 1234,
}

const EXPECTED: Record<string, number> = {
  active_power: -1.5,
  reactive_power: 0.25,
  power_factor: -0.95,
  grid_frequency: 49.98,
  efficiency: 98.5,
  internal_temperature: -5.2,
  insulation_resistance: 2.5,
  total_energy_yield: 21474836.49,
  daily_energy_yield: 12.34,
}

describe('SUN2000 driver against the emulator', () => {
  let emulator: ModbusEmulator
  let transport: Transport
  let driver: DeviceDriver

  beforeEach(async () => {
    const port = await getFreePort()
    emulator = new ModbusEmulator({ transport: 'tcp', host: HOST, port })
    emulator.addDevice({
      slaveId: DEFAULT_CONFIG.defaultAddress,
      registers: { holding: REGISTERS },
    })
    await emulator.start()

    transport = await createTCPTransport({
      host: HOST,
      port,
      slaveId: DEFAULT_CONFIG.defaultAddress,
      maxRetries: 1,
    })
    driver = await createDriver({ transport, slaveId: DEFAULT_CONFIG.defaultAddress })
  })

  afterEach(async () => {
    await transport.close()
    await emulator.stop()
  })

  it('reads every data point in one poll', async () => {
    const ids = driver.dataPoints.map((dp) => dp.id)
    expect(ids.sort()).toEqual(Object.keys(EXPECTED).sort())

    const values = await driver.readDataPoints(ids)

    for (const [id, value] of Object.entries(EXPECTED)) {
      expect(values[id]).toBeCloseTo(value, 2)
    }
  })

  it.each(Object.entries(EXPECTED))('reads %s alone', async (id, value) => {
    expect(await driver.readDataPoint(id)).toBeCloseTo(value, 2)
  })
})
