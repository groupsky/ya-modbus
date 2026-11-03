/**
 * The driver against an emulated SR04 over a real TCP connection: every data point is read, and
 * the clock is written and read back.
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

const word = (value: number): number => value & 0xffff

/** Registers and coils of a controller with scheme 2, one collector and 4 sensors */
function controller(): { holding: Record<number, number>; coils: Record<number, boolean> } {
  const holding: Record<number, number> = {}
  const place = (start: number, values: number[]): void =>
    values.forEach((value, i) => {
      holding[start + i] = value
    })

  // Calibration (0, 2, 4, 6), filter, ADC jump, jump time (12-14)
  place(0, [47, 0, 160, 0, 106, 0, 556])
  place(12, [5, 20, 15])
  // Heater windows (15-20), set points and limits (21-27), hysteresis in tenths (28-30)
  place(15, [5, 24, 24, 24, 24, 24])
  place(21, [80, 90, 110, 30, word(-20), 5, 10, 30, 25, 35])
  // SP T5, SP T7, min T8, max T8, freeze T8, scheme (31-36)
  place(31, [80, 35, 50, 110, 1, 2])
  // Kick off, kick on, kick pause, kick time, time 0.5 C, heat SP (38-43), trial time, D point
  place(38, [20, 8, 30, 3, 60, 40])
  holding[45] = 250
  holding[48] = 1
  holding[127] = 1
  // Sensor error (high byte is not used), ADC2, ADC3, T1-T8
  place(557, [0xff00, word(-12), 345, 523, 547, 2070, 2070, 2070, 2070, 2070, word(-15)])
  // Clock: Tue 2026-10-20 14:28:59, low byte of 1027 = 0x5a
  place(1024, [0x5928, 0x1403, 0x2010, 0x265a])

  return {
    holding,
    coils: {
      296: true, // boiler low
      302: true, // sensor type
      353: true, // summer / winter
      1003: true, // no broadcast
      2865: true, // fast
      2896: true, // P1
      2901: true, // P6
    },
  }
}

describe('driver with an emulated SR04', () => {
  let emulator: ModbusEmulator
  let driver: DeviceDriver
  let close: () => Promise<void>

  beforeEach(async () => {
    const port = await getFreePort()
    emulator = new ModbusEmulator({ transport: 'tcp', host: HOST, port })
    emulator.addDevice({ slaveId: 1, registers: controller() })
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
      boiler_low_enabled: true,
      solar2_enabled: false,
      storage_tank_enabled: false,
      heating_enabled: false,
      pool_enabled: false,
      stove_enabled: false,
      sensor_type: true,
      trial: false,
      priority: false,
      summer_winter: true,
      sensor_error: 0,
      adc2: -12,
      adc3: 345,
      t1_temperature: 52.3,
      t2_temperature: 54.7,
      t3_temperature: null,
      t4_temperature: null,
      t5_temperature: null,
      t6_temperature: null,
      t7_temperature: null,
      t8_temperature: -1.5,
      calibration_ntc_53_41k: 47,
      calibration_ntc_2_588k: 160,
      calibration_pt_1_000k: 106,
      calibration_pt_1_385k: 556,
      filter: 5,
      adc_jump: 20,
      jump_time: 15,
      heater_on1: 5,
      heater_off1: 24,
      heater_on2: 24,
      heater_off2: 24,
      heater_on3: 24,
      heater_off3: 24,
      t1_setpoint: 80,
      t2_max: 90,
      t3_t4_max: 110,
      t3_t4_min: 30,
      freeze: -20,
      delta: 5,
      tolerance: 10,
      hysteresis: 3,
      hysteresis2: 2.5,
      hysteresis3: 3.5,
      t5_setpoint: 80,
      t7_setpoint: 35,
      t8_min: 50,
      t8_max: 110,
      t8_freeze: 1,
      scheme: 2,
      kick_off: 20,
      kick_on: 8,
      kick_pause: 30,
      kick_time: 3,
      time_05c: 60,
      heater_setpoint: 40,
      trial_time: 250,
      decimal_point: 1,
      stop_bits: 1,
      parity: 'none',
      baud_rate: 9600,
      broadcast: false,
      address: 1,
      fast: true,
      output_p1: true,
      output_p2: false,
      output_p3: false,
      output_p4: false,
      output_p5: false,
      output_p6: true,
      output_p7: false,
      output_p8: false,
      clock: '2026-10-20T14:28:59',
      clock_week_day: 2,
    })
  })

  it('reads each data point alone to the same value as in the full read', async () => {
    const ids = driver.dataPoints.map((point) => point.id)
    const all = await driver.readDataPoints(ids)

    for (const id of ids) {
      expect({ [id]: await driver.readDataPoint(id) }).toEqual({ [id]: all[id] })
    }
  })

  it('writes the clock and reads it back', async () => {
    await driver.writeDataPoint('clock', '2026-10-25T03:00:05')

    expect(await driver.readDataPoints(['clock', 'clock_week_day'])).toEqual({
      clock: '2026-10-25T03:00:05',
      clock_week_day: 0,
    })
  })

  it('writes only the clock registers and keeps the low byte of 1027', async () => {
    const before = controller().holding
    await driver.writeDataPoint('clock', '2031-02-28T09:07:30')

    const device = emulator.getDevice(1)!
    expect([1024, 1025, 1026, 1027].map((a) => device.getHoldingRegister(a))).toEqual([
      0x3007, 0x0906, 0x2802, 0x315a,
    ])
    const settings = Object.keys(before)
      .map(Number)
      .filter((address) => address < 1024)
    expect(settings.map((address) => device.getHoldingRegister(address))).toEqual(
      settings.map((address) => before[address])
    )
  })

  it('writes nothing for a wrong clock', async () => {
    await expect(driver.writeDataPoint('clock', '2026-10-20T25:00:00')).rejects.toThrow(
      'Invalid clock'
    )

    expect(await driver.readDataPoint('clock')).toBe('2026-10-20T14:28:59')
  })
})
