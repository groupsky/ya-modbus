/**
 * Detection of lost connections and reopening of modbus-serial clients
 */

import { EventEmitter } from 'node:events'

import type ModbusRTU from 'modbus-serial'

import { normalizeModbusError, type ModbusError } from './normalize-error.js'

/** Delay before the first attempt to reopen a lost connection, in milliseconds */
export const REOPEN_DELAY_MS = 1000

/** Longest delay between attempts to reopen a lost connection, in milliseconds */
export const MAX_REOPEN_DELAY_MS = 60_000

/**
 * Opens a new connected and configured client
 */
export type OpenClient = () => Promise<ModbusRTU>

/**
 * Check if an error means that the connection is lost (see ModbusConnection)
 *
 * @param error - Value that was thrown or used to reject a promise
 * @returns True for a ConnectionLostError
 */
export function isConnectionLostError(error: unknown): error is ModbusError {
  return error instanceof Error && error.name === 'ConnectionLostError'
}

/**
 * Close a client so that a late 'error' event cannot crash the process
 *
 * modbus-serial stops forwarding the 'error' events of its port when the client
 * closes. An error that the port emits after that (for example from an unplugged
 * adapter) would have no listener, so the port keeps one that ignores it.
 */
function closeClient(client: ModbusRTU, callback: () => void): void {
  const port: unknown = Reflect.get(client, '_port')
  if (port instanceof EventEmitter) port.on('error', () => undefined)
  client.close(callback)
}

/** Marks ModbusConnection objects, the same for all copies of this package */
const CONNECTION = Symbol.for('@ya-modbus/transport/ModbusConnection')

/**
 * Error for a lost connection, or for a port that was never open, with code and errno of a
 * Node.js system error cause
 */
function connectionLostError(
  target: string | undefined,
  cause: unknown,
  wasOpen = true
): ModbusError {
  const reason = normalizeModbusError(cause)
  // A port that was never open was not lost
  const message = wasOpen
    ? `Connection ${target === undefined ? '' : `to ${target} `}lost: ${reason.message}`
    : `Could not open ${target ?? 'the connection'}: ${reason.message}`
  const error: ModbusError = new Error(message, { cause: reason })
  error.name = 'ConnectionLostError'
  // modbus-serial gives all its port errors errno 'ECONNREFUSED', also an unplugged
  // serial adapter. Only Node.js system errors (they have a code) give a real errno.
  if (reason.code !== undefined) {
    error.code = reason.code
    error.errno = reason.errno
  }
  return error
}

/**
 * A connection that works has a client. A lost connection has the error that requests
 * reject with, and the client that was lost (none when the connection started lost).
 */
type ConnectionState =
  | { client: ModbusRTU; lostError?: undefined }
  | { client: ModbusRTU | undefined; lostError: ModbusError }

/**
 * A modbus-serial client together with the state of its connection.
 *
 * modbus-serial emits 'error' (for example when a USB serial adapter is unplugged)
 * and 'close' when the port fails. Node.js throws an 'error' event that has no
 * listener, which crashes the process. ModbusConnection listens for both events
 * and for clients that are no longer open, and then marks the connection as lost:
 * - requests in flight reject at once, without waiting for the response timeout
 * - later requests reject with the same ConnectionLostError without using the port
 * - with an `open` function, the first request after a delay opens a new client.
 *   The delay starts at REOPEN_DELAY_MS and doubles after each attempt that does
 *   not lead to a successful request, up to MAX_REOPEN_DELAY_MS.
 * - without an `open` function, requests reject until the owner of the client
 *   opens it again
 *
 * A connection created with the error of a failed open (for example a USB serial
 * adapter that is not plugged in) starts lost in the same way.
 */
export class ModbusConnection {
  readonly [CONNECTION] = true
  private state: ConnectionState
  private reopenDelay = REOPEN_DELAY_MS
  private reopenAt = 0
  private reopening: Promise<ModbusRTU> | undefined
  private closed = false
  private readonly inFlight = new Set<(error: ModbusError) => void>()

  /**
   * @param client - Connected modbus-serial client
   * @param target - Port path or host:port, used in error messages
   * @param open - Opens a new client after the connection is lost
   */
  constructor(client: ModbusRTU, target?: string, open?: OpenClient)
  /**
   * @param openError - Error of a failed attempt to open the port. The connection starts
   *   lost: requests reject with a ConnectionLostError, and the first request after
   *   REOPEN_DELAY_MS calls `open`.
   * @param target - Port path or host:port, used in error messages
   * @param open - Opens a new client
   */
  constructor(openError: Error, target: string | undefined, open: OpenClient)
  constructor(
    client: ModbusRTU | Error,
    private readonly target?: string,
    private readonly open?: OpenClient
  ) {
    if (client instanceof Error) {
      this.state = { client: undefined, lostError: connectionLostError(target, client, false) }
      this.delayReopen()
    } else {
      this.state = { client }
      this.watch(client)
    }
  }

