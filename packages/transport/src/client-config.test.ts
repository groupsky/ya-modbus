import net from 'node:net'

import ModbusRTU from 'modbus-serial'

import { configureClient, connectTCP, DEFAULT_TIMEOUT_MS } from './client-config.js'

afterEach(() => {
  jest.restoreAllMocks()
})

test.each([
  { timeout: 2500, expected: 2500 },
  { timeout: undefined, expected: DEFAULT_TIMEOUT_MS },
])('sets slave ID 7 and timeout $expected when timeout is $timeout', ({ timeout, expected }) => {
  const client = { setID: jest.fn(), setTimeout: jest.fn() }

  configureClient(client as unknown as ModbusRTU, 7, timeout)

  expect(client.setID).toHaveBeenCalledWith(7)
  expect(client.setTimeout).toHaveBeenCalledWith(expected)
})

// Without a timeout the connect waits for the TCP timeout of the system (about 2 minutes),
// and holds the bus for all devices on the connection
test('connectTCP gives up after the timeout when the host does not answer', async () => {
  const sockets: net.Socket[] = []
  // The connect never completes, as when nothing answers at the address
  jest.spyOn(net.Socket.prototype, 'connect').mockImplementation(function (this: net.Socket) {
    sockets.push(this)
    return this
  })

  await expect(connectTCP(new ModbusRTU(), '192.0.2.1', 502, 100)).rejects.toThrow(
    'TCP Connection Timed Out'
  )
  // A socket that connects later would be a connection that nothing uses
  expect(sockets).toHaveLength(1)
  expect(sockets[0]?.destroyed).toBe(true)
}, 2000)

// modbus-serial keeps the socket timeout after the connect, but then a timeout does nothing
test('connectTCP keeps a connection that is idle for longer than the timeout', async () => {
  const server = net.createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  const client = new ModbusRTU()

  try {
    await connectTCP(client, '127.0.0.1', port, 50)
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(client.isOpen).toBe(true)
  } finally {
    client.destroy(() => undefined)
    await new Promise((resolve) => server.close(resolve))
  }
})
