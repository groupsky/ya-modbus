/**
 * Tests for the Microsyst SR04 driver with a mocked transport
 */

import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'

import { createDriver, DEFAULT_CONFIG, SUPPORTED_CONFIG } from './index'

/** Mocked device: every holding register reads as its own address, every coil as on */
function createMockTransport(): jest.Mocked<Transport> {
  return {
    readHoldingRegisters: jest.fn((address: number, count: number) => {
      const buffer = Buffer.alloc(count * 2)
      for (let i = 0; i < count; i++) buffer.writeUInt16BE(address + i, i * 2)
      return Promise.resolve(buffer)
    }),
    readInputRegisters: jest.fn(),
    readCoils: jest.fn((_address: number, count: number) =>
      Promise.resolve(Buffer.alloc(Math.ceil(count / 8), 0xff))
    ),
    readDiscreteInputs: jest.fn(),
    writeSingleRegister: jest.fn(() => Promise.resolve()),
    writeMultipleRegisters: jest.fn(),
    writeSingleCoil: jest.fn(),
    writeMultipleCoils: jest.fn(),
    close: jest.fn(),
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
      validBaudRates: [9600, 19200],
      validParity: ['none', 'even'],
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
  let ids: string[]

  beforeEach(async () => {
    transport = createMockTransport()
    driver = await createDriver({ transport, slaveId: 1 })
    ids = driver.dataPoints.map((dp) => dp.id)
  })

  it('should identify the device', () => {
    expect(driver.name).toBe('SR04')
    expect(driver.manufacturer).toBe('Microsyst')
    expect(driver.model).toBe('SR04')
  })

  describe('data points', () => {
    it('should have unique snake_case ids', () => {
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/)
    })

    it('should make only the clock writable', () => {
      const writable = driver.dataPoints.filter((dp) => dp.access !== 'r').map((dp) => dp.id)
      expect(writable).toEqual(['clock'])
    })

    it('should read the settings once and the rest on every poll', () => {
      const statics = driver.dataPoints.filter((dp) => dp.pollType === 'static')
      expect(statics.map((dp) => dp.id)).toContain('heater_setpoint')
      expect(statics.map((dp) => dp.id)).toContain('parity')
      expect(statics.map((dp) => dp.id)).not.toContain('t1_temperature')
      expect(driver.dataPoints.find((dp) => dp.id === 'clock')?.pollType).toBe('dynamic')
    })
  })

  describe('readDataPoints', () => {
    it('should make the same 8 requests as the old reader for all data points', async () => {
      await driver.readDataPoints(ids)

      expect(transport.readCoils.mock.calls.sort()).toEqual([
        [1000, 4],
        [2864, 40],
        [296, 64],
      ])
      expect(transport.readHoldingRegisters.mock.calls.sort((a, b) => a[0] - b[0])).toEqual([
        [0, 35],
        [35, 14],
        [127, 1],
        [557, 11],
        [1024, 4],
      ])
    })

    it('should decode signed settings, tenths and the byte of the sensor error', async () => {
      transport.readHoldingRegisters.mockImplementation((address, count) => {
        const buffer = Buffer.alloc(count * 2)
        if (address === 0) {
          buffer.writeInt16BE(-20, 25 * 2)
          buffer.writeInt16BE(35, 28 * 2)
        }
        if (address === 557) {
          buffer.writeUInt16BE(0xab12, 0)
          buffer.writeInt16BE(-3, 1 * 2)
          buffer.writeInt16BE(-55, 3 * 2)
          buffer.writeInt16BE(2070, 4 * 2)
        }
        return Promise.resolve(buffer)
      })

      expect(
        await driver.readDataPoints([
          'freeze',
          'hysteresis',
          'sensor_error',
          'adc2',
          't1_temperature',
          't2_temperature',
        ])
      ).toEqual({
        freeze: -20,
        hysteresis: 3.5,
        sensor_error: 0x12,
        adc2: -3,
        t1_temperature: -5.5,
        t2_temperature: null,
      })
    })

    it.each([
      [0x00, { stop_bits: 1, parity: 'none', baud_rate: 9600, broadcast: true }],
      [0x0f, { stop_bits: 2, parity: 'even', baud_rate: 19200, broadcast: false }],
      [0x08, { stop_bits: 1, parity: 'none', baud_rate: 9600, broadcast: false }],
      [0x02, { stop_bits: 1, parity: 'even', baud_rate: 9600, broadcast: true }],
    ])('should decode serial setting coils 0x%s', async (bits, expected) => {
      transport.readCoils.mockResolvedValue(Buffer.from([bits]))

      expect(
        await driver.readDataPoints(['stop_bits', 'parity', 'baud_rate', 'broadcast'])
      ).toEqual(expected)
    })

    it('should read each coil from its own bit', async () => {
      // Coil 2865 (FAST) is bit 1 of byte 0, coils 2896.. (P1..P8) are byte 4
      transport.readCoils.mockResolvedValue(Buffer.from([0x02, 0, 0, 0, 0b10000101]))

      expect(
        await driver.readDataPoints(['fast', 'output_p1', 'output_p2', 'output_p3', 'output_p8'])
      ).toEqual({ fast: true, output_p1: true, output_p2: false, output_p3: true, output_p8: true })
    })

    it('should make one request for several data points of one block', async () => {
      await driver.readDataPoints(['t1_temperature', 't8_temperature', 'sensor_error'])

      expect(transport.readHoldingRegisters.mock.calls).toEqual([[557, 11]])
      expect(transport.readCoils).not.toHaveBeenCalled()
    })

    it('should make no request for an empty list', async () => {
      expect(await driver.readDataPoints([])).toEqual({})
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
    })

    it('should throw for unknown data points before any request', async () => {
      await expect(driver.readDataPoints(['clock', 'nope', 'bad'])).rejects.toThrow(
        'Unknown data points: nope, bad'
      )
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
    })
  })

  describe('readDataPoint', () => {
    it('should read one data point', async () => {
      // Register 127 reads as 127 in the mock
      expect(await driver.readDataPoint('address')).toBe(127)
      expect(transport.readHoldingRegisters.mock.calls).toEqual([[127, 1]])
    })

    it('should throw for an unknown data point', async () => {
      await expect(driver.readDataPoint('nope')).rejects.toThrow('Unknown data point: nope')
    })
  })

  describe('writeDataPoint', () => {
    it('should read 1027 and then write the clock registers one by one, seconds first', async () => {
      transport.readHoldingRegisters.mockResolvedValue(Buffer.from([0x99, 0x5a]))

      await driver.writeDataPoint('clock', '2026-10-20T14:28:12')

      expect(transport.readHoldingRegisters.mock.calls).toEqual([[1027, 1]])
      expect(transport.writeSingleRegister.mock.calls).toEqual([
        [1024, 0x1228],
        [1025, 0x1403],
        [1026, 0x2010],
        [1027, 0x265a],
      ])
      expect(transport.writeMultipleRegisters).not.toHaveBeenCalled()
    })

    it('should write nothing for a wrong clock', async () => {
      await expect(driver.writeDataPoint('clock', '2026-02-30T00:00:00')).rejects.toThrow(
        'Invalid clock'
      )
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
      expect(transport.writeSingleRegister).not.toHaveBeenCalled()
    })

    it.each(['t1_temperature', 'heater_setpoint', 'parity', 'clock_week_day'])(
      'should reject a write to %s',
      async (id) => {
        await expect(driver.writeDataPoint(id, 1)).rejects.toThrow(`Data point ${id} is read-only`)
        expect(transport.writeSingleRegister).not.toHaveBeenCalled()
      }
    )

    it('should throw for an unknown data point', async () => {
      await expect(driver.writeDataPoint('nope', 1)).rejects.toThrow('Unknown data point: nope')
    })
  })
})
