/**
 * Tests for the BAC-002 room thermostat driver
 *
 * The driver talks to a Modbus emulator over TCP, so every read and write goes through the
 * real Modbus protocol.
 */

import { createServer, type AddressInfo } from 'node:net'

import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'
import { ModbusEmulator } from '@ya-modbus/emulator'
import { createTCPTransport } from '@ya-modbus/transport'

import { createDriver, DEFAULT_CONFIG } from './index'

const SLAVE_ID = 1

/** Register values of a thermostat that heats, with the fan on low */
const SAMPLE_REGISTERS: Record<number, number> = {
  0: 1, // power on
  1: 3, // fan setting low
  2: 1, // heating
  3: 215, // target 21.5 C
  4: 0, // unlocked
  5: 45, // minutes
  6: 13, // hours
  7: 3, // wed
  8: 198, // current 19.8 C
  9: 1, // valve on
  10: 3, // fan low
}

const getFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo
      probe.close((err) => (err ? reject(err) : resolve(port)))
    })
  })

describe('BAC-002 driver with an emulated device', () => {
  let emulator: ModbusEmulator
  let transport: Transport
  let driver: DeviceDriver

  const setRegisters = (values: Record<number, number>): void => {
    for (const [address, value] of Object.entries(values)) {
      emulator.getDevice(SLAVE_ID)!.setHoldingRegister(Number(address), value)
    }
  }

  beforeEach(async () => {
    const port = await getFreePort()
    emulator = new ModbusEmulator({ transport: 'tcp', host: '127.0.0.1', port })
    emulator.addDevice({ slaveId: SLAVE_ID, registers: { holding: { ...SAMPLE_REGISTERS } } })
    await emulator.start()
    transport = await createTCPTransport({
      host: '127.0.0.1',
      port,
      slaveId: SLAVE_ID,
      timeout: 2000,
      maxRetries: 1,
    })
    driver = await createDriver({ transport })
  })

  afterEach(async () => {
    await transport.close()
    await emulator.stop()
  })

  describe('DEFAULT_CONFIG', () => {
    it('matches the factory settings of the device', () => {
      expect(DEFAULT_CONFIG).toEqual({
        baudRate: 9600,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
        defaultAddress: 1,
      })
    })
  })

  describe('data points', () => {
    it('lists every data point with a unique id', () => {
      const ids = driver.dataPoints.map((dp) => dp.id)
      expect(ids).toEqual([
        'power',
        'fan_setting',
        'mode',
        'target_temperature',
        'lock',
        'clock_minutes',
        'clock_hours',
        'week_day',
        'current_temperature',
        'valve',
        'valve_status',
        'fan',
        'fan_status',
      ])
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('marks the eight settings as writable and the rest as read only', () => {
      const writable = driver.dataPoints.filter((dp) => dp.access === 'rw').map((dp) => dp.id)
      expect(writable).toEqual([
        'power',
        'fan_setting',
        'mode',
        'target_temperature',
        'lock',
        'clock_minutes',
        'clock_hours',
        'week_day',
      ])
      const readOnly = driver.dataPoints.filter((dp) => dp.access === 'r').map((dp) => dp.id)
      expect(readOnly).toEqual([
        'current_temperature',
        'valve',
        'valve_status',
        'fan',
        'fan_status',
      ])
    })
  })

  describe('reading', () => {
    it('reads all data points', async () => {
      const ids = driver.dataPoints.map((dp) => dp.id)
      await expect(driver.readDataPoints(ids)).resolves.toEqual({
        power: 'on',
        fan_setting: 'low',
        mode: 'heating',
        target_temperature: 21.5,
        lock: 'unlock',
        clock_minutes: 45,
        clock_hours: 13,
        week_day: 'wed',
        current_temperature: 19.8,
        valve: 1,
        valve_status: 'on',
        fan: 3,
        fan_status: 'low',
      })
    })

    it('reads one data point', async () => {
      await expect(driver.readDataPoint('current_temperature')).resolves.toBe(19.8)
    })

    it('reads only the requested data points', async () => {
      await expect(driver.readDataPoints(['mode', 'lock'])).resolves.toEqual({
        mode: 'heating',
        lock: 'unlock',
      })
    })

    it.each([
      ['power', 0, 'off'],
      ['power', 1, 'on'],
      ['fan_setting', 0, 'auto'],
      ['fan_setting', 1, 'high'],
      ['fan_setting', 2, 'mid'],
      ['fan_setting', 3, 'low'],
      ['mode', 0, 'cooling'],
      ['mode', 1, 'heating'],
      ['mode', 2, 'ventilation'],
      ['lock', 0, 'unlock'],
      ['lock', 1, 'lock'],
      ['week_day', 1, 'mon'],
      ['week_day', 2, 'tue'],
      ['week_day', 3, 'wed'],
      ['week_day', 4, 'thu'],
      ['week_day', 5, 'fri'],
      ['week_day', 6, 'sat'],
      ['week_day', 7, 'sun'],
      ['valve_status', 0, 'off'],
      ['valve_status', 1, 'on'],
      ['fan_status', 0, 'off'],
      ['fan_status', 1, 'high'],
      ['fan_status', 2, 'mid'],
      ['fan_status', 3, 'low'],
    ])('decodes %s register value %i as %s', async (id, raw, expected) => {
      const address = {
        power: 0,
        fan_setting: 1,
        mode: 2,
        lock: 4,
        week_day: 7,
        valve_status: 9,
        fan_status: 10,
      }[id]!
      setRegisters({ [address]: raw })
      await expect(driver.readDataPoint(id)).resolves.toBe(expected)
    })

    it('reads a week day that is not set as unknown', async () => {
      setRegisters({ 7: 0 })
      await expect(driver.readDataPoint('week_day')).resolves.toBe('unknown')
    })

    it('reads the raw valve and fan numbers', async () => {
      setRegisters({ 9: 0, 10: 0 })
      await expect(driver.readDataPoints(['valve', 'fan'])).resolves.toEqual({ valve: 0, fan: 0 })
    })

    it('reads temperatures with one decimal', async () => {
      setRegisters({ 3: 305, 8: 71 })
      await expect(
        driver.readDataPoints(['target_temperature', 'current_temperature'])
      ).resolves.toEqual({
        target_temperature: 30.5,
        current_temperature: 7.1,
      })
    })

    it('rejects a register value that has no meaning', async () => {
      setRegisters({ 2: 9 })
      await expect(driver.readDataPoint('mode')).rejects.toThrow(
        'Unknown Mode value from device: 9'
      )
    })

    it('rejects an unknown data point', async () => {
      await expect(driver.readDataPoint('humidity')).rejects.toThrow('Unknown data point: humidity')
      await expect(driver.readDataPoints(['power', 'humidity'])).rejects.toThrow(
        'Unknown data point: humidity'
      )
    })

    it('rejects an answer that is too short', async () => {
      const short = {
        ...transport,
        readHoldingRegisters: () => Promise.resolve(Buffer.alloc(10)),
      } as Transport
      const shortDriver = await createDriver({ transport: short })
      await expect(shortDriver.readDataPoint('power')).rejects.toThrow(
        'Buffer too short: expected at least 22 bytes, got 10'
      )
    })
  })

  describe('writing', () => {
    it('rejects an unknown data point', async () => {
      await expect(driver.writeDataPoint('humidity')).rejects.toThrow(
        'Unknown data point: humidity'
      )
    })

    it.each(['current_temperature', 'valve', 'valve_status', 'fan', 'fan_status'])(
      'rejects a write to the read only data point %s',
      async (id) => {
        await expect(driver.writeDataPoint(id)).rejects.toThrow(`Data point ${id} is read-only`)
      }
    )
  })
})
