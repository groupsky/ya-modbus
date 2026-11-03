/**
 * Tests for Huawei SUN2000 Solar Inverter Driver
 */

import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'

import { createDriver, DEFAULT_CONFIG, SUPPORTED_CONFIG } from './index'

/** id, register address, register count, unit, raw register bytes (hex), decoded value */
const POINTS: ReadonlyArray<readonly [string, number, number, string | undefined, string, number]> =
  [
    ['active_power', 32080, 2, 'kW', '00000ce4', 3.3],
    ['reactive_power', 32082, 2, 'kVAr', '0000007b', 0.123],
    ['power_factor', 32084, 1, undefined, '03e7', 0.999],
    ['grid_frequency', 32085, 1, 'Hz', '1389', 50.01],
    ['efficiency', 32086, 1, '%', '2689', 98.65],
    ['internal_temperature', 32087, 1, '°C', '01c5', 45.3],
    ['insulation_resistance', 32088, 1, undefined, '0bb8', 3.0],
    ['total_energy_yield', 32106, 2, 'kWh', '0012d687', 12345.67],
    ['daily_energy_yield', 32114, 2, 'kWh', '00000929', 23.45],
  ]

const IDS = POINTS.map(([id]) => id)

/** Mocked device: answers every read from the registers listed in POINTS */
function createMockTransport(overrides: Record<number, string> = {}): jest.Mocked<Transport> {
  const read = (address: number, count: number): Promise<Buffer> => {
    const buffer = Buffer.alloc(count * 2)
    for (const [, register, size, , hex] of POINTS) {
      const raw = overrides[register] ?? hex
      if (register >= address && register + size <= address + count) {
        Buffer.from(raw, 'hex').copy(buffer, (register - address) * 2)
      }
    }
    return Promise.resolve(buffer)
  }
  return {
    readHoldingRegisters: jest.fn(read),
    readInputRegisters: jest.fn(),
    readCoils: jest.fn(),
    readDiscreteInputs: jest.fn(),
    writeSingleRegister: jest.fn(),
    writeMultipleRegisters: jest.fn(),
    writeSingleCoil: jest.fn(),
    writeMultipleCoils: jest.fn(),
  } as unknown as jest.Mocked<Transport>
}

describe('Configuration Constants', () => {
  it('should export the default unit ID and port', () => {
    expect(DEFAULT_CONFIG).toEqual({ defaultAddress: 1, defaultPort: 502 })
  })

  it('should allow unit IDs 0 to 247', () => {
    expect(SUPPORTED_CONFIG).toEqual({ validAddressRange: [0, 247] })
  })

  it('should keep DEFAULT_CONFIG inside SUPPORTED_CONFIG', () => {
    const [min, max] = SUPPORTED_CONFIG.validAddressRange
    expect(DEFAULT_CONFIG.defaultAddress).toBeGreaterThanOrEqual(min)
    expect(DEFAULT_CONFIG.defaultAddress).toBeLessThanOrEqual(max)
  })
})

describe('createDriver', () => {
  let transport: jest.Mocked<Transport>
  let driver: DeviceDriver

  beforeEach(async () => {
    transport = createMockTransport()
    driver = await createDriver({ transport, slaveId: 1 })
  })

  describe('device info', () => {
    it('should identify the device', () => {
      expect(driver.name).toBe('SUN2000')
      expect(driver.manufacturer).toBe('Huawei')
      expect(driver.model).toBe('SUN2000')
    })
  })

  describe('data points', () => {
    it('should list exactly the known data points', () => {
      expect(driver.dataPoints.map((dp) => dp.id)).toEqual(IDS)
    })

    it.each(POINTS)('%s should be a read-only polled float', (id, _a, _c, unit) => {
      const dp = driver.dataPoints.find((d) => d.id === id)
      expect(dp?.type).toBe('float')
      expect(dp?.unit).toBe(unit)
      expect(dp?.access).toBe('r')
      expect(dp?.pollType ?? 'dynamic').toBe('dynamic')
    })
  })

  describe('readDataPoint', () => {
    it.each(POINTS)(
      'should decode %s from its holding register',
      async (id, register, count, _unit, _hex, value) => {
        const result = (await driver.readDataPoint(id)) as number
        expect(result).toBeCloseTo(value, 3)
        expect(transport.readHoldingRegisters).toHaveBeenCalledTimes(1)
        const [address, size] = transport.readHoldingRegisters.mock.calls[0] as [number, number]
        expect(register).toBeGreaterThanOrEqual(address)
        expect(register + count).toBeLessThanOrEqual(address + size)
        expect(transport.readInputRegisters).not.toHaveBeenCalled()
      }
    )

    it.each([
      ['active_power', 32080, 'fffffc18', -1],
      ['reactive_power', 32082, 'fffffe0c', -0.5],
      ['power_factor', 32084, 'fc7c', -0.9],
      ['internal_temperature', 32087, 'ff9c', -10],
    ])('should read %s as signed (negative value)', async (id, register, hex, value) => {
      transport = createMockTransport({ [register]: hex })
      driver = await createDriver({ transport, slaveId: 1 })
      expect(await driver.readDataPoint(id)).toBeCloseTo(value, 3)
    })

    it.each([
      // 0x80000000 = 2147483648, the first value that a signed 32-bit number cannot hold
      ['total_energy_yield', 32106, '80000000', 21474836.48],
      ['daily_energy_yield', 32114, 'fffffffe', 42949672.94],
    ])('should read %s above 2^31 as a positive number', async (id, register, hex, value) => {
      transport = createMockTransport({ [register]: hex })
      driver = await createDriver({ transport, slaveId: 1 })
      expect(await driver.readDataPoint(id)).toBeCloseTo(value, 2)
    })

    it('should throw for an unknown data point', async () => {
      await expect(driver.readDataPoint('nope')).rejects.toThrow('Unknown data point: nope')
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
    })
  })

  describe('readDataPoints', () => {
    it('should use 3 requests for all data points', async () => {
      const result = await driver.readDataPoints(IDS)

      expect(transport.readHoldingRegisters.mock.calls).toEqual([
        [32080, 9],
        [32106, 2],
        [32114, 2],
      ])
      expect(Object.keys(result)).toEqual(IDS)
      for (const [id, , , , , value] of POINTS) {
        expect(result[id]).toBeCloseTo(value, 3)
      }
    })

    it('should read only the blocks of the requested data points', async () => {
      const result = await driver.readDataPoints(['daily_energy_yield', 'efficiency'])

      expect(transport.readHoldingRegisters.mock.calls).toEqual([
        [32114, 2],
        [32080, 9],
      ])
      expect(result).toEqual({ daily_energy_yield: 23.45, efficiency: 98.65 })
    })

    it('should make no request for an empty list', async () => {
      expect(await driver.readDataPoints([])).toEqual({})
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
    })

    it('should throw for unknown data points before any request', async () => {
      await expect(driver.readDataPoints(['active_power', 'nope', 'bad'])).rejects.toThrow(
        'Unknown data points: nope, bad'
      )
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
    })
  })

  describe('writeDataPoint', () => {
    it('should reject writes because all data points are read-only', async () => {
      await expect(driver.writeDataPoint('active_power', 1)).rejects.toThrow(
        'Data point active_power is read-only'
      )
      expect(transport.writeSingleRegister).not.toHaveBeenCalled()
      expect(transport.writeMultipleRegisters).not.toHaveBeenCalled()
    })
  })
})
