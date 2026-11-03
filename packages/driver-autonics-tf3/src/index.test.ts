import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'

import { createDriver, DEFAULT_CONFIG, SUPPORTED_CONFIG } from './index.js'

const registers = (...values: number[]): Buffer => {
  const buffer = Buffer.alloc(values.length * 2)
  values.forEach((value, i) => buffer.writeUInt16BE(value & 0xffff, i * 2))
  return buffer
}

/** Status block with the given decimal-point register: 13 registers */
const status = (decimal: number, overrides: Record<number, number> = {}): Buffer => {
  const values = new Array<number>(13).fill(0)
  values[12] = decimal
  for (const [index, value] of Object.entries(overrides)) values[Number(index)] = value
  return registers(...values)
}

interface Mock {
  transport: Transport
  readInput: jest.Mock
  readHolding: jest.Mock
  readCoils: jest.Mock
  writeRegister: jest.Mock
  writeCoil: jest.Mock
}

function createMock(options: { statusBlock?: Buffer; delay?: number } = {}): Mock {
  const statusBlock = options.statusBlock ?? status(1)
  const readInput = jest.fn((address: number, count: number) =>
    Promise.resolve(address === 0x03e8 + 12 && count === 1 ? statusBlock.subarray(24) : statusBlock)
  )
  const readHolding = jest.fn((address: number) =>
    Promise.resolve(address === 0x0134 ? registers(options.delay ?? 0) : registers(0, 0))
  )
  const readCoils = jest.fn(() => Promise.resolve(Buffer.from([0b01])))
  const writeRegister = jest.fn(() => Promise.resolve())
  const writeCoil = jest.fn(() => Promise.resolve())
  const transport = {
    readInputRegisters: readInput,
    readHoldingRegisters: readHolding,
    readCoils,
    writeSingleRegister: writeRegister,
    writeSingleCoil: writeCoil,
  } as unknown as Transport
  return { transport, readInput, readHolding, readCoils, writeRegister, writeCoil }
}

async function setup(options?: Parameters<typeof createMock>[0]): Promise<[DeviceDriver, Mock]> {
  const mock = createMock(options)
  return [await createDriver({ transport: mock.transport }), mock]
}

describe('configuration', () => {
  it('defaults to 9600 baud, 8 data bits, odd parity, 1 stop bit', () => {
    expect(DEFAULT_CONFIG).toMatchObject({
      baudRate: 9600,
      dataBits: 8,
      parity: 'odd',
      stopBits: 1,
    })
  })

  it('supports the defaults', () => {
    expect(SUPPORTED_CONFIG.validBaudRates).toContain(DEFAULT_CONFIG.baudRate)
    expect(SUPPORTED_CONFIG.validParity).toContain(DEFAULT_CONFIG.parity)
    expect(SUPPORTED_CONFIG.validDataBits).toContain(DEFAULT_CONFIG.dataBits)
    expect(SUPPORTED_CONFIG.validStopBits).toContain(DEFAULT_CONFIG.stopBits)
    const [min, max] = SUPPORTED_CONFIG.validAddressRange
    expect(DEFAULT_CONFIG.defaultAddress).toBeGreaterThanOrEqual(min)
    expect(DEFAULT_CONFIG.defaultAddress).toBeLessThanOrEqual(max)
  })
})

describe('data points', () => {
  it('has unique ids in lower snake case', async () => {
    const [driver] = await setup()
    const ids = driver.dataPoints.map((point) => point.id)

    expect(new Set(ids).size).toBe(ids.length)
    ids.forEach((id) => expect(id).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/))
  })

  it('does not offer factory reset or the communication setup', async () => {
    const [driver] = await setup()
    const ids = driver.dataPoints.map((point) => point.id).join(' ')

    expect(ids).not.toMatch(/reset|baud|parity|stop_bits|address|response_delay/)
  })

  it('lets only the documented settings be written', async () => {
    const [driver] = await setup()
    const writable = driver.dataPoints.filter((p) => p.access === 'rw').map((p) => p.id)

    expect(writable).toEqual(
      expect.arrayContaining([
        'target_temp',
        'mode',
        'aux_enabled',
        'comp_enabled',
        'defrost_cycle',
      ])
    )
    expect(writable).not.toContain('current_temp')
    expect(writable).not.toContain('model')
  })

  it('gives every enum point a label for each value', async () => {
    const [driver] = await setup()

    driver.dataPoints
      .filter((point) => point.type === 'enum')
      .forEach((point) => expect(Object.keys(point.enumValues ?? {}).length).toBeGreaterThan(1))
  })
})

describe('reading temperatures', () => {
  it('divides by 10 when the decimal-point register is 1', async () => {
    const [driver] = await setup({ statusBlock: status(1, { 0: 215 }) })

    expect(await driver.readDataPoint('current_temp')).toBe(21.5)
  })

  it('does not divide when the decimal-point register is 0', async () => {
    const [driver] = await setup({ statusBlock: status(0, { 0: 215 }) })

    expect(await driver.readDataPoint('current_temp')).toBe(215)
  })

  it('reads signed temperatures below zero', async () => {
    const [driver] = await setup({ statusBlock: status(1, { 8: -35, 9: -1, 10: -32768 }) })

    expect(await driver.readDataPoints(['s1_temp', 's2_temp', 's3_temp'])).toEqual({
      s1_temp: -3.5,
      s2_temp: -0.1,
      s3_temp: -3276.8,
    })
  })

  it('refuses a decimal-point register it does not know', async () => {
    const [driver] = await setup({ statusBlock: status(2) })

    await expect(driver.readDataPoint('current_temp')).rejects.toThrow(/decimal point/i)
  })

  it('reads a setting that is a temperature with the status block for the scale', async () => {
    const [driver, mock] = await setup({ statusBlock: status(0) })

    await driver.readDataPoint('hysteresis')

    expect(mock.readInput).toHaveBeenCalledWith(0x03e8, 13)
    expect(mock.readHolding).toHaveBeenCalledWith(0x0096, 22)
  })
})

