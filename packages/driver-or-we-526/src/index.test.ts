/**
 * Tests for the ORNO OR-WE-526 driver with a mocked transport
 */

import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'

import { createDriver, DEFAULT_CONFIG, SUPPORTED_CONFIG } from './index'

/** Holding registers of a mocked meter; registers not set read as 0 */
type Memory = Map<number, number>

const set16 = (memory: Memory, address: number, value: number): void => {
  memory.set(address, value & 0xffff)
}

/** 32-bit value, high word first */
const set32 = (memory: Memory, address: number, value: number): void => {
  set16(memory, address, (value >>> 16) & 0xffff)
  set16(memory, address + 1, value & 0xffff)
}

function createMockTransport(memory: Memory): jest.Mocked<Transport> {
  const read = (address: number, count: number): Promise<Buffer> => {
    const buffer = Buffer.alloc(count * 2)
    for (let i = 0; i < count; i++) {
      buffer.writeUInt16BE(memory.get(address + i) ?? 0, i * 2)
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

const TARIFFS = ['', '_t1', '_t2', '_t3', '_t4']

/** id and first register of each energy group, from the register list */
const ENERGY_GROUPS: ReadonlyArray<readonly [string, number]> = [
  ['active_energy_forward', 0x10e],
  ['active_energy_reverse', 0x118],
  ['active_energy_total', 0x122],
  ['reactive_energy_forward', 0x12c],
  ['reactive_energy_reverse', 0x136],
  ['reactive_energy_total', 0x140],
  ['reactive_energy_q1', 0x14a],
  ['reactive_energy_q2', 0x154],
  ['reactive_energy_q3', 0x15e],
  ['reactive_energy_q4', 0x168],
]

/** Each 2-register energy value with its register */
const ENERGY: ReadonlyArray<readonly [string, number]> = [
  ...ENERGY_GROUPS.flatMap(([id, first]) =>
    TARIFFS.map((suffix, i) => [`${id}${suffix}`, first + i * 2] as const)
  ),
  ['active_energy_resettable', 0x172],
  ['reactive_energy_resettable', 0x174],
]

const DEMAND: ReadonlyArray<readonly [string, number]> = [
  ['active_power_demand_forward', 0x176],
  ['active_power_demand_forward_max', 0x178],
  ['active_power_demand_reverse', 0x17a],
  ['active_power_demand_reverse_max', 0x17c],
  ['reactive_power_demand_forward', 0x180],
  ['reactive_power_demand_forward_max', 0x182],
  ['reactive_power_demand_reverse', 0x184],
  ['reactive_power_demand_reverse_max', 0x186],
]

const OTHER_IDS = [
  'serial_number',
  'device_address',
  'software_version',
  'hardware_version',
  'firmware_checksum',
  'clock',
  'scroll_time',
  'baud_rate',
  'parity',
  'stop_bits',
  'combined_code',
  'demand_mode',
  'demand_cycle',
  'display_mode',
  'password',
  'running_time',
  'startup_current',
]

const INSTANT_IDS = [
  'voltage',
  'current',
  'active_power',
  'apparent_power',
  'reactive_power',
  'frequency',
  'power_factor',
]

const ALL_IDS = [
  ...INSTANT_IDS,
  ...ENERGY.map(([id]) => id),
  ...DEMAND.map(([id]) => id),
  ...OTHER_IDS,
]

/** A meter with a different value in each register */
function meter(): Memory {
  const memory: Memory = new Map()
  set32(memory, 0x100, 230123) // 230.123 V
  set32(memory, 0x102, 12345) // 12.345 A
  set32(memory, 0x104, -2800) // W, reverse
  set32(memory, 0x106, 2841) // VA
  set32(memory, 0x108, 480) // VAr
  set16(memory, 0x10a, 499) // 49.9 Hz
  set16(memory, 0x10b, -985) // -0.985
  ENERGY.forEach(([, register], i) => set32(memory, register, 100000 + i * 101))
  DEMAND.forEach(([, register], i) => set32(memory, register, 20000 + i * 11))
  // Serial 012345678910, address 1, FW 101, HW 3, checksum 0xBEEF
  ;[0x0123, 0x4567, 0x8910, 1, 101, 3, 0xbeef].forEach((v, i) => set16(memory, 0x1000 + i, v))
  // Clock 2026-11-03 (Tuesday) 14:05:09, scrolling time 5 s
  ;[0x0026, 0x1103, 0x0214, 0x0509, 5].forEach((v, i) => set16(memory, 0x1007 + i, v))
  // 9600, no parity, 1 stop bit, forward+reverse, slip, 15 min, display bits, password 0042
  ;[6, 0, 1, 3, 1, 15, 0x0001, 0x23ff, 0, 0xabcd, 42].forEach((v, i) =>
    set16(memory, 0x100c + i, v)
  )
  set32(memory, 0x1018, 123456)
  set32(memory, 0x101a, 120000) // 120 A
  return memory
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
      validBaudRates: [9600, 19200, 38400, 115200],
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
  let memory: Memory
  let transport: jest.Mocked<Transport>
  let driver: DeviceDriver

  beforeEach(async () => {
    memory = meter()
    transport = createMockTransport(memory)
    driver = await createDriver({ transport, slaveId: 1 })
  })

  it('should identify the device', () => {
    expect(driver.name).toBe('OR-WE-526')
    expect(driver.manufacturer).toBe('ORNO')
    expect(driver.model).toBe('OR-WE-526')
  })

  describe('data points', () => {
    it('should list every data point once', () => {
      expect(driver.dataPoints.map((dp) => dp.id)).toEqual(ALL_IDS)
      expect(new Set(ALL_IDS).size).toBe(ALL_IDS.length)
    })

    it('should make every data point read-only', () => {
      expect(driver.dataPoints.every((dp) => dp.access === 'r')).toBe(true)
    })

    it('should read identity and settings once, and the rest on every poll', () => {
      const dynamic = driver.dataPoints.filter((dp) => dp.pollType !== 'static').map((dp) => dp.id)
      expect(dynamic).toEqual([
        ...INSTANT_IDS,
        ...ENERGY.map(([id]) => id),
        ...DEMAND.map(([id]) => id),
        'clock',
        'running_time',
      ])
    })

    it('should give energy in kWh and kVArh, demand in W and VAr', () => {
      const unit = (id: string): string | undefined =>
        driver.dataPoints.find((dp) => dp.id === id)?.unit
      expect(unit('active_energy_reverse_t3')).toBe('kWh')
      expect(unit('reactive_energy_q4_t2')).toBe('kVArh')
      expect(unit('active_power_demand_reverse_max')).toBe('W')
      expect(unit('reactive_power_demand_forward')).toBe('VAr')
    })
  })

  describe('decoding', () => {
    it('should scale the instant values', async () => {
      expect(await driver.readDataPoints(INSTANT_IDS)).toEqual({
        voltage: 230.123,
        current: 12.345,
        active_power: -2800,
        apparent_power: 2841,
        reactive_power: 480,
        frequency: 49.9,
        power_factor: -0.985,
      })
    })

    it.each(ENERGY.map(([id, register], i) => [id, register, i]))(
      'should read %s (register %d) in hundredths',
      async (id, _register, i) => {
        expect(await driver.readDataPoint(id)).toBe((100000 + i * 101) / 100)
      }
    )

    it.each(DEMAND.map(([id, register], i) => [id, register, i]))(
      'should read %s (register %d) in tenths',
      async (id, _register, i) => {
        expect(await driver.readDataPoint(id)).toBe((20000 + i * 11) / 10)
      }
    )

    it('should read negative 32-bit values high word first', async () => {
      set32(memory, 0x100, -1)
      set32(memory, 0x118, -12345)
      expect(await driver.readDataPoints(['voltage', 'active_energy_reverse'])).toEqual({
        voltage: -0.001,
        active_energy_reverse: -123.45,
      })
    })

    it('should read identity, clock and settings', async () => {
      expect(await driver.readDataPoints(OTHER_IDS)).toEqual({
        serial_number: '012345678910',
        device_address: 1,
        software_version: 101,
        hardware_version: 3,
        firmware_checksum: 0xbeef,
        clock: '2026-11-03T14:05:09',
        scroll_time: 5,
        baud_rate: 9600,
        parity: 'none',
        stop_bits: 1,
        combined_code: 'forward+reverse',
        demand_mode: 'slip',
        demand_cycle: 15,
        display_mode: '000123ff0000abcd',
        password: '0042',
        running_time: 123456,
        startup_current: 120,
      })
    })

    it.each([
      [7, 19200],
      [8, 38400],
      [9, 115200],
      [5, null],
    ])('should read baud code %s as %s', async (code, baud) => {
      set16(memory, 0x100c, code)
      expect(await driver.readDataPoint('baud_rate')).toBe(baud)
    })

    it.each([
      [1, 'odd'],
      [2, 'even'],
      [3, null],
    ])('should read parity code %s as %s', async (code, parity) => {
      set16(memory, 0x100d, code)
      expect(await driver.readDataPoint('parity')).toBe(parity)
    })

    it.each([
      [1, 'forward'],
      [2, 'reverse'],
      [4, 'forward-reverse'],
      [0, null],
    ])('should read combined code %s as %s', async (code, value) => {
      set16(memory, 0x100f, code)
      expect(await driver.readDataPoint('combined_code')).toBe(value)
    })

    it.each([
      [0, 'interval'],
      [2, null],
    ])('should read demand mode %s as %s', async (code, value) => {
      set16(memory, 0x1010, code)
      expect(await driver.readDataPoint('demand_mode')).toBe(value)
    })
  })

  describe('requests', () => {
    it('should read everything in 8 requests', async () => {
      await driver.readDataPoints(ALL_IDS)

      expect(transport.readHoldingRegisters.mock.calls).toEqual([
        [0x100, 12],
        [0x10e, 60],
        [0x14a, 44],
        [0x176, 18],
        [0x1000, 7],
        [0x1007, 5],
        [0x100c, 11],
        [0x1018, 4],
      ])
    })

    it('should read only the block of the asked data points, once', async () => {
      await driver.readDataPoints([
        'reactive_power_demand_reverse_max',
        'active_power_demand_forward',
      ])

      expect(transport.readHoldingRegisters.mock.calls).toEqual([[0x176, 18]])
    })

    it('should read one data point with one request', async () => {
      expect(await driver.readDataPoint('scroll_time')).toBe(5)
      expect(transport.readHoldingRegisters.mock.calls).toEqual([[0x1007, 5]])
    })
  })

  describe('errors', () => {
    it('should reject unknown data points before any request', async () => {
      await expect(driver.readDataPoints(['voltage', 'nope', 'other'])).rejects.toThrow(
        'Unknown data points: nope, other'
      )
      expect(transport.readHoldingRegisters).not.toHaveBeenCalled()
    })

    it('should reject an unknown data point', async () => {
      await expect(driver.readDataPoint('nope')).rejects.toThrow('Unknown data point: nope')
    })

    it('should not write a known data point', async () => {
      await expect(driver.writeDataPoint('scroll_time', 10)).rejects.toThrow(
        'Data point scroll_time is read-only'
      )
      expect(transport.writeSingleRegister).not.toHaveBeenCalled()
      expect(transport.writeMultipleRegisters).not.toHaveBeenCalled()
    })

    it('should not write an unknown data point', async () => {
      await expect(driver.writeDataPoint('nope', 1)).rejects.toThrow('Unknown data point: nope')
    })

    it('should pass on a transport error', async () => {
      transport.readHoldingRegisters.mockRejectedValueOnce(new Error('Timed out'))
      await expect(driver.readDataPoint('voltage')).rejects.toThrow('Timed out')
    })
  })
})
