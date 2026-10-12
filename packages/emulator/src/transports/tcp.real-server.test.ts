/**
 * Lifecycle tests for TcpTransport with the real modbus-serial ServerTCP on a free port
 *
 * The mocked tests in tcp.test.ts cannot show whether a port is released, because only the
 * real server binds one.
 */

import { createServer, type AddressInfo } from 'node:net'

import { describe, it, expect, afterEach, jest } from '@jest/globals'
import ModbusRTU from 'modbus-serial'

import { VerboseLogger } from '../verbose-logger.js'

import { TcpTransport } from './tcp.js'
import { getFreePort } from './test-free-port.js'
import { resetConnection, waitUntil } from './test-socket.js'

const HOST = '127.0.0.1'

// True when nothing listens on the port, so a new server can bind it
const isPortFree = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.listen(port, HOST, () => probe.close(() => resolve(true)))
  })

describe('TcpTransport with the real ServerTCP', () => {
  let transport: TcpTransport | undefined

  afterEach(async () => {
    await transport?.stop()
    transport = undefined
  })

  it('releases the port when stop() is called while start() is pending', async () => {
    // Issue #545: stop() forgot the server, but it went on to bind the port
    const port = await getFreePort()
    transport = new TcpTransport({ host: HOST, port })

    const [start] = await Promise.allSettled([transport.start(), transport.stop()])

    expect(start).toEqual({
      status: 'rejected',
      reason: new Error('Transport stopped during initialization'),
    })
    await expect(isPortFree(port)).resolves.toBe(true)
  })

  it('can start again on the same port after stop() during start()', async () => {
    const port = await getFreePort()
    transport = new TcpTransport({ host: HOST, port })

    const [start] = await Promise.allSettled([transport.start(), transport.stop()])
    expect(start.status).toBe('rejected')

    await expect(transport.start()).resolves.toBeUndefined()
    await expect(isPortFree(port)).resolves.toBe(false)
  })

  it('rejects a second start() while the first one is pending', async () => {
    // Issue #278: the second ServerTCP would fight the first one for the port
    const port = await getFreePort()
    transport = new TcpTransport({ host: HOST, port })

    const firstStart = transport.start()
    await expect(transport.start()).rejects.toThrow('Transport already starting')

    await expect(firstStart).resolves.toBeUndefined()
    await expect(isPortFree(port)).resolves.toBe(false)
  })

  it('releases the port after stop() of a started transport', async () => {
    const port = await getFreePort()
    transport = new TcpTransport({ host: HOST, port })
    await transport.start()

    await transport.stop()

    await expect(isPortFree(port)).resolves.toBe(true)
  })

  describe('errors of the server', () => {
    it('rejects start() with EADDRINUSE when another server holds the port', async () => {
      // Issue #582: ServerTCP reports a failed listen() as 'serverError'. start() rejects with
      // that error and does not wait for the 10 s initialization timeout.
      const holder = createServer()
      await new Promise<void>((resolve) => holder.listen(0, HOST, resolve))
      try {
        const { port } = holder.address() as AddressInfo
        transport = new TcpTransport({ host: HOST, port })

        await expect(transport.start()).rejects.toMatchObject({ code: 'EADDRINUSE' })
      } finally {
        await new Promise((resolve) => holder.close(resolve))
      }
    })

    it('can start again once the port is free after an EADDRINUSE failure', async () => {
      const holder = createServer()
      await new Promise<void>((resolve) => holder.listen(0, HOST, resolve))
      try {
        const { port } = holder.address() as AddressInfo
        transport = new TcpTransport({ host: HOST, port })
        await expect(transport.start()).rejects.toMatchObject({ code: 'EADDRINUSE' })
      } finally {
        await new Promise((resolve) => holder.close(resolve))
      }

      await expect(transport.start()).resolves.toBeUndefined()
    })

    describe('a client that resets its connection in the middle of a request', () => {
      // Holds the response back until the client has reset its connection, so the reset
      // arrives in the middle of the request and after the server has read the request
      const startServing = async (
        logger?: VerboseLogger
      ): Promise<{ port: number; resetMidRequest: () => Promise<void> }> => {
        const port = await getFreePort()
        transport = new TcpTransport({ host: HOST, port }, logger)
        let markReceived!: () => void
        let release!: () => void
        const received = new Promise<void>((resolve) => (markReceived = resolve))
        const released = new Promise<void>((resolve) => (release = resolve))
        transport.onRequest(async () => {
          markReceived()
          await released
          return Buffer.from([1, 3, 2, 0, 230])
        })
        await transport.start()

        const resetMidRequest = async (): Promise<void> => {
          await resetConnection(HOST, port, received)
          release()
        }
        return { port, resetMidRequest }
      }

      // Reads holding register 0 of slave 1 with a new client
      const readRegister = async (port: number): Promise<number[]> => {
        const client = new ModbusRTU()
        try {
          await client.connectTCP(HOST, { port })
          client.setID(1)
          client.setTimeout(2000)
          return (await client.readHoldingRegisters(0, 1)).data
        } finally {
          await new Promise<void>((resolve) => client.close(() => resolve()))
        }
      }

      it('keeps serving other clients without a logger', async () => {
        // Issue #582: ServerTCP reports the error of a client socket as 'socketError'
        const { port, resetMidRequest } = await startServing()

        await resetMidRequest()

        await expect(readRegister(port)).resolves.toEqual([230])
      })

      it('logs the socket error with the verbose logger and keeps serving', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
        try {
          const { port, resetMidRequest } = await startServing(new VerboseLogger(true))

          await resetMidRequest()
          await waitUntil(() => consoleErrorSpy.mock.calls.length > 0)

          expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringMatching(/^\[VERBOSE\] ERROR TCP socket: .*ECONNRESET/)
          )
          await expect(readRegister(port)).resolves.toEqual([230])
        } finally {
          consoleErrorSpy.mockRestore()
        }
      })
    })
  })
})