  /**
   * The error that requests reject with while the connection is lost, or undefined while it
   * works. The request that opens the port again clears it.
   */
  get error(): ModbusError | undefined {
    return this.state.lostError
  }

  /**
   * Run a request with the client
   *
   * @param request - Request to run
   * @returns Result of the request
   * @throws ConnectionLostError when the connection is lost before or during the request
   */
  async run<T>(request: (client: ModbusRTU) => Promise<T>): Promise<T> {
    const { state } = this
    // No await while the connection works, so the request starts at once
    const client = state.lostError === undefined ? state.client : await this.reopen(state.lostError)

    // Assigned at once: the promise executor runs synchronously
    let rejectOnLoss!: (error: ModbusError) => void
    const lost = new Promise<never>((_resolve, reject) => {
      rejectOnLoss = reject
    })
    // Handled here too, in case request() throws before Promise.race() listens
    lost.catch(() => undefined)
    this.inFlight.add(rejectOnLoss)
    try {
      const value = await Promise.race([request(client), lost])
      // The port works, so the next loss starts again with the shortest delay
      this.reopenDelay = REOPEN_DELAY_MS
      return value
    } catch (error) {
      // modbus-serial clears isOpen on some failures without an event (TCP socket errors)
      if (!client.isOpen) this.lose(client, error)
      throw error
    } finally {
      this.inFlight.delete(rejectOnLoss)
    }
  }

  /**
   * Close the client and stop reopening it. Resolves when the port is closed, also when a
   * request was opening it again.
   */
  async close(): Promise<void> {
    this.closed = true
    // A client that opens now is closed at once (see openClient)
    if (this.reopening) await this.reopening.catch(() => undefined)
    const { state } = this
    // A lost client or a client that is not open needs no close. modbus-serial never
    // calls back when it closes a TCP client whose socket is closed.
    if (state.lostError !== undefined || !state.client.isOpen) return

    const { client } = state
    await new Promise<void>((resolve) => {
      closeClient(client, () => resolve())
    })
  }

  private watch(client: ModbusRTU): void {
    // The listeners stay for the life of the client: a late 'error' from a lost
    // client must not crash the process
    client.on('error', (error: unknown) => this.lose(client, error))
    client.on('close', () => this.lose(client, 'port closed'))
  }

  private lose(client: ModbusRTU, cause: unknown): void {
    // Ignore events from clients that were replaced, and repeated events
    if (client !== this.state.client || this.state.lostError !== undefined || this.closed) return

    const lostError = connectionLostError(this.target, cause)
    this.state = { client, lostError }
    this.delayReopen()
    for (const reject of this.inFlight) reject(lostError)
    // serialport closes the port on a disconnect. A port that is still open keeps
    // its lock, and the reopen would fail.
    if (client.isOpen) closeClient(client, () => undefined)
  }

  /** Set the time of the next reopen attempt, and wait longer after that one */
  private delayReopen(): void {
    this.reopenAt = performance.now() + this.reopenDelay
    this.reopenDelay = Math.min(this.reopenDelay * 2, MAX_REOPEN_DELAY_MS)
  }

  /**
   * Get a working client for a lost connection, unless it is too early to try again
   *
   * @param lostError - The error that the connection was lost with
   */
  private reopen(lostError: ModbusError): Promise<ModbusRTU> {
    if (this.open === undefined) {
      // The owner of the client can open it again
      const { client } = this.state
      if (client?.isOpen && !this.closed) {
        this.state = { client }
        return Promise.resolve(client)
      }
      return Promise.reject(lostError)
    }
    if (this.closed || performance.now() < this.reopenAt) return Promise.reject(lostError)

    // Requests that come while the client opens wait for the same attempt
    this.reopening ??= this.openClient(this.open, lostError).finally(() => {
      this.reopening = undefined
    })
    return this.reopening
  }

  private async openClient(open: OpenClient, lostError: ModbusError): Promise<ModbusRTU> {
    let client: ModbusRTU
    try {
      client = await open()
    } catch (error) {
      // Without a client, the port has never been open
      const openError = connectionLostError(this.target, error, this.state.client !== undefined)
      this.state = { client: this.state.client, lostError: openError }
      this.delayReopen()
      throw openError
    }
    if (this.closed) {
      // close() was called while the client was opening, and waits until the port is closed
      await new Promise<void>((resolve) => {
        closeClient(client, () => resolve())
      })
      throw lostError
    }

    this.state = { client }
    this.watch(client)
    return client
  }
}

/**
 * Use a ModbusConnection as it is, or wrap a plain client in a new one
 *
 * Checks the mark instead of `instanceof`, because the CommonJS and ES module
 * builds of this package each have their own ModbusConnection class.
 *
 * @param client - A ModbusConnection or a connected modbus-serial client
 * @returns The connection
 */
export function toConnection(client: ModbusRTU | ModbusConnection): ModbusConnection {
  return CONNECTION in client ? client : new ModbusConnection(client)
}
