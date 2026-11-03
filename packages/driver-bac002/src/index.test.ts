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

  const register = (address: number): number =>
    emulator.getDevice(SLAVE_ID)!.getHoldingRegister(address)

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

    it('reads a negative room temperature', async () => {
      setRegisters({ 3: 65526, 8: 65526 }) // -1.0 C as a signed 16-bit value
      await expect(
        driver.readDataPoints(['target_temperature', 'current_temperature'])
      ).resolves.toEqual({ target_temperature: -1, current_temperature: -1 })
    })

    it('reads register values with no meaning as unknown and still reads the rest', async () => {
      setRegisters({ 9: 37, 10: 4, 2: 9 })
      const ids = driver.dataPoints.map((dp) => dp.id)
      await expect(driver.readDataPoints(ids)).resolves.toMatchObject({
        valve: 37,
        valve_status: 'on',
        fan: 4,
        fan_status: 'unknown',
        mode: 'unknown',
        power: 'on',
      })
    })

    it('lists unknown as a value to read, but does not accept it for writing', async () => {
      const mode = driver.dataPoints.find((dp) => dp.id === 'mode')
      expect(Object.keys(mode!.enumValues!)).toContain('unknown')
      await expect(driver.writeDataPoint('mode', 'unknown')).rejects.toThrow(
        'must be one of cooling, heating, ventilation'
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
    it.each([
      ['power', 'off', 0, 0],
      ['power', 'on', 1, 0],
      ['fan_setting', 'auto', 0, 1],
      ['fan_setting', 'high', 1, 1],
      ['fan_setting', 'mid', 2, 1],
      ['fan_setting', 'low', 3, 1],
      ['mode', 'cooling', 0, 2],
      ['mode', 'heating', 1, 2],
      ['mode', 'ventilation', 2, 2],
      ['lock', 'unlock', 0, 4],
      ['lock', 'lock', 1, 4],
      ['week_day', 'mon', 1, 7],
      ['week_day', 'tue', 2, 7],
      ['week_day', 'wed', 3, 7],
      ['week_day', 'thu', 4, 7],
      ['week_day', 'fri', 5, 7],
      ['week_day', 'sat', 6, 7],
      ['week_day', 'sun', 7, 7],
    ])('writes %s %s as register value %i', async (id, value, raw, address) => {
      setRegisters({ [address]: 9 })
      await driver.writeDataPoint(id, value)
      expect(register(address)).toBe(raw)
      await expect(driver.readDataPoint(id)).resolves.toBe(value)
    })

    it.each([
      ['power', 'on '],
      ['power', 1],
      ['power', null],
      ['fan_setting', 'turbo'],
      ['mode', 'dry'],
      ['lock', true],
      ['week_day', 'unknown'],
      ['week_day', 'toString'],
    ])('rejects %s value %p and leaves the register alone', async (id, value) => {
      const before = { ...SAMPLE_REGISTERS }
      await expect(driver.writeDataPoint(id, value)).rejects.toThrow(`Invalid ${id}: received`)
      for (const [address, raw] of Object.entries(before)) {
        expect(register(Number(address))).toBe(raw)
      }
    })

    it('names the valid values when an enum value is wrong', async () => {
      await expect(driver.writeDataPoint('fan_setting', 'turbo')).rejects.toThrow(
        'Invalid fan_setting: received turbo, must be one of auto, high, mid, low'
      )
    })

    it.each([
      [21.5, 215],
      [21, 210],
      [0, 0],
      [100, 1000],
      [21.2, 210],
      [21.3, 215],
      [21.74, 215],
      [21.75, 220],
    ])('writes target temperature %p as register value %i', async (value, raw) => {
      await driver.writeDataPoint('target_temperature', value)
      expect(register(3)).toBe(raw)
    })

    it.each([-0.5, 100.5, NaN, Infinity, '21', null])(
      'rejects target temperature %p',
      async (value) => {
        await expect(driver.writeDataPoint('target_temperature', value)).rejects.toThrow(
          'Invalid target_temperature'
        )
        expect(register(3)).toBe(215)
      }
    )

    it('names the range when the target temperature is wrong', async () => {
      await expect(driver.writeDataPoint('target_temperature', 120)).rejects.toThrow(
        'Invalid target_temperature: received 120, must be between 0 and 100'
      )
    })

    it.each([
      ['clock_minutes', 5, 0, 59],
      ['clock_hours', 6, 0, 23],
    ])('writes %s inside its range', async (id, address, min, max) => {
      await driver.writeDataPoint(id, min)
      expect(register(address)).toBe(min)
      await driver.writeDataPoint(id, max)
      expect(register(address)).toBe(max)
      await expect(driver.readDataPoint(id)).resolves.toBe(max)
    })

    it.each([
      ['clock_minutes', 5, -1],
      ['clock_minutes', 5, 60],
      ['clock_minutes', 5, 1.5],
      ['clock_minutes', 5, '30'],
      ['clock_hours', 6, -1],
      ['clock_hours', 6, 24],
      ['clock_hours', 6, NaN],
      ['clock_hours', 6, null],
    ])('rejects %s value %p', async (id, address, value) => {
      const before = register(address)
      await expect(driver.writeDataPoint(id, value)).rejects.toThrow(`Invalid ${id}: received`)
      expect(register(address)).toBe(before)
    })

    it('names the range when the clock is wrong', async () => {
      await expect(driver.writeDataPoint('clock_hours', 24)).rejects.toThrow(
        'Invalid clock_hours: received 24, must be between 0 and 23'
      )
    })

    it('changes one register and no other', async () => {
      await driver.writeDataPoint('mode', 'cooling')
      expect(register(2)).toBe(0)
      const all = Array.from({ length: 11 }, (_, address) => register(address))
      expect(all).toEqual(Object.values({ ...SAMPLE_REGISTERS, 2: 0 }))
    })

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
