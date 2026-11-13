/**
 * Tests for Bituo SPM01R FLEX Single-Phase Energy Meter Driver
 */

import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'

import { createDriver, DEFAULT_CONFIG, SUPPORTED_CONFIG } from './index'

/** id, register address, unit, float32 value, expected driver output */
const MEASUREMENTS: ReadonlyArray<readonly [string, number, string | undefined, number, number]> = [
  ['voltage', 20000, 'V', 230.5, 230.5],
  ['current', 20002, 'A', 1.25, 1.25],
  ['active_power', 20004, 'W', 0.1, 100],
  ['power_factor', 20006, undefined, 0.875, 0.875],
  ['frequency', 20008, 'Hz', 50.0, 50],
  ['active_energy_forward_resettable', 20010, 'kWh', 12.5, 12.5],
  ['active_energy_reverse_resettable', 20012, 'kWh', 3.75, 3.75],
  ['active_energy_total_resettable', 20014, 'kWh', 16.25, 16.25],
  ['active_energy_forward', 20016, 'kWh', 112.5, 112.5],
  ['active_energy_reverse', 20018, 'kWh', 13.75, 13.75],
  ['active_energy_total', 20020, 'kWh', 126.25, 126.25],
  ['apparent_power', 20022, 'VA', 0.125, 125],
]

const MEASUREMENT_IDS = MEASUREMENTS.map(([id]) => id)
const SETTING_IDS = ['device_address', 'baud_rate', 'parity']

/** Mocked device: float32 big-endian block at 20000 and the three settings registers */
function createMockTransport(
  settings: [number, number, number] = [247, 3, 0],
  overrides: Record<number, number> = {}
): jest.Mocked<Transport> {
  const read = (address: number, count: number): Promise<Buffer> => {
    const buffer = Buffer.alloc(count * 2)
    for (const [, register, , raw] of MEASUREMENTS) {
      const value = overrides[register] ?? raw
      if (register >= address && register + 2 <= address + count) {
        buffer.writeFloatBE(value, (register - address) * 2)
      }
    }
    settings.forEach((value, i) => {
      const register = 6000 + i
      if (register >= address && register < address + count) {
        buffer.writeUInt16BE(value, (register - address) * 2)
      }
    })
    return Promise.resolve(buffer)
  }
  return {
    readHoldingRegisters: jest.fn(read),
    readInputRegisters: jest.fn(),
    readCoils: jest.fn(),
    readDiscreteInputs: jest.fn(),
    writeSingleRegister: jest.fn().mockResolvedValue(undefined),
    writeMultipleRegisters: jest.fn().mockResolvedValue(undefined),
    writeSingleCoil: jest.fn(),
    writeMultipleCoils: jest.fn(),
  } as unknown as jest.Mocked<Transport>
}

describe('Configuration Constants', () => {
  it('should export the factory defaults', () => {
    expect(DEFAULT_CONFIG).toEqual({
      baudRate: 9600,
      parity: 'none',
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 247,
    })
  })

  it('should export the supported serial settings', () => {
    expect(SUPPORTED_CONFIG).toEqual({
      validBaudRates: [2400, 4800, 9600, 19200, 38400],
      validParity: ['none', 'even', 'odd'],
      validDataBits: [8],
      validStopBits: [1],
      validAddressRange: [1, 247],
    })
  })

  it('should keep DEFAULT_CONFIG inside SUPPORTED_CONFIG', () => {
    const [min, max] = SUPPORTED_CONFIG.validAddressRange
    expect(SUPPORTED_CONFIG.validBaudRates).toContain(DEFAULT_CONFIG.baudRate)
    expect(SUPPORTED_CONFIG.validParity).toContain(DEFAULT_CONFIG.parity)
    expect(SUPPORTED_CONFIG.validDataBits).toContain(DEFAULT_CONFIG.dataBits)
    expect(SUPPORTED_CONFIG.validStopBits).toContain(DEFAULT_CONFIG.stopBits)
    expect(DEFAULT_CONFIG.defaultAddress).toBeGreaterThanOrEqual(min)
    expect(DEFAULT_CONFIG.defaultAddress).toBeLessThanOrEqual(max)
  })
})

