/**
 * Tests for Sinotimer DDS024MR 3-Phase Energy Meter Driver
 */

import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'

import { createDriver, DEFAULT_CONFIG, SUPPORTED_CONFIG } from './index'

/** id, register address, unit, decoded value used in the tests */
const VERIFIED: ReadonlyArray<readonly [string, number, string | undefined, number]> = [
  ['voltage_l1', 0x00, 'V', 239.5],
  ['voltage_l2', 0x02, 'V', 240.5],
  ['voltage_l3', 0x04, 'V', 241.5],
  ['current_l1', 0x08, 'A', 1.25],
  ['current_l2', 0x0a, 'A', 0.419],
  ['current_l3', 0x0c, 'A', 2.5],
  ['active_power_total', 0x10, 'W', 300.5],
  ['active_power_l1', 0x12, 'W', 100.25],
  ['active_power_l2', 0x14, 'W', 67.54],
  ['active_power_l3', 0x16, 'W', 132.75],
  ['reactive_power_total', 0x18, 'VAr', 50.5],
  ['reactive_power_l1', 0x1a, 'VAr', 10.25],
  ['reactive_power_l2', 0x1c, 'VAr', 20.5],
  ['reactive_power_l3', 0x1e, 'VAr', 19.75],
  ['power_factor_l1', 0x2a, undefined, 0.95],
  ['power_factor_l2', 0x2c, undefined, 0.673],
  ['power_factor_l3', 0x2e, undefined, 0.5],
  ['frequency', 0x36, 'Hz', 50.02],
  ['active_energy_total', 0x100, 'kWh', 12345.67],
  ['reactive_energy_total', 0x400, 'kVArh', 987.65],
]

const IDS = VERIFIED.map(([id]) => id)

/** Mocked device: answers every read from the registers listed in VERIFIED */
function createMockTransport(): jest.Mocked<Transport> {
  const read = (address: number, count: number): Promise<Buffer> => {
    const buffer = Buffer.alloc(count * 2)
    for (const [, register, , value] of VERIFIED) {
      if (register >= address && register + 2 <= address + count) {
        buffer.writeFloatBE(value, (register - address) * 2)
      }
    }
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
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 1,
    })
  })

  it('should export the supported serial settings', () => {
    expect(SUPPORTED_CONFIG).toEqual({
      validBaudRates: [300, 600, 1200, 2400, 4800, 9600],
      validParity: ['even', 'odd', 'none'],
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

describe('createDriver', () => {
  let transport: jest.Mocked<Transport>
  let driver: DeviceDriver

  beforeEach(async () => {
    transport = createMockTransport()
    driver = await createDriver({ transport, slaveId: 1 })
  })

  describe('device info', () => {
    it('should identify the device', () => {
      expect(driver.name).toBe('DDS024MR')
      expect(driver.manufacturer).toBe('Sinotimer')
      expect(driver.model).toBe('DDS024MR')
    })
  })

  describe('data points', () => {
    it('should list exactly the verified data points', () => {
      expect(driver.dataPoints.map((dp) => dp.id)).toEqual(IDS)
    })

    it.each(VERIFIED)('%s should be a read-only polled float', (id, _register, unit) => {
      const dp = driver.dataPoints.find((d) => d.id === id)
      expect(dp?.type).toBe('float')
      expect(dp?.unit).toBe(unit)
      expect(dp?.access).toBe('r')
      expect(dp?.pollType ?? 'dynamic').toBe('dynamic')
    })
  })

  describe('readDataPoint', () => {
    it.each(VERIFIED)('should decode %s from register 0x%s', async (id, register, _unit, value) => {
      const result = (await driver.readDataPoint(id)) as number
      expect(result).toBeCloseTo(value, 3)
      expect(transport.readInputRegisters).toHaveBeenCalledTimes(1)
      const [address, count] = transport.readInputRegisters.mock.calls[0] as [number, number]
      expect(register).toBeGreaterThanOrEqual(address)
      expect(register + 2).toBeLessThanOrEqual(address + count)
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
    it('should use at most 3 requests for all data points', async () => {
      const result = await driver.readDataPoints(IDS)

      expect(transport.readInputRegisters).toHaveBeenCalledTimes(3)
      expect(transport.readInputRegisters.mock.calls).toEqual([
        [0x00, 56],
        [0x100, 2],
        [0x400, 2],
      ])
      expect(Object.keys(result)).toHaveLength(IDS.length)
      for (const [id, , , value] of VERIFIED) {
        expect(result[id]).toBeCloseTo(value, 3)
      }
    })

    it('should read only the block of the requested data points', async () => {
      const result = await driver.readDataPoints(['active_energy_total', 'reactive_energy_total'])

      expect(transport.readInputRegisters.mock.calls).toEqual([
        [0x100, 2],
        [0x400, 2],
      ])
      expect(result.active_energy_total).toBeCloseTo(12345.67, 2)
    })

    it('should make one request for several realtime data points', async () => {
      await driver.readDataPoints(['voltage_l1', 'frequency'])

      expect(transport.readInputRegisters.mock.calls).toEqual([[0x00, 56]])
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
