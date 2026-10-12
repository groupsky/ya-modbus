/**
 * Detection of lost connections and reopening of modbus-serial clients
 */

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

/** Marks ModbusConnection objects, the same for all copies of this package */
const CONNECTION = Symbol.for('@ya-modbus/transport/ModbusConnection')

/**
 * Error for a lost connection, with code and errno of a Node.js system error cause
 */
function connectionLostError(target: string | undefined, cause: unknown): ModbusError {
  const reason = normalizeModbusError(cause)
  const error: ModbusError = new Error(
    `Connection ${target === undefined ? '' : `to ${target} `}lost: ${reason.message}`,
    { cause: reason }
  )
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
 */
export class ModbusConnection {
  readonly [CONNECTION] = true
  private client: ModbusRTU
  private lostError: ModbusError | undefined
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
  constructor(
    client: ModbusRTU,
    private readonly target?: string,
    private readonly open?: OpenClient
  ) {
    this.client = client
    this.watch(client)
  }

  /**
   * Run a request with the client
   *
   * @param request - Request to run
   * @returns Result of the request
   * @throws ConnectionLostError when the connection is lost before or during the request
   */
  async run<T>(request: (client: ModbusRTU) => Promise<T>): Promise<T> {
    // No await while the connection works, so the request starts at once
    const client = this.lostError === undefined ? this.client : await this.reopen(this.lostError)

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
   * Close the client and stop reopening it
   */
  async close(): Promise<void> {
    this.closed = true
    // A lost client or a client that is not open needs no close. modbus-serial never
    // calls back when it closes a TCP client whose socket is closed.
    if (this.lostError !== undefined || !this.client.isOpen) return

    const client = this.client
    await new Promise<void>((resolve) => {
      client.close(() => resolve())
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
    if (client !== this.client || this.lostError !== undefined || this.closed) return

    this.lostError = connectionLostError(this.target, cause)
    this.delayReopen()
    for (const reject of this.inFlight) reject(this.lostError)
    // serialport closes the port on a disconnect. A port that is still open keeps
    // its lock, and the reopen would fail.
    if (client.isOpen) client.close(() => undefined)
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
      if (this.client.isOpen && !this.closed) {
        this.lostError = undefined
        return Promise.resolve(this.client)
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
      const openError = connectionLostError(this.target, error)
      this.lostError = openError
      this.delayReopen()
      throw openError
    }
    if (this.closed) {
      // close() was called while the client was opening
      client.close(() => undefined)
      throw lostError
    }

    this.client = client
    this.lostError = undefined
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
