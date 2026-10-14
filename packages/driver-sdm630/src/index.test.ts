/**
 * Tests for Eastron SDM630 3-Phase Energy Meter Driver
 */

import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'

import { createDriver, DEFAULT_CONFIG, SUPPORTED_CONFIG } from './index'

/** id, register address (from the V1.8 manual table), unit */
type Row = readonly [string, number, string | undefined]

const PHASES = ['l1', 'l2', 'l3']
const LINES = ['l1_l2', 'l2_l3', 'l3_l1']

/** Rows for 3 values, 2 registers apart */
function three(prefix: string, first: number, unit: string | undefined, sfx = PHASES): Row[] {
  return sfx.map((s, i) => [`${prefix}_${s}`, first + i * 2, unit])
}

const TABLE: ReadonlyArray<Row> = [
  ...three('voltage', 0x00, 'V'),
  ...three('current', 0x06, 'A'),
  ...three('active_power', 0x0c, 'W'),
  ...three('apparent_power', 0x12, 'VA'),
  ...three('reactive_power', 0x18, 'VAr'),
  ...three('power_factor', 0x1e, undefined),
  ...three('phase_angle', 0x24, undefined),
  ['voltage_ln_average', 0x2a, 'V'],
  ['current_average', 0x2e, 'A'],
  ['current_sum', 0x30, 'A'],
  ['active_power_total', 0x34, 'W'],
  ['apparent_power_total', 0x38, 'VA'],
  ['reactive_power_total', 0x3c, 'VAr'],
  ['power_factor_total', 0x3e, undefined],
  ['phase_angle_total', 0x42, undefined],
  ['frequency', 0x46, 'Hz'],
  ['active_energy_forward', 0x48, 'kWh'],
  ['active_energy_reverse', 0x4a, 'kWh'],
  ['reactive_energy_forward', 0x4c, 'kVArh'],
  ['reactive_energy_reverse', 0x4e, 'kVArh'],
  ['apparent_energy_total', 0x50, undefined],
  ['charge_total', 0x52, 'Ah'],
  ['active_power_demand', 0x54, 'W'],
  ['active_power_demand_max', 0x56, 'W'],
  ['apparent_power_demand', 0x64, 'VA'],
  ['apparent_power_demand_max', 0x66, 'VA'],
  ...three('voltage', 0xc8, 'V', LINES),
  ['voltage_ll_average', 0xce, 'V'],
  ['current_neutral', 0xe0, 'A'],
  ...three('voltage_thd', 0xea, '%'),
  ...three('current_thd', 0xf0, '%'),
  ['voltage_thd_ln_average', 0xf8, '%'],
  ['current_thd_average', 0xfa, '%'],
  ...three('current_demand', 0x102, 'A'),
  ...three('current_demand_max', 0x108, 'A'),
  ...three('voltage_thd', 0x14e, '%', LINES),
  ['voltage_thd_ll_average', 0x154, '%'],
  ['active_energy_total', 0x156, 'kWh'],
  ['reactive_energy_total', 0x158, 'kVArh'],
  ...three('active_energy_forward', 0x15a, 'kWh'),
  ...three('active_energy_reverse', 0x160, 'kWh'),
  ...three('active_energy', 0x166, 'kWh'),
  ...three('reactive_energy_forward', 0x16c, 'kVArh'),
  ...three('reactive_energy_reverse', 0x172, 'kVArh'),
  ...three('reactive_energy', 0x178, 'kVArh'),
]

const IDS = TABLE.map(([id]) => id)

/** A different, exact (binary) value per row, so a wrong address shows up */
const valueOf = (index: number): number => (index + 1) * 1.25

