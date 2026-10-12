/**
 * Releasing the transport of a removed device closes the shared connection when no other
 * device uses it, so the serial port is free again.
 *
 * The mock clients lock their serial port while it is open, like a real serial port: a
 * second client cannot open a locked port, also not with other serial settings.
 */

import { EventEmitter } from 'node:events'

import type ModbusRTU from 'modbus-serial'

import type { RTUConfig, TransportConfig } from './factory.js'
import { TransportManager } from './manager.js'

jest.mock('modbus-serial')

type MockClient = jest.Mocked<ModbusRTU> & EventEmitter

const rtuConfig: RTUConfig = {
  port: '/dev/ttyUSB0',
  baudRate: 9600,
  dataBits: 8,
  parity: 'even',
  stopBits: 1,
  slaveId: 1,
  maxRetries: 1,
}
const reading = { data: [1], buffer: Buffer.from([0x00, 0x01]) }

/** Let pending promise callbacks and port events run */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

let manager: TransportManager
let clients: MockClient[]
// Serial ports that an open client has locked
let locked: Set<string>
// Serial ports of USB adapters that are not plugged in
let unplugged: Set<string>
// Opens of serial ports wait for this
let openGate: Promise<void>
let now: number

beforeEach(() => {
  now = 1_000_000
  jest.spyOn(performance, 'now').mockImplementation(() => now)
  clients = []
  locked = new Set()
  unplugged = new Set()
  openGate = Promise.resolve()

  jest.requireMock<jest.Mock>('modbus-serial').mockImplementation(() => {
    let lockedPort: string | undefined
    const unlock = (): void => {
      if (lockedPort !== undefined) locked.delete(lockedPort)
      lockedPort = undefined
      client.isOpen = false
    }
    const client: MockClient = Object.assign(new EventEmitter(), {
      isOpen: false,
      connectRTUBuffered: jest.fn(async (port: string) => {
        await openGate
        if (unplugged.has(port)) {
          throw new Error(`Error: No such file or directory, cannot open ${port}`)
        }
        if (locked.has(port)) {
          throw new Error('Error Resource temporarily unavailable Cannot lock port')
        }
        locked.add(port)
        lockedPort = port
        client.isOpen = true
      }),
      connectTCP: jest.fn(() => {
        client.isOpen = true
        return Promise.resolve()
      }),
      setID: jest.fn(),
      setTimeout: jest.fn(),
      close: jest.fn((callback?: () => void) => {
        unlock()
        callback?.()
      }),
      readHoldingRegisters: jest.fn().mockResolvedValue(reading),
      // Unplug the USB adapter: serialport closes the port and modbus-serial emits 'close'
      unplug: () => {
        unlock()
        client.emit('close')
      },
    }) as unknown as MockClient
    clients.push(client)
    return client
  })

  manager = new TransportManager()
})

afterEach(async () => {
  await manager.closeAll()
  jest.restoreAllMocks()
})

/** Unplug the USB adapter of a client */
function unplug(client: MockClient | undefined): void {
  ;(client as unknown as { unplug: () => void }).unplug()
}

test('keeps the connection open while another device on the bus uses it', async () => {
  const transport1 = await manager.getTransport(rtuConfig)
  const transport2 = await manager.getTransport({ ...rtuConfig, slaveId: 2 })

  await manager.releaseTransport(transport1)

  expect(clients[0]?.close).not.toHaveBeenCalled()
  expect(manager.getStats().totalTransports).toBe(1)
  await expect(transport2.readHoldingRegisters(0, 1)).resolves.toEqual(reading.buffer)
})

test.each<[string, TransportConfig]>([
  ['RTU', rtuConfig],
  ['TCP', { host: '192.168.1.100', slaveId: 1, maxRetries: 1 }],
])('closes the %s connection when its last device is released', async (_type, config) => {
  const transport1 = await manager.getTransport(config)
  const transport2 = await manager.getTransport({ ...config, slaveId: 2 })

  await manager.releaseTransport(transport1)
  await manager.releaseTransport(transport2)

  expect(clients[0]?.close).toHaveBeenCalledTimes(1)
  expect(manager.getStats().totalTransports).toBe(0)
  await manager.closeAll()
  expect(clients[0]?.close).toHaveBeenCalledTimes(1)
})

// The port of a removed device stayed open and locked until closeAll()
test.each([
  ['other serial settings', 19200],
  ['the same serial settings', 9600],
])(
  'a device with %s opens the port after the last device on it is released',
  async (_settings, baudRate) => {
    const transport = await manager.getTransport(rtuConfig)

    await manager.releaseTransport(transport)
    const added = await manager.getTransport({ ...rtuConfig, baudRate })

    await expect(added.readHoldingRegisters(0, 1)).resolves.toEqual(reading.buffer)
    expect(clients).toHaveLength(2)
    expect(clients[1]?.connectRTUBuffered).toHaveBeenCalledWith(
      '/dev/ttyUSB0',
      expect.objectContaining({ baudRate })
    )
    expect(manager.getStats().totalTransports).toBe(1)
  }
)

