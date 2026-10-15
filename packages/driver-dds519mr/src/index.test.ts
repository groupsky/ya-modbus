/**
 * Tests for Sinotimer DDS519MR Single-Phase Energy Meter Driver
 */

import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'

import { createDriver, DEFAULT_CONFIG, SUPPORTED_CONFIG } from './index'

/** id, register address, unit, raw float32 big-endian bytes, decoded value */
const VERIFIED: ReadonlyArray<readonly [string, number, string | undefined, string, number]> = [
  ['voltage', 0x00, 'V', '436b580e', 235.34396362304688],
  ['current', 0x08, 'A', '40200000', 2.5],
  ['active_power', 0x12, 'W', '44160000', 600],
  ['power_factor', 0x2a, undefined, '3f800000', 1],
  ['frequency', 0x36, 'Hz', '42480000', 50],
  ['total_active_energy', 0x100, 'kWh', '3fc00000', 1.5],
]

const IDS = VERIFIED.map(([id]) => id)

/** Mocked device: answers every read from the registers listed in VERIFIED */
function createMockTransport(): jest.Mocked<Transport> {
  const read = (address: number, count: number): Promise<Buffer> => {
    const buffer = Buffer.alloc(count * 2)
    for (const [, register, , raw] of VERIFIED) {
      if (register >= address && register + 2 <= address + count) {
        Buffer.from(raw, 'hex').copy(buffer, (register - address) * 2)
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
      validBaudRates: [1200, 2400, 4800, 9600],
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
      expect(driver.name).toBe('DDS519MR')
      expect(driver.manufacturer).toBe('Sinotimer')
      expect(driver.model).toBe('DDS519MR')
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
    it.each(VERIFIED)('should decode %s', async (id, register, _unit, _raw, value) => {
      const result = await driver.readDataPoint(id)
      expect(result).toBe(value)
      expect(transport.readInputRegisters).toHaveBeenCalledTimes(1)
      const [address, count] = transport.readInputRegisters.mock.calls[0] as [number, number]
      expect(register).toBeGreaterThanOrEqual(address)
      expect(register + 2).toBeLessThanOrEqual(address + count)
    })

    it('should never use holding registers', async () => {
      await driver.readDataPoint('voltage')
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
    })

    it('should throw for an unknown data point', async () => {
      await expect(driver.readDataPoint('nope')).rejects.toThrow('Unknown data point: nope')
      expect(transport.readInputRegisters).not.toHaveBeenCalled()
    })
  })

  describe('readDataPoints', () => {
    it('should use exactly 3 requests for all data points', async () => {
      const result = await driver.readDataPoints(IDS)

      expect(transport.readInputRegisters.mock.calls).toEqual([
        [0x00, 20],
        [0x2a, 14],
        [0x100, 2],
      ])
      expect(result).toEqual(Object.fromEntries(VERIFIED.map(([id, , , , value]) => [id, value])))
    })

    it('should read only the blocks of the requested data points', async () => {
      const result = await driver.readDataPoints(['total_active_energy', 'frequency'])

      expect(transport.readInputRegisters.mock.calls).toEqual([
        [0x100, 2],
        [0x2a, 14],
      ])
      expect(result).toEqual({ total_active_energy: 1.5, frequency: 50 })
    })

    it('should make one request for several data points of one block', async () => {
      await driver.readDataPoints(['voltage', 'current', 'active_power'])

      expect(transport.readInputRegisters.mock.calls).toEqual([[0x00, 20]])
    })

    it('should make no request for an empty list', async () => {
      expect(await driver.readDataPoints([])).toEqual({})
      expect(transport.readInputRegisters).not.toHaveBeenCalled()
    })

    it('should throw for unknown data points before any request', async () => {
      await expect(driver.readDataPoints(['voltage', 'nope', 'bad'])).rejects.toThrow(
        'Unknown data points: nope, bad'
      )
      expect(transport.readInputRegisters).not.toHaveBeenCalled()
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
