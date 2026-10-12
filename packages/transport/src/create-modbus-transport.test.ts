import { EventEmitter } from 'node:events'

import ModbusRTU from 'modbus-serial'

import { createModbusTransport } from './create-modbus-transport.js'

// These tests use the real modbus-serial client so the rejected values have
// the shapes the library produces (plain objects that do not extend Error).

/** Serial port that accepts writes but never answers */
class SilentPort extends EventEmitter {
  isOpen = true
  write = jest.fn()
}

test.each([
  {
    situation: 'the device does not answer',
    createClient: () => {
      const client = new ModbusRTU(new SilentPort())
      client.setTimeout(10)
      return client
    },
    expected: { name: 'TransactionTimedOutError', message: 'Timed out', errno: 'ETIMEDOUT' },
  },
  {
    situation: 'the port is not open',
    createClient: () => new ModbusRTU(),
    expected: { name: 'PortNotOpenError', message: 'Port Not Open', errno: 'ECONNREFUSED' },
  },
])('rejects with an Error that keeps errno when $situation', async ({ createClient, expected }) => {
  const transport = createModbusTransport(createClient(), 1)

  const error = await transport.readHoldingRegisters(0, 1).catch((err: unknown) => err)

  expect(error).toBeInstanceOf(Error)
  expect(error).toMatchObject(expected)
})
