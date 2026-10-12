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
