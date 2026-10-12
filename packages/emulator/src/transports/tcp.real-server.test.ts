/**
 * Lifecycle tests for TcpTransport with the real modbus-serial ServerTCP on a free port
 *
 * The mocked tests in tcp.test.ts cannot show whether a port is released, because only the
 * real server binds one.
 */

import { createServer } from 'node:net'

import { describe, it, expect, afterEach } from '@jest/globals'

import { TcpTransport } from './tcp.js'
import { getFreePort } from './test-free-port.js'

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
})