// A serial port is locked until its close finishes
test('a device that is added while the port of a released device closes waits for the close', async () => {
  const transport = await manager.getTransport(rtuConfig)
  let finishClosing: () => void = () => undefined
  const close = clients[0]?.close.getMockImplementation()
  clients[0]?.close.mockImplementationOnce((callback?: () => void) => {
    finishClosing = () => close?.(callback)
  })

  const release = manager.releaseTransport(transport)
  const adding = manager.getTransport({ ...rtuConfig, baudRate: 19200 })
  await settle()
  finishClosing()
  await release
  const added = await adding

  await expect(added.readHoldingRegisters(0, 1)).resolves.toEqual(reading.buffer)
})

test('releasing a transport again does not close the connection of the other devices', async () => {
  const transport1 = await manager.getTransport(rtuConfig)
  const transport2 = await manager.getTransport({ ...rtuConfig, slaveId: 2 })

  await manager.releaseTransport(transport1)
  await manager.releaseTransport(transport1)

  expect(clients[0]?.close).not.toHaveBeenCalled()
  await expect(transport2.readHoldingRegisters(0, 1)).resolves.toEqual(reading.buffer)
})

test('does not open a lost connection again after its last device is released', async () => {
  const transport = await manager.getTransport(rtuConfig)
  unplug(clients[0])

  await manager.releaseTransport(transport)
  now += 1000

  await expect(transport.readHoldingRegisters(0, 1)).rejects.toMatchObject({
    name: 'ConnectionLostError',
  })
  expect(clients).toHaveLength(1)
  expect(manager.getStats().totalTransports).toBe(0)
  expect(manager.getConnectionError(rtuConfig)).toBeUndefined()
})

test.each([
  {
    situation: 'after the port was lost',
    start: async () => {
      const transport = await manager.getTransport(rtuConfig)
      unplug(clients[0])
      return transport
    },
  },
  {
    situation: 'for the first time (startLost)',
    start: async () => {
      manager = new TransportManager({ startLost: true })
      unplugged.add(rtuConfig.port)
      const transport = await manager.getTransport(rtuConfig)
      unplugged.clear()
      return transport
    },
  },
])(
  'waits for a port that is opening $situation and closes it when its last device is released',
  async ({ start }) => {
    const transport = await start()
    let finishOpening: () => void = () => undefined
    openGate = new Promise((resolve) => {
      finishOpening = resolve
    })
    now += 1000
    const request = transport.readHoldingRegisters(0, 1)
    await settle()
    const opening = clients.at(-1)
    expect(opening?.connectRTUBuffered).toHaveBeenCalled()
    let finishClosing: () => void = () => undefined
    const close = opening?.close.getMockImplementation()
    opening?.close.mockImplementationOnce((callback?: () => void) => {
      finishClosing = () => close?.(callback)
    })

    let released = false
    const release = manager.releaseTransport(transport).then(() => {
      released = true
    })
    await settle()
    expect(released).toBe(false)
    finishOpening()
    await settle()
    // The port opened, and the release waits until it is closed again
    expect(opening?.close).toHaveBeenCalledTimes(1)
    expect(released).toBe(false)
    finishClosing()
    await release

    await expect(request).rejects.toMatchObject({ name: 'ConnectionLostError' })
    expect(opening?.readHoldingRegisters).not.toHaveBeenCalled()
    // The port is free for a device with other serial settings
    const added = await manager.getTransport({ ...rtuConfig, baudRate: 19200 })
    await expect(added.readHoldingRegisters(0, 1)).resolves.toEqual(reading.buffer)
  }
)

test('closeAll waits for a connection that closes after its last device was released', async () => {
  const transport = await manager.getTransport(rtuConfig)
  let finishClosing: () => void = () => undefined
  clients[0]?.close.mockImplementationOnce((callback?: () => void) => {
    finishClosing = () => callback?.()
  })

  const release = manager.releaseTransport(transport)
  let closedAll = false
  const closeAll = manager.closeAll().then(() => {
    closedAll = true
  })
  await settle()
  expect(closedAll).toBe(false)
  finishClosing()
  await Promise.all([release, closeAll])

  expect(clients[0]?.close).toHaveBeenCalledTimes(1)
})

test('releasing a transport while closeAll closes its connection does not close it again', async () => {
  const transport = await manager.getTransport(rtuConfig)
  let finishClosing: () => void = () => undefined
  clients[0]?.close.mockImplementationOnce((callback?: () => void) => {
    finishClosing = () => callback?.()
  })

  const closeAll = manager.closeAll()
  await manager.releaseTransport(transport)
  finishClosing()
  await closeAll

  expect(clients[0]?.close).toHaveBeenCalledTimes(1)
  expect(manager.getStats().totalTransports).toBe(0)
})
