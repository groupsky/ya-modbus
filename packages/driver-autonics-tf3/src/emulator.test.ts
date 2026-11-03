/**
 * The driver against an emulated TF3 over a real TCP connection: every data point is read, and
 * the target temperature is written and read back.
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

/** ASCII text packed two characters per register */
const text = (value: string, registers: number): number[] =>
  Array.from({ length: registers }, (_, i) => {
    const pair = value.padEnd(registers * 2, ' ').slice(i * 2, i * 2 + 2)
    return (pair.charCodeAt(0) << 8) | pair.charCodeAt(1)
  })

/** Registers of a controller with one decimal (scale 10), set to cooling, at 21.5 degrees */
function controllerRegisters(): {
  holding: Record<number, number>
  input: Record<number, number>
  coils: Record<number, boolean>
} {
  const input: Record<number, number> = {}
  const holding: Record<number, number> = {}
  const place = (table: Record<number, number>, start: number, values: number[]): void =>
    values.forEach((value, i) => {
      table[start + i] = value
    })

  // Status: current, target, -, unit, -, -, -, inputs, s1, s2, s3, virtual, decimal point
  place(input, 0x03e8, [215, 450, 0, 0, 0, 0, 0, 5, word(-35), 220, 0, 212, 1])
  // Device information: product number (two registers), hardware, software, model
  place(input, 0x0064, [0x0001, 0x0002, 3, 4, ...text('TF33-A', 10)])
  // Input and display setup
  place(holding, 0x0064, [3, 1, 1, 7, 0, word(-5), 10, 0, 25, 1, 2, 1])
  // Control and compressor setup
  place(holding, 0x0096, [
    0,
    20,
    5,
    600,
    word(-400),
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    // startup, min cycle, restart, min run, continuous, alarm delay, sensor-break cycle and duty
    180,
    300,
    240,
    120,
    600,
    90,
    20,
    50,
  ])
  // Defrost setup
  place(holding, 0x00c8, [2, 6])
  // Response delay
  holding[0x0134] = 0

  return { holding, input, coils: { 0: true, 1: false } }
}

describe('driver with an emulated TF3', () => {
  let emulator: ModbusEmulator
  let driver: DeviceDriver
  let close: () => Promise<void>

  beforeEach(async () => {
    const port = await getFreePort()
    emulator = new ModbusEmulator({ transport: 'tcp', host: HOST, port })
    const { holding, input, coils } = controllerRegisters()
    emulator.addDevice({ slaveId: 1, registers: { holding, input, coils } })
    await emulator.start()

    const transport = await createTCPTransport({ host: HOST, port, slaveId: 1, timeout: 2000 })
    driver = await createDriver({ transport })
    close = () => transport.close()
  })

  afterEach(async () => {
    await close()
    await emulator.stop()
  })

  it('reads every data point', async () => {
    const ids = driver.dataPoints.map((point) => point.id)

    expect(await driver.readDataPoints(ids)).toEqual({
      current_temp: 21.5,
      target_temp: 45,
      temperature_unit: 0,
      inputs: 5,
      s1_temp: -3.5,
      s2_temp: 22,
      s3_temp: 0,
      virtual_temp: 21.2,
      temp_divisor: 10,
      aux_enabled: true,
      comp_enabled: false,
      product_number: 65538,
      hardware_version: 3,
      software_version: 4,
      model: 'TF33-A',
      input_type: 3,
      input2_enabled: true,
      input3_type: 1,
      virtual_temp_rate: 7,
      temperature_unit_setting: 0,
      input1_correction: -0.5,
      input2_correction: 1,
      input3_correction: 0,
      display_delay: 2.5,
      def_aux_output: 1,
      aux_output: 2,
      buzzer: true,
      mode: 0,
      hysteresis: 2,
      offset: 0.5,
      high_temp_limit: 60,
      low_temp_limit: -40,
      compressor_startup_delay: 180,
      compressor_min_cycle_time: 300,
      compressor_restart_delay: 240,
      compressor_min_run_time: 120,
      compressor_continuous_operation: 600,
      alarm_delay_after_continuous_operation: 90,
      compressor_operation_cycle_when_sensor_break: 20,
      compressor_duty_rate_when_sensor_break: 50,
      defrost_method: 2,
      defrost_cycle: 6,
    })
  })

  it('reads each data point alone to the same value as in the full read', async () => {
    const ids = driver.dataPoints.map((point) => point.id)
    const all = await driver.readDataPoints(ids)

    for (const id of ids) {
      expect({ [id]: await driver.readDataPoint(id) }).toEqual({ [id]: all[id] })
    }
  })

  it('writes the target temperature and reads it back', async () => {
    await driver.writeDataPoint('target_temp', 38.5)

    // The controller shows its set point in holding register 0 and in input register 0x03E9.
    // The emulator keeps the two tables apart, so the test plays the controller and copies it.
    const device = emulator.getDevice(1)!
    expect(device.getHoldingRegister(0)).toBe(385)
    device.setInputRegister(0x03e9, device.getHoldingRegister(0))

    expect(await driver.readDataPoint('target_temp')).toBe(38.5)
  })

  it('writes a negative target temperature as a signed register', async () => {
    await driver.writeDataPoint('target_temp', -12)

    expect(emulator.getDevice(1)!.getHoldingRegister(0)).toBe(0x10000 - 120)
  })

  it('writes with the scale of the controller when it has no decimal', async () => {
    emulator.getDevice(1)!.setInputRegister(0x03e8 + 12, 0)

    await driver.writeDataPoint('target_temp', 38)

    expect(emulator.getDevice(1)!.getHoldingRegister(0)).toBe(38)
  })

  it('switches the compressor on', async () => {
    await driver.writeDataPoint('comp_enabled', true)

    expect(emulator.getDevice(1)!.getCoil(1)).toBe(true)
    expect(await driver.readDataPoint('comp_enabled')).toBe(true)
  })

  it('writes the mode to the control register and reads it back', async () => {
    await driver.writeDataPoint('mode', 1)

    expect(await driver.readDataPoint('mode')).toBe(1)
  })
})
