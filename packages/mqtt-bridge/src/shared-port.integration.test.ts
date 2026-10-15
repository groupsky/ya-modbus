/**
 * Several meters on one serial port, where each meter ignores a request that comes too soon
 * after another meter answered, as DDS519MR meters do (#655).
 *
 * Without a pause between the devices, every request after another meter's answer waits for
 * its timeout and a retry, so the bridge publishes very little. Uses the real DriverLoader and
 * TransportManager, and emulated meters. Only modbus-serial is replaced by a client that sends
 * the requests to the emulator and times out like a real client.
 */

import { jest } from '@jest/globals'
import type { DeviceDriver, DriverConfig } from '@ya-modbus/driver-types'
import { ModbusEmulator } from '@ya-modbus/emulator'

import { DriverLoader } from './driver-loader.js'
import type { DeviceConfig, PollingConfig } from './types.js'
import { createTestBridgeConfig, startTestBroker, withTimeout } from './utils/test-utils.js'
import type { TestBroker } from './utils/test-utils.js'

import { createBridge } from './index.js'

jest.mock('modbus-serial')

const PORT = '/dev/ttyUSB0'
// With the pause the test needs about 2.5 s. Without it a meter publishes about once in 6.6 s.
const DATA_TIMEOUT_MS = 10000

let emulator: ModbusEmulator
// Polls that are reading, so a test can wait for them after the bridge stops
const polls = new Set<Promise<unknown>>()

/** modbus-serial client that sends its requests to the emulator */
function createClient(): object {
  let slaveId = 1
  let timeout = 1000

  const read = (functionCode: number, address: number, count: number): Promise<unknown> => {
    const request = Buffer.alloc(6)
    request.writeUInt8(slaveId, 0)
    request.writeUInt8(functionCode, 1)
    request.writeUInt16BE(address, 2)
    request.writeUInt16BE(count, 4)

    return new Promise((resolve, reject) => {
      // A request that the meter ignores is never answered
      const timer = setTimeout(
        () => reject(Object.assign(new Error('Timed out'), { errno: 'ETIMEDOUT' })),
        timeout
      )
      // @ts-expect-error - getTransport() has the base type, sendRequest() is in the memory transport
      void (emulator.getTransport().sendRequest(slaveId, request) as Promise<Buffer>).then(
        (response) => {
          clearTimeout(timer)
          const data = response.subarray(3, 3 + (response[2] ?? 0))
          resolve({ data: [], buffer: data })
        }
      )
    })
  }

  return {
    isOpen: true,
    connectRTUBuffered: () => Promise.resolve(),
    setID: (id: number) => {
      slaveId = id
    },
    setTimeout: (ms: number) => {
      timeout = ms
    },
    on: () => undefined,
    close: (callback: () => void) => callback(),
    readInputRegisters: (address: number, count: number) => read(0x04, address, count),
  }
}

/** Driver of a meter that needs two requests for one poll */
function createDriver({ transport }: DriverConfig): Promise<DeviceDriver> {
  const readDataPoints = (): Promise<Record<string, unknown>> => {
    const poll = (async () => ({
      voltage: (await transport.readInputRegisters(0, 2)).readUInt16BE(0),
      energy: (await transport.readInputRegisters(0x100, 2)).readUInt16BE(0),
    }))()
    polls.add(poll)
    void poll.catch(() => undefined).finally(() => polls.delete(poll))
    return poll
  }

  return Promise.resolve({
    name: 'meter',
    manufacturer: 'Test',
    model: 'TEST',
    dataPoints: [
      { id: 'voltage', name: 'Voltage', type: 'integer' },
      { id: 'energy', name: 'Energy', type: 'integer' },
    ],
    readDataPoint: () => Promise.reject(new Error('not used')),
    writeDataPoint: () => Promise.reject(new Error('read only')),
    readDataPoints,
  })
}

/** Meter on the shared port, with the default pause between devices */
function meter(deviceId: string, slaveId: number, polling: PollingConfig): DeviceConfig {
  return {
    deviceId,
    driver: 'ya-modbus-driver-test',
    connection: {
      type: 'rtu',
      port: PORT,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      slaveId,
    },
    polling,
  }
}

/** Wait until each device has published `count` data messages */
function waitForData(broker: TestBroker, deviceIds: string[], count: number): Promise<void> {
  const seen = new Map(deviceIds.map((id) => [id, 0]))
  let onPublish: ((packet: { topic: string }) => void) | undefined
  const done = new Promise<void>((resolve) => {
    onPublish = ({ topic }) => {
      const deviceId = /^modbus\/(.+)\/data$/.exec(topic)?.[1]
      if (deviceId === undefined || !seen.has(deviceId)) return
      seen.set(deviceId, (seen.get(deviceId) ?? 0) + 1)
      if ([...seen.values()].every((n) => n >= count)) resolve()
    }
    broker.broker.on('publish', onPublish)
  })

  return withTimeout(
    done,
    DATA_TIMEOUT_MS,
    () => `Data messages after ${DATA_TIMEOUT_MS} ms: ${JSON.stringify(Object.fromEntries(seen))}`
  ).finally(() => {
    if (onPublish) broker.broker.off('publish', onPublish)
  })
}

describe('meters that need a pause after another meter on one serial port', () => {
  let broker: TestBroker
  const debug = process.env['YA_MODBUS_DEBUG']

  beforeEach(async () => {
    broker = await startTestBroker()
    process.env['YA_MODBUS_DEBUG'] = '1'
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.requireMock<jest.Mock>('modbus-serial').mockImplementation(createClient)

    emulator = new ModbusEmulator({ transport: 'memory' })
    const input = { 0: 2300, 1: 0, 0x100: 1234, 0x101: 0 }
    // Meters 1 and 2 answer after 20 ms. Meter 3 answers after 150 ms, so its poll of two
    // requests takes longer than the polling interval of 100 ms.
    for (const [slaveId, processingDelay] of [
      [1, 20],
      [2, 20],
      [3, 150],
    ] as const) {
      emulator.addDevice({
        slaveId,
        registers: { input },
        timing: { processingDelay, minGapAfterOtherSlave: 50 },
      })
    }
    await emulator.start()
  })

  afterEach(async () => {
    if (debug === undefined) delete process.env['YA_MODBUS_DEBUG']
    else process.env['YA_MODBUS_DEBUG'] = debug
    jest.restoreAllMocks()
    await emulator.stop()
    await broker.close()
  })

  test.each(['continuous', 'interval'] as const)(
    'publishes data of every meter again and again in %s mode',
    async (mode) => {
      const loadDriver = jest.fn(() => Promise.resolve({ createDriver }))
      const bridge = createBridge(createTestBridgeConfig(broker), {
        driverLoader: new DriverLoader(loadDriver),
      })
      await bridge.start()

      try {
        const deviceIds = ['meter1', 'meter2', 'meter3']
        const data = waitForData(broker, deviceIds, 3)
        for (const [index, deviceId] of deviceIds.entries()) {
          await bridge.addDevice(meter(deviceId, index + 1, { interval: 100, mode }))
        }
        await data

        // No request was ignored and sent again
        expect(console.warn).not.toHaveBeenCalled()
        expect(console.error).not.toHaveBeenCalled()
      } finally {
        await bridge.stop()
        // A poll that was reading goes on after the stop
        await Promise.allSettled(polls)
      }
    },
    DATA_TIMEOUT_MS + 10000
  )
})