describe('SPM01R driver', () => {
  let transport: jest.Mocked<Transport>
  let driver: DeviceDriver

  beforeEach(async () => {
    transport = createMockTransport()
    driver = await createDriver({ transport, slaveId: 247 })
  })

  describe('identity', () => {
    it('should name the device', () => {
      expect(driver.name).toBe('SPM01R')
      expect(driver.manufacturer).toBe('Bituo Technik')
      expect(driver.model).toBe('SPM01R FLEX')
    })
  })

  describe('data points', () => {
    it('should list measurements then settings', () => {
      expect(driver.dataPoints.map((dp) => dp.id)).toEqual([...MEASUREMENT_IDS, ...SETTING_IDS])
    })

    it.each(MEASUREMENTS)('%s should be a read-only polled float', (id, _r, unit) => {
      const dp = driver.dataPoints.find((d) => d.id === id)
      expect(dp?.type).toBe('float')
      expect(dp?.unit).toBe(unit)
      expect(dp?.access).toBe('r')
      expect(dp?.pollType ?? 'dynamic').toBe('dynamic')
    })

    it.each(SETTING_IDS)('%s should be read/write and on-demand', (id) => {
      const dp = driver.dataPoints.find((d) => d.id === id)
      expect(dp?.access).toBe('rw')
      expect(dp?.pollType).toBe('on-demand')
    })

    it('should describe the resettable counters and parity code 3 honestly', () => {
      const parity = driver.dataPoints.find((d) => d.id === 'parity')
      expect(parity?.description).toMatch(/2 stop bits/)
      expect(parity?.description).toMatch(/N81/)
      const total = driver.dataPoints.find((d) => d.id === 'active_energy_total_resettable')
      expect(total?.description).toMatch(/not confirmed/)
    })

    it('should not expose the LED, energy reset or broadcast address registers', () => {
      const writable = driver.dataPoints.filter((dp) => dp.access === 'rw').map((dp) => dp.id)
      expect(writable).toEqual(SETTING_IDS)
      expect(driver.dataPoints.map((dp) => dp.id)).toEqual([...MEASUREMENT_IDS, ...SETTING_IDS])
    })
  })

  describe('readDataPoint', () => {
    it.each(MEASUREMENTS)('should decode %s', async (id, _register, _unit, _raw, expected) => {
      expect(await driver.readDataPoint(id)).toBeCloseTo(expected, 5)
      expect(transport.readHoldingRegisters).toHaveBeenCalledTimes(1)
      expect(transport.readHoldingRegisters).toHaveBeenCalledWith(20000, 24)
      expect(transport.readInputRegisters).not.toHaveBeenCalled()
    })

    it('should convert active power from kW to W and apparent power from kVA to VA', async () => {
      transport = createMockTransport([247, 3, 0], { 20004: 1.5, 20022: 2.25 })
      driver = await createDriver({ transport, slaveId: 247 })
      expect(await driver.readDataPoint('active_power')).toBeCloseTo(1500, 3)
      expect(await driver.readDataPoint('apparent_power')).toBeCloseTo(2250, 3)
    })

    it('should keep the sign of power flowing the other way', async () => {
      transport = createMockTransport([247, 3, 0], { 20004: -0.5 })
      driver = await createDriver({ transport, slaveId: 247 })
      expect(await driver.readDataPoint('active_power')).toBeCloseTo(-500, 3)
    })

    it('should read the address register', async () => {
      transport = createMockTransport([12, 3, 0])
      driver = await createDriver({ transport, slaveId: 12 })
      expect(await driver.readDataPoint('device_address')).toBe(12)
      expect(transport.readHoldingRegisters).toHaveBeenCalledWith(6000, 1)
    })

    it.each([
      [0, 9600],
      [1, 2400],
      [2, 4800],
      [3, 9600],
      [4, 19200],
      [5, 38400],
    ])('should decode baud rate code %i as %i', async (code, baud) => {
      transport = createMockTransport([247, code, 0])
      driver = await createDriver({ transport, slaveId: 247 })
      expect(await driver.readDataPoint('baud_rate')).toBe(baud)
      expect(transport.readHoldingRegisters).toHaveBeenCalledWith(6001, 1)
    })

    it('should throw for an unknown baud rate code', async () => {
      transport = createMockTransport([247, 9, 0])
      driver = await createDriver({ transport, slaveId: 247 })
      await expect(driver.readDataPoint('baud_rate')).rejects.toThrow(
        'Unknown baud rate encoding from device: 9'
      )
    })

    it.each([
      [0, 'none'],
      [1, 'even'],
      [2, 'odd'],
      [3, 'none'],
    ])('should decode parity code %i as %s', async (code, parity) => {
      transport = createMockTransport([247, 3, code])
      driver = await createDriver({ transport, slaveId: 247 })
      expect(await driver.readDataPoint('parity')).toBe(parity)
      expect(transport.readHoldingRegisters).toHaveBeenCalledWith(6002, 1)
    })

    it('should throw for an unknown parity code', async () => {
      transport = createMockTransport([247, 3, 7])
      driver = await createDriver({ transport, slaveId: 247 })
      await expect(driver.readDataPoint('parity')).rejects.toThrow(
        'Unknown parity encoding from device: 7'
      )
    })

    it('should throw for an unknown data point without a request', async () => {
      await expect(driver.readDataPoint('nope')).rejects.toThrow('Unknown data point: nope')
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
    })
  })

  describe('readDataPoints', () => {
    it('should read all measurements with one 24-register request', async () => {
      const result = await driver.readDataPoints(MEASUREMENT_IDS)

      expect(transport.readHoldingRegisters.mock.calls).toEqual([[20000, 24]])
      expect(Object.keys(result)).toEqual(MEASUREMENT_IDS)
      for (const [id, , , , expected] of MEASUREMENTS) {
        expect(result[id]).toBeCloseTo(expected, 5)
      }
    })

    it('should read the three settings with one request', async () => {
      transport = createMockTransport([5, 4, 2])
      driver = await createDriver({ transport, slaveId: 5 })

      const result = await driver.readDataPoints(SETTING_IDS)

      expect(transport.readHoldingRegisters.mock.calls).toEqual([[6000, 3]])
      expect(result).toEqual({ device_address: 5, baud_rate: 19200, parity: 'odd' })
    })

    it('should read only the settings that are asked for', async () => {
      transport = createMockTransport([5, 4, 2])
      driver = await createDriver({ transport, slaveId: 5 })

      expect(await driver.readDataPoints(['baud_rate'])).toEqual({ baud_rate: 19200 })
      expect(transport.readHoldingRegisters.mock.calls).toEqual([[6000, 3]])
    })

    it('should read measurements and settings with two requests', async () => {
      const result = await driver.readDataPoints(['frequency', 'parity', 'voltage'])

      expect(transport.readHoldingRegisters.mock.calls).toEqual([
        [20000, 24],
        [6000, 3],
      ])
      expect(result).toEqual({ frequency: 50, parity: 'none', voltage: 230.5 })
    })

    it('should make no request for an empty list', async () => {
      expect(await driver.readDataPoints([])).toEqual({})
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
    })

    it('should throw for unknown data points before any request', async () => {
      await expect(driver.readDataPoints(['voltage', 'nope', 'bad'])).rejects.toThrow(
        'Unknown data points: nope, bad'
      )
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
    })

    it('should throw when the answer is shorter than 24 registers', async () => {
      transport.readHoldingRegisters.mockResolvedValueOnce(Buffer.alloc(10))
      await expect(driver.readDataPoints(['voltage'])).rejects.toThrow('Buffer too short')
    })
  })

  describe('writeDataPoint', () => {
    it.each(MEASUREMENT_IDS)('should reject writes to read-only %s', async (id) => {
      await expect(driver.writeDataPoint(id, 1)).rejects.toThrow(`Data point ${id} is read-only`)
      expect(transport.writeSingleRegister).not.toHaveBeenCalled()
    })

    it('should reject writes to unknown data points', async () => {
      await expect(driver.writeDataPoint('nope', 1)).rejects.toThrow('Unknown data point: nope')
    })

    it.each([1, 100, 247])('should write address %i to register 6000', async (address) => {
      await driver.writeDataPoint('device_address', address)
      expect(transport.writeSingleRegister).toHaveBeenCalledWith(6000, address)
    })

    it.each([0, 248, -1, 1.5, '5', null, NaN])('should reject address %p', async (value) => {
      await expect(driver.writeDataPoint('device_address', value)).rejects.toThrow(/device address/)
      expect(transport.writeSingleRegister).not.toHaveBeenCalled()
    })

    it.each([
      [2400, 1],
      [4800, 2],
      [9600, 3],
      [19200, 4],
      [38400, 5],
    ])('should write baud rate %i as code %i to register 6001', async (baud, code) => {
      await driver.writeDataPoint('baud_rate', baud)
      expect(transport.writeSingleRegister).toHaveBeenCalledWith(6001, code)
    })

    it.each([1200, 57600, '9600', null])('should reject baud rate %p', async (value) => {
      await expect(driver.writeDataPoint('baud_rate', value)).rejects.toThrow(/baud rate/)
      expect(transport.writeSingleRegister).not.toHaveBeenCalled()
    })

    it.each([
      ['none', 0],
      ['even', 1],
      ['odd', 2],
    ])('should write parity %s as code %i to register 6002', async (parity, code) => {
      await driver.writeDataPoint('parity', parity)
      expect(transport.writeSingleRegister).toHaveBeenCalledWith(6002, code)
    })

    it.each(['mark', 'EVEN', 1, null])('should reject parity %p', async (value) => {
      await expect(driver.writeDataPoint('parity', value)).rejects.toThrow(/parity/)
      expect(transport.writeSingleRegister).not.toHaveBeenCalled()
    })

    it('should never write the energy reset, LED or broadcast address registers', async () => {
      await driver.writeDataPoint('device_address', 3)
      await driver.writeDataPoint('baud_rate', 9600)
      await driver.writeDataPoint('parity', 'none')
      const written = transport.writeSingleRegister.mock.calls.map(([a]) => a)
      expect(written).toEqual([6000, 6001, 6002])
      expect(transport.writeMultipleRegisters).not.toHaveBeenCalled()
    })
  })
})