describe('reading in groups', () => {
  it('reads one register group once for all its points', async () => {
    const [driver, mock] = await setup()

    await driver.readDataPoints(['target_temp', 'inputs', 'temperature_unit', 'temp_divisor'])

    expect(mock.readInput).toHaveBeenCalledTimes(1)
    expect(mock.readHolding).toHaveBeenCalledTimes(1) // the response delay
  })

  it('does not read the status block for points that are not temperatures', async () => {
    const [driver, mock] = await setup()

    await driver.readDataPoint('defrost_cycle')

    expect(mock.readInput).not.toHaveBeenCalled()
  })

  it('reads the two coils', async () => {
    const [driver] = await setup()

    expect(await driver.readDataPoints(['aux_enabled', 'comp_enabled'])).toEqual({
      aux_enabled: true,
      comp_enabled: false,
    })
  })

  it('rejects an unknown data point', async () => {
    const [driver] = await setup()

    await expect(driver.readDataPoint('nope')).rejects.toThrow('Unknown data point: nope')
  })
})

describe('device information', () => {
  it('reads the product number as an unsigned 32 bit number', async () => {
    const mock = createMock()
    mock.readInput.mockResolvedValue(registers(0x8000, 0x0001, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0))
    const driver = await createDriver({ transport: mock.transport })

    expect(await driver.readDataPoint('product_number')).toBe(0x80000001)
  })

  it('reads the model without padding or NUL characters', async () => {
    const mock = createMock()
    const model = Buffer.alloc(20)
    model.write('TF3\0 ', 0, 'latin1')
    mock.readInput.mockResolvedValue(Buffer.concat([registers(0, 0, 1, 2), model]))
    const driver = await createDriver({ transport: mock.transport })

    expect(await driver.readDataPoint('model')).toBe('TF3')
  })
})

describe('response delay', () => {
  it('reads the delay once and waits that long before each request', async () => {
    const [driver, mock] = await setup({ delay: 30 })

    const started = Date.now()
    await driver.readDataPoint('inputs')
    await driver.readDataPoint('inputs')

    expect(Date.now() - started).toBeGreaterThanOrEqual(55)
    const delayReads = mock.readHolding.mock.calls.filter(([address]) => address === 0x0134)
    expect(delayReads).toHaveLength(1)
  })
})

describe('writing', () => {
  it('writes the target temperature with the scale of the controller, rounded', async () => {
    const [driver, mock] = await setup({ statusBlock: status(1) })

    await driver.writeDataPoint('target_temp', 20.3)

    expect(mock.writeRegister).toHaveBeenCalledWith(0x0000, 203)
  })

  it('writes a negative correction as two complement', async () => {
    const [driver, mock] = await setup({ statusBlock: status(1) })

    await driver.writeDataPoint('input1_correction', -0.5)

    expect(mock.writeRegister).toHaveBeenCalledWith(0x0069, 0xfffb)
  })

  it('writes an unsigned setting and a plain integer setting', async () => {
    const [driver, mock] = await setup({ statusBlock: status(0) })

    await driver.writeDataPoint('hysteresis', 3)
    await driver.writeDataPoint('compressor_startup_delay', 120)

    expect(mock.writeRegister).toHaveBeenCalledWith(0x0097, 3)
    expect(mock.writeRegister).toHaveBeenCalledWith(0x00a4, 120)
  })

  it('writes an enum value and a coil', async () => {
    const [driver, mock] = await setup()

    await driver.writeDataPoint('defrost_method', 3)
    await driver.writeDataPoint('aux_enabled', false)

    expect(mock.writeRegister).toHaveBeenCalledWith(0x00c8, 3)
    expect(mock.writeCoil).toHaveBeenCalledWith(0, false)
  })

  it.each([
    ['current_temp', 20],
    ['model', 'x'],
    ['alarm_delay_after_continuous_operation', 5],
  ])('refuses to write %s', async (id, value) => {
    const [driver, mock] = await setup()

    await expect(driver.writeDataPoint(id, value)).rejects.toThrow(/read-only/)
    expect(mock.writeRegister).not.toHaveBeenCalled()
  })

  it('refuses an unknown data point', async () => {
    const [driver] = await setup()

    await expect(driver.writeDataPoint('nope', 1)).rejects.toThrow('Unknown data point: nope')
  })

  it.each([
    ['target_temp', '20'],
    ['target_temp', Number.NaN],
    ['target_temp', 4000], // 40000 does not fit a signed register
    ['hysteresis', -1],
    ['defrost_cycle', 1.5],
    ['defrost_cycle', 70000],
    ['mode', 2],
    ['mode', 0.5],
  ])('refuses %s = %p and writes nothing', async (id, value) => {
    const [driver, mock] = await setup({ statusBlock: status(1) })

    await expect(driver.writeDataPoint(id, value)).rejects.toThrow(/Invalid value/)
    expect(mock.writeRegister).not.toHaveBeenCalled()
  })

  it('refuses a coil value that is not a boolean', async () => {
    const [driver, mock] = await setup()

    await expect(driver.writeDataPoint('comp_enabled', 1)).rejects.toThrow(/true or false/)
    expect(mock.writeCoil).not.toHaveBeenCalled()
  })

  it('lists the valid enum values in the error', async () => {
    const [driver] = await setup()

    await expect(driver.writeDataPoint('mode', 5)).rejects.toThrow(/valid: 0, 1/)
  })
})
