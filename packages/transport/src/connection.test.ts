import { EventEmitter } from 'node:events'

import type ModbusRTU from 'modbus-serial'

import { ModbusConnection } from './connection.js'

/** Connected modbus-serial client that answers every read with one register */
function createClient(): ModbusRTU & EventEmitter {
  return Object.assign(new EventEmitter(), {
    isOpen: true,
    close: jest.fn((callback: () => void) => callback()),
    readHoldingRegisters: jest.fn(() =>
      Promise.resolve({ data: [1], buffer: Buffer.from([0, 1]) })
    ),
  }) as unknown as ModbusRTU & EventEmitter
}

const read = (client: ModbusRTU): Promise<Buffer> =>
  client.readHoldingRegisters(0, 1).then((result) => result.buffer)

afterEach(() => {
  jest.restoreAllMocks()
})

// Transports without a mutex (createTransport) can send several requests at once
test('opens one client when several requests come while the port opens', async () => {
  let now = 0
  jest.spyOn(performance, 'now').mockImplementation(() => now)
  const lostClient = createClient()
  const newClient = createClient()
  const open = jest.fn(() => Promise.resolve(newClient))
  const connection = new ModbusConnection(lostClient, '/dev/ttyUSB0', open)

  lostClient.emit('close')
  now += 1000

  await expect(Promise.all([connection.run(read), connection.run(read)])).resolves.toEqual([
    Buffer.from([0, 1]),
    Buffer.from([0, 1]),
  ])
  expect(open).toHaveBeenCalledTimes(1)
})

test('works again with a client that its owner opens again', async () => {
  const client = createClient()
  const connection = new ModbusConnection(client)

  client.isOpen = false
  client.emit('close')
  await expect(connection.run(read)).rejects.toThrow('Connection lost: port closed')

  client.isOpen = true
  await expect(connection.run(read)).resolves.toEqual(Buffer.from([0, 1]))
})

// An open client would keep the lock on the serial port, so the reopen would fail
test.each([
  { isOpen: true, closes: 'closes' },
  { isOpen: false, closes: 'does not close' },
])('$closes a lost client when isOpen is $isOpen', ({ isOpen }) => {
  const client = createClient()
  new ModbusConnection(client, '/dev/ttyUSB0', jest.fn())

  client.isOpen = isOpen
  client.emit('error', new Error('EIO: i/o error, write'))

  expect(client.close).toHaveBeenCalledTimes(isOpen ? 1 : 0)
})

// A device that does not answer is not a lost port: the client stays open
test('keeps the client after a response timeout', async () => {
  let now = 0
  jest.spyOn(performance, 'now').mockImplementation(() => now)
  const client = createClient()
  const open = jest.fn(() => Promise.resolve(createClient()))
  const connection = new ModbusConnection(client, '/dev/ttyUSB0', open)
  const timeout = { name: 'TransactionTimedOutError', message: 'Timed out', errno: 'ETIMEDOUT' }
  jest.mocked(client.readHoldingRegisters).mockRejectedValueOnce(timeout)

  await expect(connection.run(read)).rejects.toBe(timeout)
  now += 60_000

  await expect(connection.run(read)).resolves.toEqual(Buffer.from([0, 1]))
  expect(client.readHoldingRegisters).toHaveBeenCalledTimes(2)
  expect(open).not.toHaveBeenCalled()
})
