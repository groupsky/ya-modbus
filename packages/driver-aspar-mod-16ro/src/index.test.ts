/**
 * Tests for the Aspar MOD-16RO driver with a mocked transport
 */

import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'

import { createDriver, DEFAULT_CONFIG, SUPPORTED_CONFIG } from './index'

/** Registers of a mocked module by function code; registers not set read as 0 */
interface Memory {
  holding: Map<number, number>
  input: Map<number, number>
}

function createMockTransport(memory: Memory): jest.Mocked<Transport> {
  const reader =
    (registers: Map<number, number>) =>
    (address: number, count: number): Promise<Buffer> => {
      const buffer = Buffer.alloc(count * 2)
      for (let i = 0; i < count; i++) {
        buffer.writeUInt16BE(registers.get(address + i) ?? 0, i * 2)
      }
      return Promise.resolve(buffer)
    }
  return {
    readHoldingRegisters: jest.fn(reader(memory.holding)),
    readInputRegisters: jest.fn(reader(memory.input)),
    readCoils: jest.fn(),
    readDiscreteInputs: jest.fn(),
    writeSingleRegister: jest.fn(),
    writeMultipleRegisters: jest.fn(),
    writeSingleCoil: jest.fn().mockResolvedValue(undefined),
    writeMultipleCoils: jest.fn(),
  } as unknown as jest.Mocked<Transport>
}

const OUTPUT_IDS = Array.from({ length: 16 }, (_, i) => `output_${i + 1}`)

const STATIC_IDS = [
  'firmware_version',
  'module_type',
  'switches',
  'baud_rate',
  'data_bits',
  'stop_bits',
  'parity',
  'response_delay_ms',
  'modbus_mode',
  'watchdog_ms',
  'default_output_state',
]

const DYNAMIC_IDS = [
  'received_packets',
  'incorrect_packets',
  'sent_packets',
  'outputs',
  ...OUTPUT_IDS,
]

const ALL_IDS = [...STATIC_IDS, ...DYNAMIC_IDS]

/** A module with a different value in each register */
function mod16ro(): Memory {
  const holding = new Map<number, number>([
    [0x00, 0x0c07], // firmware 1.2, type 7
    [0x01, 0x0013], // switches
  ])
  const input = new Map<number, number>([
    [0x02, 6], // 115200
    [0x03, 0x0801], // 8 data bits, 1 stop bit
    [0x04, 2], // even
    [0x05, 3], // 3 ms
    [0x06, 0], // RTU
    [0x08, 1500], // 1.5 s
    [0x0c, 0x00f0],
    [0x20, 0x5678],
    [0x21, 0x0012], // 0x125678
    [0x22, 0x0003],
    [0x23, 0x0000],
    [0x24, 0xfffe],
    [0x25, 0xffff], // 0xfffffffe
    [0x33, 0x8101], // outputs 1, 9 and 16
  ])
  return { holding, input }
}