/** Mocked device: answers every read from the registers listed in TABLE */
function createMockTransport(): jest.Mocked<Transport> {
  const read = (address: number, count: number): Promise<Buffer> => {
    const buffer = Buffer.alloc(count * 2)
    TABLE.forEach(([, register], i) => {
      if (register >= address && register + 2 <= address + count) {
        buffer.writeFloatBE(valueOf(i), (register - address) * 2)
      }
    })
    return Promise.resolve(buffer)
  }
  return {
    readHoldingRegisters: jest.fn(),
    readInputRegisters: jest.fn(read),
    readCoils: jest.fn(),
    readDiscreteInputs: jest.fn(),
    writeSingleRegister: jest.fn(),
    writeMultipleRegisters: jest.fn(),
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
      defaultAddress: 1,
    })
  })

  it('should export the supported serial settings', () => {
    expect(SUPPORTED_CONFIG).toEqual({
      validBaudRates: [2400, 4800, 9600, 19200, 38400],
      validParity: ['none', 'even', 'odd'],
      validDataBits: [8],
      validStopBits: [1, 2],
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

describe('createDriver', () => {
  let transport: jest.Mocked<Transport>
  let driver: DeviceDriver

  beforeEach(async () => {
    transport = createMockTransport()
    driver = await createDriver({ transport, slaveId: 1 })
  })

  describe('device info', () => {
    it('should identify the device', () => {
      expect(driver.name).toBe('SDM630')
      expect(driver.manufacturer).toBe('Eastron')
      expect(driver.model).toBe('SDM630')
    })
  })

  describe('data points', () => {
    it('should list exactly the data points of the manual table', () => {
      expect(driver.dataPoints.map((dp) => dp.id)).toEqual(IDS)
      expect(new Set(IDS).size).toBe(IDS.length)
    })

    it.each(TABLE)('%s should be a read-only polled float', (id, _register, unit) => {
      const dp = driver.dataPoints.find((d) => d.id === id)
      expect(dp?.type).toBe('float')
      expect(dp?.unit).toBe(unit)
      expect(dp?.access).toBe('r')
      expect(dp?.pollType ?? 'dynamic').toBe('dynamic')
    })

    it('should state the unit in the description when there is no unit value', () => {
      const get = (id: string): string =>
        driver.dataPoints.find((d) => d.id === id)?.description ?? ''
      expect(get('phase_angle_l1')).toContain('degrees')
      expect(get('phase_angle_total')).toContain('degrees')
      expect(get('apparent_energy_total')).toContain('kVAh')
    })
  })

  describe('readDataPoint', () => {
    it.each(TABLE.map((row, i) => [...row, i] as const))(
      'should decode %s from register %#x',
      async (id, register, _unit, index) => {
        const result = (await driver.readDataPoint(id)) as number
        expect(result).toBe(valueOf(index))
        expect(transport.readInputRegisters).toHaveBeenCalledTimes(1)
        const [address, count] = transport.readInputRegisters.mock.calls[0] as [number, number]
        expect(register).toBeGreaterThanOrEqual(address)
        expect(register + 2).toBeLessThanOrEqual(address + count)
      }
    )

    it('should read average line current at 0x2E, not 0x2C', async () => {
      const dp = TABLE.findIndex(([id]) => id === 'current_average')
      expect(TABLE[dp]?.[1]).toBe(0x2e)
      expect(await driver.readDataPoint('current_average')).toBe(valueOf(dp))
    })

    it('should never use holding registers', async () => {
      await driver.readDataPoint('voltage_l1')
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
    })

    it('should throw for an unknown data point', async () => {
      await expect(driver.readDataPoint('nope')).rejects.toThrow('Unknown data point: nope')
      expect(transport.readInputRegisters).not.toHaveBeenCalled()
    })
  })

  describe('readDataPoints', () => {
    it('should use at most 6 requests for all data points', async () => {
      const result = await driver.readDataPoints(IDS)

      expect(transport.readInputRegisters).toHaveBeenCalledTimes(6)
      expect(transport.readInputRegisters.mock.calls).toEqual([
        [0x00, 80],
        [0x50, 8],
        [0x64, 4],
        [0xc8, 8],
        [0xe0, 46],
        [0x14e, 48],
      ])
      expect(Object.keys(result)).toEqual(IDS)
      IDS.forEach((id, i) => expect(result[id]).toBe(valueOf(i)))
    })

    it('should never ask for more than 80 registers in one request', async () => {
      await driver.readDataPoints(IDS)
      for (const [, count] of transport.readInputRegisters.mock.calls) {
        expect(count).toBeLessThanOrEqual(80)
      }
    })

    it('should read only the blocks of the requested data points', async () => {
      const result = await driver.readDataPoints(['active_energy_total', 'voltage_l1_l2'])

      expect(transport.readInputRegisters.mock.calls).toEqual([
        [0x14e, 48],
        [0xc8, 8],
      ])
      expect(result.active_energy_total).toBe(valueOf(IDS.indexOf('active_energy_total')))
    })

    it('should make one request for several data points in one block', async () => {
      await driver.readDataPoints(['voltage_l1', 'frequency'])

      expect(transport.readInputRegisters.mock.calls).toEqual([[0x00, 80]])
    })

    it('should make no request for an empty list', async () => {
      expect(await driver.readDataPoints([])).toEqual({})
      expect(transport.readInputRegisters).not.toHaveBeenCalled()
    })

    it('should throw for unknown data points before any request', async () => {
      await expect(driver.readDataPoints(['voltage_l1', 'nope', 'bad'])).rejects.toThrow(
        'Unknown data points: nope, bad'
      )
      expect(transport.readInputRegisters).not.toHaveBeenCalled()
    })
  })

  describe('writeDataPoint', () => {
    it('should reject writes because all data points are read-only', async () => {
      await expect(driver.writeDataPoint('voltage_l1', 1)).rejects.toThrow(
        'Data point voltage_l1 is read-only'
      )
      expect(transport.writeSingleRegister).not.toHaveBeenCalled()
      expect(transport.writeMultipleRegisters).not.toHaveBeenCalled()
    })
  })
})
