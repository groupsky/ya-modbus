import type { Transport } from '@ya-modbus/driver-types'

import type { ModbusError } from './normalize-error.js'
import { formatSerialSettings, withRequestContext } from './request-context.js'

const LABEL = '/dev/ttyUSB0 9600 8E1, slave 7'

function failingTransport(error: unknown): jest.Mocked<Transport> {
  const fail = jest.fn().mockRejectedValue(error)
  return {
    readHoldingRegisters: fail,
    readInputRegisters: fail,
    readCoils: fail,
    readDiscreteInputs: fail,
    writeSingleRegister: fail,
    writeMultipleRegisters: fail,
    writeSingleCoil: fail,
    writeMultipleCoils: fail,
    close: jest.fn().mockResolvedValue(undefined),
  }
}

describe('withRequestContext', () => {
  const cases: Array<[string, (t: Transport) => Promise<unknown>, string]> = [
    ['readCoils', (t) => t.readCoils(5, 8), 'FC01 read coils, address 5 (0x0005), count 8'],
    [
      'readDiscreteInputs',
      (t) => t.readDiscreteInputs(5, 8),
      'FC02 read discrete inputs, address 5 (0x0005), count 8',
    ],
    [
      'readHoldingRegisters',
      (t) => t.readHoldingRegisters(255, 10),
      'FC03 read holding registers, address 255 (0x00FF), count 10',
    ],
    [
      'readInputRegisters',
      (t) => t.readInputRegisters(0, 2),
      'FC04 read input registers, address 0 (0x0000), count 2',
    ],
    [
      'writeSingleCoil',
      (t) => t.writeSingleCoil(3, true),
      'FC05 write single coil, address 3 (0x0003), count 1',
    ],
    [
      'writeSingleRegister',
      (t) => t.writeSingleRegister(3, 9),
      'FC06 write single register, address 3 (0x0003), count 1',
    ],
    [
      'writeMultipleCoils',
      (t) => t.writeMultipleCoils(3, Buffer.from([1, 0])),
      'FC15 write multiple coils, address 3 (0x0003), count 16',
    ],
    [
      'writeMultipleRegisters',
      (t) => t.writeMultipleRegisters(3, Buffer.from([0, 1, 0, 2, 0, 3])),
      'FC16 write multiple registers, address 3 (0x0003), count 3',
    ],
  ]

  test.each(cases)(
    'names function, address and count of a failed %s',
    async (_name, call, text) => {
      const transport = withRequestContext(failingTransport(new Error('Timed out')), LABEL)

      await expect(call(transport)).rejects.toThrow(`Timed out (${LABEL}, ${text})`)
    }
  )

  test('passes results and close through', async () => {
    const inner = failingTransport(new Error('x'))
    inner.readCoils.mockResolvedValue(Buffer.from([1]))
    const transport = withRequestContext(inner, LABEL)

    await expect(transport.readCoils(0, 1)).resolves.toEqual(Buffer.from([1]))
    await transport.close()
    expect(inner.close).toHaveBeenCalledTimes(1)
  })

  test('keeps name, code, errno, modbusCode and cause, and starts the stack with the new message', async () => {
    const cause = new Error('root')
    const error: ModbusError = new RangeError('Illegal data address', { cause })
    error.code = 'EFOO'
    error.errno = 'EBAR'
    error.modbusCode = 2
    const transport = withRequestContext(failingTransport(error), LABEL)

    const thrown = (await transport.readCoils(1, 1).catch((e: unknown) => e)) as ModbusError

    expect(thrown).not.toBe(error)
    expect(thrown).toMatchObject({ name: 'RangeError', code: 'EFOO', errno: 'EBAR', modbusCode: 2 })
    expect(thrown.cause).toBe(cause)
    expect(thrown.message).toBe(
      `Illegal data address (${LABEL}, FC01 read coils, address 1 (0x0001), count 1)`
    )
    expect(thrown.stack).toContain(`RangeError: ${thrown.message}`)
  })

  test('keeps $ patterns of the message as they are in the stack, and has no own cause without one', async () => {
    const error = new Error('cost $& 5')
    const transport = withRequestContext(failingTransport(error), LABEL)

    const thrown = (await transport.readCoils(1, 1).catch((e: unknown) => e)) as ModbusError

    expect(thrown.stack).toContain('Error: cost $& 5 (')
    expect(Object.hasOwn(thrown, 'cause')).toBe(false)
  })

  test('sets the message when the error has an own enumerable message', async () => {
    const error = Object.assign(new Error('x'), { message: 'Timed out' })
    const transport = withRequestContext(failingTransport(error), LABEL)

    await expect(transport.readCoils(1, 1)).rejects.toThrow('Timed out (')
  })

  test('does not change an error that is shared by all requests', async () => {
    const shared: ModbusError = new Error('Connection lost: port closed')
    shared.name = 'ConnectionLostError'
    const transport = withRequestContext(failingTransport(shared), LABEL)

    const first = await transport.readCoils(1, 1).catch((e: unknown) => e)
    const second = await transport.readInputRegisters(2, 2).catch((e: unknown) => e)

    expect(shared.message).toBe('Connection lost: port closed')
    expect((first as Error).name).toBe('ConnectionLostError')
    expect((second as Error).message).toBe(
      `Connection lost: port closed (${LABEL}, FC04 read input registers, address 2 (0x0002), count 2)`
    )
  })

  test('wraps values that are not errors', async () => {
    const transport = withRequestContext(failingTransport('boom'), LABEL)

    await expect(transport.readCoils(1, 1)).rejects.toThrow('boom (')
  })
})

describe('formatSerialSettings', () => {
  test('gives the short form', () => {
    expect(formatSerialSettings({ baudRate: 9600, dataBits: 8, parity: 'even', stopBits: 1 })).toBe(
      '9600 8E1'
    )
    expect(
      formatSerialSettings({ baudRate: 19200, dataBits: 8, parity: 'none', stopBits: 2 })
    ).toBe('19200 8N2')
  })

  test('uses only what is present', () => {
    expect(formatSerialSettings({ baudRate: 9600, parity: 'odd' })).toBe('9600 O')
    expect(formatSerialSettings({})).toBe('')
  })
})
