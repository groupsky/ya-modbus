/**
 * Devices on one serial port wait `interDeviceDelay` ms after a request to another slave.
 * Some meters do not answer a request that comes too soon after another meter's reply (#655).
 */

import { EventEmitter } from 'node:events'

import type { RTUConfig } from './factory.js'
import { TransportManager } from './manager.js'

jest.mock('modbus-serial')

const meter = (port: string, slaveId: number, interDeviceDelay?: number): RTUConfig => ({
  port,
  baudRate: 9600,
  dataBits: 8,
  parity: 'even',
  stopBits: 1,
  slaveId,
  ...(interDeviceDelay !== undefined && { interDeviceDelay }),
})

let manager: TransportManager
// Port, slave ID and time of each read that reached a client
let reads: Array<[target: string, slaveId: number, at: number]>
let start: number

beforeEach(() => {
  jest.useFakeTimers()
  start = performance.now()
  reads = []

  // Each client answers a read after 30 ms
  jest.requireMock<jest.Mock>('modbus-serial').mockImplementation(() => {
    let target = ''
    let slaveId = 0
    return Object.assign(new EventEmitter(), {
      isOpen: true,
      connectRTUBuffered: jest.fn((port: string) => {
        target = port
        return Promise.resolve()
      }),
      setID: jest.fn((id: number) => {
        slaveId = id
      }),
      setTimeout: jest.fn(),
      close: jest.fn((callback: () => void) => callback()),
      readHoldingRegisters: jest.fn(() => {
        reads.push([target, slaveId, performance.now() - start])
        return new Promise((resolve) =>
          setTimeout(() => resolve({ data: [0], buffer: Buffer.from([0, 0]) }), 30)
        )
      }),
    })
  })

  manager = new TransportManager()
})

afterEach(async () => {
  await manager.closeAll()
  jest.useRealTimers()
})

/** Read once with each transport in turn, and let the fake time run until all reads ended */
async function readInTurn(
  ...transports: Array<{ readHoldingRegisters: (a: number, c: number) => Promise<Buffer> }>
): Promise<void> {
  const done = transports.reduce<Promise<unknown>>(
    (previous, transport) => previous.then(() => transport.readHoldingRegisters(0, 1)),
    Promise.resolve()
  )
  await jest.runAllTimersAsync()
  await done
}

test('waits the delay of a device after a request to another slave on the same port', async () => {
  const meter1 = await manager.getTransport(meter('/dev/ttyUSB0', 1, 150))
  const meter2 = await manager.getTransport(meter('/dev/ttyUSB0', 2, 100))

  await readInTurn(meter1, meter2, meter2, meter1)

  expect(reads).toEqual([
    ['/dev/ttyUSB0', 1, 0],
    ['/dev/ttyUSB0', 2, 130],
    ['/dev/ttyUSB0', 2, 160],
    ['/dev/ttyUSB0', 1, 340],
  ])
})

test('does not wait without interDeviceDelay', async () => {
  const meter1 = await manager.getTransport(meter('/dev/ttyUSB0', 1))
  const meter2 = await manager.getTransport(meter('/dev/ttyUSB0', 2))

  await readInTurn(meter1, meter2)

  expect(reads).toEqual([
    ['/dev/ttyUSB0', 1, 0],
    ['/dev/ttyUSB0', 2, 30],
  ])
})

test('does not wait after a request on another port', async () => {
  const meter1 = await manager.getTransport(meter('/dev/ttyUSB0', 1, 150))
  const meter2 = await manager.getTransport(meter('/dev/ttyUSB1', 2, 150))

  await readInTurn(meter1, meter2)

  expect(reads).toEqual([
    ['/dev/ttyUSB0', 1, 0],
    ['/dev/ttyUSB1', 2, 30],
  ])
})
