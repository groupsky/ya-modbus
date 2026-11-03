/**
 * Tests for the MBSL32DI driver with a mocked transport
 */

import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'

import { createDriver, DEFAULT_CONFIG, INPUT_COUNT, SUPPORTED_CONFIG } from './index'

/** Holding registers of a mocked module; registers not set read as 0 */
function createMockTransport(holding: Map<number, number>): jest.Mocked<Transport> {
  return {
    readHoldingRegisters: jest.fn((address: number, count: number): Promise<Buffer> => {
      const buffer = Buffer.alloc(count * 2)
      for (let i = 0; i < count; i++) {
        buffer.writeUInt16BE(holding.get(address + i) ?? 0, i * 2)
      }
      return Promise.resolve(buffer)
    }),
    readInputRegisters: jest.fn(),
    readCoils: jest.fn(),
    readDiscreteInputs: jest.fn(),
    writeSingleRegister: jest.fn(),
    writeMultipleRegisters: jest.fn(),
    writeSingleCoil: jest.fn(),
    writeMultipleCoils: jest.fn(),
  } as unknown as jest.Mocked<Transport>
}

const INPUT_IDS = Array.from({ length: 32 }, (_, i) => `input_${i + 1}`)
const ALL_IDS = ['inputs', ...INPUT_IDS]

describe('Configuration Constants', () => {
  it('should export the settings of the real bus as defaults', () => {
    expect(DEFAULT_CONFIG).toEqual({
      baudRate: 115200,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 1,
    })
  })

  it('should export the supported serial settings', () => {
    expect(SUPPORTED_CONFIG).toEqual({
      validBaudRates: [115200],
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

  it('should count 32 inputs', () => {
    expect(INPUT_COUNT).toBe(32)
  })
})

describe('createDriver', () => {
  let holding: Map<number, number>
  let transport: jest.Mocked<Transport>
  let driver: DeviceDriver

  beforeEach(async () => {
    holding = new Map([
      [0x0000, 0x8001], // inputs 1 and 16
      [0x0001, 0x0102], // inputs 18 and 25
    ])
    transport = createMockTransport(holding)
    driver = await createDriver({ transport, slaveId: 1 })
  })

  it('should identify the device', () => {
    expect(driver.name).toBe('MBSL32DI')
    expect(driver.manufacturer).toBe('Dio Smart')
    expect(driver.model).toBe('MBSL32DI')
  })

  describe('data points', () => {
    it('should list every data point once', () => {
      expect(driver.dataPoints.map((dp) => dp.id)).toEqual(ALL_IDS)
      expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length)
    })

    it('should make every data point read-only and read it on every poll', () => {
      expect(driver.dataPoints.every((dp) => dp.access === 'r')).toBe(true)
      expect(driver.dataPoints.some((dp) => dp.pollType === 'static')).toBe(false)
    })
  })

  describe('decoding', () => {
    it('should read every data point', async () => {
      expect(await driver.readDataPoints(ALL_IDS)).toEqual({
        inputs: 0x01028001,
        ...Object.fromEntries(INPUT_IDS.map((id) => [id, false])),
        input_1: true,
        input_16: true,
        input_18: true,
        input_25: true,
      })
    })

    it.each(INPUT_IDS.map((id, bit) => [id, bit]))(
      'should read %s from bit %d of the inputs',
      async (id, bit) => {
        holding.set(0x0000, bit < 16 ? 1 << bit : 0)
        holding.set(0x0001, bit < 16 ? 0 : 1 << (bit - 16))

        const values = await driver.readDataPoints(ALL_IDS)

        expect(values['inputs']).toBe(2 ** bit)
        expect(INPUT_IDS.filter((key) => values[key] === true)).toEqual([id])
      }
    )

    it('should read input 32 as a positive number, unlike the old reader', async () => {
      holding.set(0x0000, 0xffff)
      holding.set(0x0001, 0xffff)

      const values = await driver.readDataPoints(ALL_IDS)

      expect(values['inputs']).toBe(0xffffffff)
      expect(INPUT_IDS.every((id) => values[id] === true)).toBe(true)
    })

    it('should read no input on', async () => {
      holding.clear()

      const values = await driver.readDataPoints(ALL_IDS)

      expect(values['inputs']).toBe(0)
      expect(INPUT_IDS.some((id) => values[id] === true)).toBe(false)
    })
  })

  describe('requests', () => {
    it('should read everything with one request of 2 holding registers', async () => {
      await driver.readDataPoints(ALL_IDS)

      expect(transport.readHoldingRegisters.mock.calls).toEqual([[0x0000, 2]])
      expect(transport.readInputRegisters).not.toHaveBeenCalled()
    })

    it('should read one data point with the same request', async () => {
      expect(await driver.readDataPoint('input_25')).toBe(true)
      expect(transport.readHoldingRegisters.mock.calls).toEqual([[0x0000, 2]])
    })
  })

  describe('writes', () => {
    it.each(ALL_IDS)('should not write the read-only %s', async (id) => {
      await expect(driver.writeDataPoint(id, true)).rejects.toThrow(`Data point ${id} is read-only`)
      expect(transport.writeSingleCoil).not.toHaveBeenCalled()
      expect(transport.writeSingleRegister).not.toHaveBeenCalled()
      expect(transport.writeMultipleRegisters).not.toHaveBeenCalled()
      expect(transport.writeMultipleCoils).not.toHaveBeenCalled()
    })

    it('should not write an unknown data point', async () => {
      await expect(driver.writeDataPoint('output_1', true)).rejects.toThrow(
        'Unknown data point: output_1'
      )
    })
  })

  describe('errors', () => {
    it('should reject unknown data points before any request', async () => {
      await expect(driver.readDataPoints(['inputs', 'nope', 'input_33'])).rejects.toThrow(
        'Unknown data points: nope, input_33'
      )
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
    })

    it('should reject an unknown data point', async () => {
      await expect(driver.readDataPoint('input_0')).rejects.toThrow('Unknown data point: input_0')
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
    })

    it('should pass on a transport error', async () => {
      transport.readHoldingRegisters.mockRejectedValueOnce(new Error('Timed out'))
      await expect(driver.readDataPoint('inputs')).rejects.toThrow('Timed out')
    })
  })
})