describe('Configuration Constants', () => {
  it('should export the factory defaults', () => {
    expect(DEFAULT_CONFIG).toEqual({
      baudRate: 19200,
      parity: 'none',
      dataBits: 8,
      stopBits: 1,
      defaultAddress: 1,
    })
  })

  it('should export the supported serial settings', () => {
    expect(SUPPORTED_CONFIG).toEqual({
      validBaudRates: [2400, 4800, 9600, 19200, 38400, 57600, 115200],
      validParity: ['none', 'odd', 'even'],
      validDataBits: [7, 8],
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
  let memory: Memory
  let transport: jest.Mocked<Transport>
  let driver: DeviceDriver

  beforeEach(async () => {
    memory = mod16ro()
    transport = createMockTransport(memory)
    driver = await createDriver({ transport, slaveId: 1 })
  })

  it('should identify the device', () => {
    expect(driver.name).toBe('MOD-16RO')
    expect(driver.manufacturer).toBe('Aspar')
    expect(driver.model).toBe('MOD-16RO')
  })

  describe('data points', () => {
    it('should list every data point once', () => {
      expect(driver.dataPoints.map((dp) => dp.id)).toEqual(ALL_IDS)
      expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length)
    })

    it('should make only the outputs writable', () => {
      const writable = driver.dataPoints.filter((dp) => dp.access !== 'r').map((dp) => dp.id)
      expect(writable).toEqual(OUTPUT_IDS)
      expect(driver.dataPoints.filter((dp) => dp.access === 'rw')).toHaveLength(16)
    })

    it('should read identity and settings once, and the rest on every poll', () => {
      const dynamic = driver.dataPoints.filter((dp) => dp.pollType !== 'static').map((dp) => dp.id)
      expect(dynamic).toEqual(DYNAMIC_IDS)
    })
  })

  describe('decoding', () => {
    it('should read every data point', async () => {
      expect(await driver.readDataPoints(ALL_IDS)).toEqual({
        firmware_version: 1.2,
        module_type: 7,
        switches: 0x13,
        baud_rate: 115200,
        data_bits: 8,
        stop_bits: 1,
        parity: 'even',
        response_delay_ms: 3,
        modbus_mode: 'RTU',
        watchdog_ms: 1500,
        default_output_state: 0xf0,
        received_packets: 0x125678,
        incorrect_packets: 3,
        sent_packets: 0xfffffffe,
        outputs: 0x8101,
        ...Object.fromEntries(OUTPUT_IDS.map((id) => [id, false])),
        output_1: true,
        output_9: true,
        output_16: true,
      })
    })

    it.each([
      [0, 2400],
      [1, 4800],
      [2, 9600],
      [3, 19200],
      [4, 38400],
      [5, 57600],
      [1440, 14400],
    ])('should read baud code %s as %s', async (code, baud) => {
      memory.input.set(0x02, code)
      expect(await driver.readDataPoint('baud_rate')).toBe(baud)
    })

    it.each([
      [0, 'none'],
      [1, 'odd'],
      [3, 'mark'],
      [4, 'space'],
      [5, null],
    ])('should read parity code %s as %s', async (code, parity) => {
      memory.input.set(0x04, code)
      expect(await driver.readDataPoint('parity')).toBe(parity)
    })

    it.each([
      [1, 'ASCII'],
      [2, null],
    ])('should read Modbus mode %s as %s', async (code, mode) => {
      memory.input.set(0x06, code)
      expect(await driver.readDataPoint('modbus_mode')).toBe(mode)
    })

    it('should read 7 data bits and 2 stop bits', async () => {
      memory.input.set(0x03, 0x0702)
      expect(await driver.readDataPoints(['data_bits', 'stop_bits'])).toEqual({
        data_bits: 7,
        stop_bits: 2,
      })
    })

    it.each(OUTPUT_IDS.map((id, bit) => [id, bit]))(
      'should read %s from bit %d of the outputs register',
      async (id, bit) => {
        memory.input.set(0x33, 1 << bit)
        const values = await driver.readDataPoints(OUTPUT_IDS)
        expect(Object.keys(values).filter((key) => values[key] === true)).toEqual([id])
      }
    )
  })

  describe('requests', () => {
    it('should read everything in 4 requests, the same as the old reader', async () => {
      await driver.readDataPoints(ALL_IDS)

      expect(transport.readHoldingRegisters.mock.calls).toEqual([[0x00, 2]])
      expect(transport.readInputRegisters.mock.calls).toEqual([
        [0x02, 11],
        [0x20, 6],
        [0x33, 1],
      ])
    })

    it('should read a poll in 2 requests', async () => {
      await driver.readDataPoints(DYNAMIC_IDS)

      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
      expect(transport.readInputRegisters.mock.calls).toEqual([
        [0x20, 6],
        [0x33, 1],
      ])
    })

    it('should read one data point with one request', async () => {
      expect(await driver.readDataPoint('watchdog_ms')).toBe(1500)
      expect(transport.readInputRegisters.mock.calls).toEqual([[0x02, 11]])
    })
  })

  describe('writes', () => {
    it.each(OUTPUT_IDS.map((id, bit) => [id, 0x330 + bit]))(
      'should write %s to coil %d',
      async (id, coil) => {
        await driver.writeDataPoint(id, true)
        await driver.writeDataPoint(id, false)

        expect(transport.writeSingleCoil.mock.calls).toEqual([
          [coil, true],
          [coil, false],
        ])
      }
    )

    it.each([1, 0, 'true', 'on', null, undefined])(
      'should not write the value %p to an output',
      async (value) => {
        await expect(driver.writeDataPoint('output_1', value)).rejects.toThrow(
          'Invalid value for output_1: expected true or false'
        )
        expect(transport.writeSingleCoil).not.toHaveBeenCalled()
      }
    )

    it.each(['outputs', 'watchdog_ms', 'baud_rate', 'received_packets'])(
      'should not write the read-only %s',
      async (id) => {
        await expect(driver.writeDataPoint(id, 0)).rejects.toThrow(`Data point ${id} is read-only`)
        expect(transport.writeSingleCoil).not.toHaveBeenCalled()
        expect(transport.writeSingleRegister).not.toHaveBeenCalled()
        expect(transport.writeMultipleRegisters).not.toHaveBeenCalled()
      }
    )

    it('should not write an unknown data point', async () => {
      await expect(driver.writeDataPoint('out0', true)).rejects.toThrow('Unknown data point: out0')
    })

    it('should pass on a transport error', async () => {
      transport.writeSingleCoil.mockRejectedValueOnce(new Error('Illegal data address'))
      await expect(driver.writeDataPoint('output_2', true)).rejects.toThrow('Illegal data address')
    })
  })

  describe('errors', () => {
    it('should reject unknown data points before any request', async () => {
      await expect(driver.readDataPoints(['outputs', 'nope', 'other'])).rejects.toThrow(
        'Unknown data points: nope, other'
      )
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
      expect(transport.readInputRegisters).not.toHaveBeenCalled()
    })

    it('should reject an unknown data point', async () => {
      await expect(driver.readDataPoint('nope')).rejects.toThrow('Unknown data point: nope')
    })

    it('should pass on a transport error', async () => {
      transport.readInputRegisters.mockRejectedValueOnce(new Error('Timed out'))
      await expect(driver.readDataPoint('outputs')).rejects.toThrow('Timed out')
    })
  })
})
