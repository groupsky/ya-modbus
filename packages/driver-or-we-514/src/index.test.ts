/**
 * Tests for ORNO OR-WE-514 Single-Phase Energy Meter Driver
 */

import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'

import { createDriver, DEFAULT_CONFIG, SUPPORTED_CONFIG } from './index'

/** id, register address, register count, unit, raw register bytes (hex), decoded value */
const VERIFIED: ReadonlyArray<
  readonly [string, number, number, string | undefined, string, number]
> = [
  ['frequency', 0x130, 1, 'Hz', '1388', 50.0],
  ['voltage', 0x131, 1, 'V', '59be', 229.74],
  ['current', 0x139, 2, 'A', '00001d93', 7.571],
  ['active_power', 0x140, 2, 'W', '000006c8', 1736],
  ['reactive_power', 0x148, 2, 'VAr', '00000050', 80],
  ['apparent_power', 0x150, 2, 'VA', '000006e0', 1760],
  ['power_factor', 0x158, 1, undefined, '03e7', 0.999],
  ['total_active_energy', 0xa000, 2, 'kWh', '0001e240', 1234.56],
  ['total_reactive_energy', 0xa01e, 2, 'kVArh', '0001818c', 987.0],
]

const POWERS = ['active_power', 'reactive_power', 'apparent_power']

const IDS = VERIFIED.map(([id]) => id)

/** Mocked device: answers every read from the registers listed in VERIFIED */
function createMockTransport(overrides: Record<number, string> = {}): jest.Mocked<Transport> {
  const read = (address: number, count: number): Promise<Buffer> => {
    const buffer = Buffer.alloc(count * 2)
    for (const [, register, size, , hex] of VERIFIED) {
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
      validBaudRates: [1200, 2400, 4800, 9600],
      validParity: ['even'],
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
      expect(driver.name).toBe('OR-WE-514')
      expect(driver.manufacturer).toBe('ORNO')
      expect(driver.model).toBe('OR-WE-514')
    })
  })

  describe('data points', () => {
    it('should list exactly the verified data points', () => {
      expect(driver.dataPoints.map((dp) => dp.id)).toEqual(IDS)
    })

    it.each(VERIFIED)('%s should be a read-only polled number', (id, _a, _c, unit) => {
      const dp = driver.dataPoints.find((d) => d.id === id)
      expect(dp?.type).toBe(POWERS.includes(id) ? 'integer' : 'float')
      expect(dp?.unit).toBe(unit)
      expect(dp?.access).toBe('r')
      expect(dp?.pollType ?? 'dynamic').toBe('dynamic')
    })
  })

  describe('readDataPoint', () => {
    it.each(VERIFIED)(
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
      ['active_power', 0x140, 'fffffc18', -1000],
      ['reactive_power', 0x148, 'ffffff38', -200],
      ['apparent_power', 0x150, 'fffffc18', -1000],
      ['power_factor', 0x158, 'fc19', -0.999],
    ])('should read %s as signed (negative value)', async (id, register, hex, value) => {
      transport = createMockTransport({ [register]: hex })
      driver = await createDriver({ transport, slaveId: 1 })
      expect(await driver.readDataPoint(id)).toBeCloseTo(value, 3)
    })

    it('should throw for an unknown data point', async () => {
      await expect(driver.readDataPoint('nope')).rejects.toThrow('Unknown data point: nope')
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
    })
  })

  describe('readDataPoints', () => {
    it('should use at most 8 requests for all data points', async () => {
      const result = await driver.readDataPoints(IDS)

      expect(transport.readHoldingRegisters.mock.calls).toEqual([
        [0x130, 2],
        [0x139, 2],
        [0x140, 2],
        [0x148, 2],
        [0x150, 2],
        [0x158, 1],
        [0xa000, 2],
        [0xa01e, 2],
      ])
      expect(Object.keys(result)).toEqual(IDS)
      for (const [id, , , , , value] of VERIFIED) {
        expect(result[id]).toBeCloseTo(value, 3)
      }
    })

    it('should read only the blocks of the requested data points', async () => {
      const result = await driver.readDataPoints(['total_active_energy', 'voltage', 'frequency'])

      expect(transport.readHoldingRegisters.mock.calls).toEqual([
        [0xa000, 2],
        [0x130, 2],
      ])
      expect(result.total_active_energy).toBeCloseTo(1234.56, 2)
      expect(result.voltage).toBeCloseTo(229.74, 2)
      expect(result.frequency).toBeCloseTo(50, 2)
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
  })

  describe('writeDataPoint', () => {
    it('should reject writes because all data points are read-only', async () => {
      await expect(driver.writeDataPoint('voltage', 1)).rejects.toThrow(
        'Data point voltage is read-only'
      )
      expect(transport.writeSingleRegister).not.toHaveBeenCalled()
      expect(transport.writeMultipleRegisters).not.toHaveBeenCalled()
    })
  })
})
