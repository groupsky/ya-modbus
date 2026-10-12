/**
 * TCP transport for Modbus emulator
 *
 * This implementation uses modbus-serial ServerTCP for protocol handling.
 */

import { EventEmitter } from 'events'

import { ServerTCP } from 'modbus-serial'

import { BaseTransport } from './base.js'
import { createServiceVector, type RequestHandler } from './service-vector.js'

export interface TcpTransportConfig {
  host: string
  port: number
}

const INIT_TIMEOUT_MS = 10000

/**
 * Close a server whose start() was cancelled by stop().
 *
 * ServerTCP starts to listen when it is created, and net.Server.close() has no effect before
 * the port is bound. So the server is closed once it reports 'initialized', and the returned
 * promise resolves when the port is released (issue #545). It also resolves when the server
 * reports that it failed to start, and after the initialization timeout, so that a server
 * which never answers cannot block stop() for longer. A server that binds after the timeout
 * is still closed.
 *
 * The failure listeners stay on the abandoned server, so a late error is not thrown. They are
 * released together with the server. modbus-serial reports the errors of its net.Server as
 * 'serverError'.
 */
function closeWhenInitialized(server: ServerTCP): Promise<void> {
  const emitter = server as unknown as EventEmitter

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, INIT_TIMEOUT_MS)

    const onInitialized = (): void => {
      clearTimeout(timeout)
      server.close((err) => (err ? reject(err) : resolve()))
    }
    const onFailed = (): void => {
      clearTimeout(timeout)
      emitter.removeListener('initialized', onInitialized)
      resolve()
    }

    emitter.once('initialized', onInitialized)
    emitter.on('error', onFailed)
    emitter.on('serverError', onFailed)
  })
}

/**
 * Every start() creates a new ServerTCP and never reuses an earlier one, so listeners added
 * to it cannot pile up across start/stop cycles. stop() forgets the server once it is closed.
 * The server of a start() that stop() cancelled is forgotten at once, and stop() waits until
 * it is closed (see closeWhenInitialized).
 *
 * start() and stop() remove the 'initialized' and 'error' listeners they added. The 'error'
 * listener stays on a running server until it is closed, so a later 'error' event is logged.
 * The listeners that modbus-serial registers on its own net.Server and sockets are not
 * reachable from here, and its close() removes only the 'data' listener. They are released
 * together with the server once nothing references it. Reusing a server instance would also
 * require removing them (see #253).
 */
export class TcpTransport extends BaseTransport {
  private config: TcpTransportConfig
  private requestHandler?: RequestHandler
  private server?: ServerTCP
  private started = false
  private initReject?: (reason: Error) => void
  private initTimeout?: NodeJS.Timeout

  constructor(config: TcpTransportConfig) {
    super()
    this.config = config
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error('Transport already started')
    }

    // A second start() would replace the server the first one is still waiting for
    if (this.initReject) {
      throw new Error('Transport already starting')
    }

    const serviceVector = createServiceVector(() => this.requestHandler)

    // Build options - all values are required for TCP
    const options = {
      host: this.config.host,
      port: this.config.port,
      unitID: 255, // Listen to all unit IDs
    }

    // Create server
    const server = new ServerTCP(serviceVector, options)
    this.server = server

    // Wait for initialized event with timeout
    return new Promise<void>((resolve, reject) => {
      let isInitializing = true
      this.initReject = reject

      this.initTimeout = setTimeout(() => {
        isInitializing = false
        delete this.initReject
        delete this.initTimeout
        EventEmitter.prototype.removeAllListeners.call(server, 'initialized')
        EventEmitter.prototype.removeAllListeners.call(server, 'error')
        delete this.server
        reject(new Error('TCP server initialization timeout after 10s'))
      }, INIT_TIMEOUT_MS)

      server.on('initialized', () => {
        isInitializing = false
        delete this.initReject
        clearTimeout(this.initTimeout)
        delete this.initTimeout
        // Keep the 'error' listener: without it an error of the running server is thrown
        // as an uncaught exception (issue #544). stop() removes it.
        EventEmitter.prototype.removeAllListeners.call(server, 'initialized')
        this.started = true
        resolve()
      })

      // Handle errors - cast to EventEmitter as modbus-serial types don't include 'error' event
      ;(server as unknown as EventEmitter).on('error', (err: Error) => {
        if (isInitializing) {
          isInitializing = false
          delete this.initReject
          clearTimeout(this.initTimeout)
          delete this.initTimeout
          EventEmitter.prototype.removeAllListeners.call(server, 'initialized')
          EventEmitter.prototype.removeAllListeners.call(server, 'error')
          delete this.server
          reject(err)
        } else {
          // Log errors that occur after initialization
          console.error('TCP transport error:', err)
        }
      })
    })
  }

  async stop(): Promise<void> {
    // Clear initialization timeout if pending
    if (this.initTimeout) {
      clearTimeout(this.initTimeout)
      delete this.initTimeout
    }

    // Clean up event listeners FIRST to prevent race condition (issue #294)
    // This ensures 'initialized' can't fire after we reject the Promise
    if (this.server) {
      EventEmitter.prototype.removeAllListeners.call(this.server, 'initialized')
      // A running server keeps its 'error' listener until it is closed
      if (!this.started) {
        EventEmitter.prototype.removeAllListeners.call(this.server, 'error')
      }
    }

    // If initialization is pending, reject it
    if (this.initReject) {
      this.initReject(new Error('Transport stopped during initialization'))
      delete this.initReject
    }

    if (!this.server) {
      return
    }

    // The server of a start() that is still pending is binding the port (issue #545)
    if (!this.started) {
      const pendingServer = this.server
      delete this.server
      return closeWhenInitialized(pendingServer)
    }

    return new Promise<void>((resolve, reject) => {
      const server = this.server
      if (!server) {
        resolve()
        return
      }

      server.close((err) => {
        if (err) {
          reject(err)
        } else {
          EventEmitter.prototype.removeAllListeners.call(server, 'error')
          this.started = false
          delete this.server
          resolve()
        }
      })
    })
  }

  send(_slaveId: number, _response: Buffer): Promise<void> {
    if (!this.started) {
      return Promise.reject(new Error('Transport not started'))
    }
    // Responses are sent automatically by modbus-serial server
    // This method is kept for interface compatibility
    return Promise.resolve()
  }

  onRequest(handler: RequestHandler): void {
    this.requestHandler = handler
  }
}
