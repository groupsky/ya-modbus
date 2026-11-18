/**
 * The driver against an emulated OR-WE-526 over a real TCP connection: every data point is read.
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

/** Holding registers of a meter on a multi-tariff contract, with some reverse energy */
function meter(): Record<number, number> {
  const holding: Record<number, number> = {}
  const place = (start: number, words: number[]): void =>
    words.forEach((word, i) => {
      holding[start + i] = word & 0xffff
    })
  /** 32-bit values, high word first */
  const place32 = (start: number, values: number[]): void =>
    place(
      start,
      values.flatMap((v) => [v >>> 16, v])
    )

  // 231.456 V, 5.432 A, 1200 W, 1250 VA, -350 VAr, 50.0 Hz, power factor 0.960
  place32(0x100, [231456, 5432, 1200, 1250, -350])
  place(0x10a, [500, 960])
  // Energy in hundredths: forward, reverse and total active, each total + T1-T4
  place32(0x10e, [1234567, 1000000, 234567, 0, 0])
  place32(0x118, [5050, 5000, 50, 0, 0])
  place32(0x122, [1239617, 1005000, 234617, 0, 0])
  // Forward, reverse and total reactive
  place32(0x12c, [300000, 250000, 50000, 0, 0])
  place32(0x136, [1200, 1000, 200, 0, 0])
  place32(0x140, [301200, 251000, 50200, 0, 0])
  // Quadrants 1-4
  place32(0x14a, [290000, 240000, 50000, 0, 0])
  place32(0x154, [10000, 10000, 0, 0, 0])
  place32(0x15e, [700, 600, 100, 0, 0])
  place32(0x168, [500, 400, 100, 0, 0])
  // Resettable active and reactive energy
  place32(0x172, [4321, 1234])
  // Demand in tenths: active forward, max, reverse, max; 0x17E-0x17F not used
  place32(0x176, [11505, 72000, 0, 3000])
  place32(0x180, [2500, 15000, 100, 900])
  // Serial 202311300042, address 1, FW 103, HW 2, checksum 0x5a3c
  place(0x1000, [0x2023, 0x1130, 0x0042, 1, 103, 2, 0x5a3c])
  // Clock 2026-11-03 (Tuesday) 09:30:00, scrolling time 10 s
  place(0x1007, [0x0026, 0x1103, 0x0209, 0x3000, 10])
  // 9600, no parity, 1 stop bit, forward, interval, 15 min, display, password 0000
  place(0x100c, [6, 0, 1, 1, 0, 15, 0x0000, 0x01ff, 0x0000, 0x0000, 0])
  // Running time 8760, timing current 0.020 A
  place32(0x1018, [8760, 20])
  return holding
}

describe('driver with an emulated OR-WE-526', () => {
  let emulator: ModbusEmulator
  let driver: DeviceDriver
  let close: () => Promise<void>

  beforeEach(async () => {
    const port = await getFreePort()
    emulator = new ModbusEmulator({ transport: 'tcp', host: HOST, port })
    emulator.addDevice({ slaveId: 1, registers: { holding: meter() } })
    await emulator.start()

    const transport = await createTCPTransport({ host: HOST, port, slaveId: 1, timeout: 2000 })
    driver = await createDriver({ transport, slaveId: 1 })
    close = () => transport.close()
  })

  afterEach(async () => {
    await close()
    await emulator.stop()
  })

  it('reads every data point', async () => {
    const ids = driver.dataPoints.map((point) => point.id)

    expect(await driver.readDataPoints(ids)).toEqual({
      voltage: 231.456,
      current: 5.432,
      active_power: 1200,
      apparent_power: 1250,
      reactive_power: -350,
      frequency: 50,
      power_factor: 0.96,
      active_energy_forward: 12345.67,
      active_energy_forward_t1: 10000,
      active_energy_forward_t2: 2345.67,
      active_energy_forward_t3: 0,
      active_energy_forward_t4: 0,
      active_energy_reverse: 50.5,
      active_energy_reverse_t1: 50,
      active_energy_reverse_t2: 0.5,
      active_energy_reverse_t3: 0,
      active_energy_reverse_t4: 0,
      active_energy_total: 12396.17,
      active_energy_total_t1: 10050,
      active_energy_total_t2: 2346.17,
      active_energy_total_t3: 0,
      active_energy_total_t4: 0,
      reactive_energy_forward: 3000,
      reactive_energy_forward_t1: 2500,
      reactive_energy_forward_t2: 500,
      reactive_energy_forward_t3: 0,
      reactive_energy_forward_t4: 0,
      reactive_energy_reverse: 12,
      reactive_energy_reverse_t1: 10,
      reactive_energy_reverse_t2: 2,
      reactive_energy_reverse_t3: 0,
      reactive_energy_reverse_t4: 0,
      reactive_energy_total: 3012,
      reactive_energy_total_t1: 2510,
      reactive_energy_total_t2: 502,
      reactive_energy_total_t3: 0,
      reactive_energy_total_t4: 0,
      reactive_energy_q1: 2900,
      reactive_energy_q1_t1: 2400,
      reactive_energy_q1_t2: 500,
      reactive_energy_q1_t3: 0,
      reactive_energy_q1_t4: 0,
      reactive_energy_q2: 100,
      reactive_energy_q2_t1: 100,
      reactive_energy_q2_t2: 0,
      reactive_energy_q2_t3: 0,
      reactive_energy_q2_t4: 0,
      reactive_energy_q3: 7,
      reactive_energy_q3_t1: 6,
      reactive_energy_q3_t2: 1,
      reactive_energy_q3_t3: 0,
      reactive_energy_q3_t4: 0,
      reactive_energy_q4: 5,
      reactive_energy_q4_t1: 4,
      reactive_energy_q4_t2: 1,
      reactive_energy_q4_t3: 0,
      reactive_energy_q4_t4: 0,
      active_energy_resettable: 43.21,
      reactive_energy_resettable: 12.34,
      active_power_demand_forward: 1150.5,
      active_power_demand_forward_max: 7200,
      active_power_demand_reverse: 0,
      active_power_demand_reverse_max: 300,
      reactive_power_demand_forward: 250,
      reactive_power_demand_forward_max: 1500,
      reactive_power_demand_reverse: 10,
      reactive_power_demand_reverse_max: 90,
      serial_number: '202311300042',
      device_address: 1,
      software_version: 103,
      hardware_version: 2,
      firmware_checksum: 0x5a3c,
      clock: '2026-11-03T09:30:00',
      scroll_time: 10,
      baud_rate: 9600,
      parity: 'none',
      stop_bits: 1,
      combined_code: 'forward',
      demand_mode: 'interval',
      demand_cycle: 15,
      display_mode: '000001ff00000000',
      password: '0000',
      running_time: 8760,
      startup_current: 0.02,
    })
  })

  it('reads each data point alone to the same value as in the full read', async () => {
    const ids = driver.dataPoints.map((point) => point.id)
    const all = await driver.readDataPoints(ids)

    for (const id of ids) {
      expect({ [id]: await driver.readDataPoint(id) }).toEqual({ [id]: all[id] })
    }
  })

  it('writes nothing to the meter', async () => {
    await expect(driver.writeDataPoint('scroll_time', 5)).rejects.toThrow('read-only')

    expect(emulator.getDevice(1)?.getHoldingRegister(0x100b)).toBe(10)
    expect(emulator.getDevice(1)?.getHoldingRegister(0x100c)).toBe(6)
  })
})
