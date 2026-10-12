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

/**
 * Every start() creates a new ServerTCP and never reuses an earlier one, so listeners added
 * to it cannot pile up across start/stop cycles. stop() forgets the server once it is closed.
 *
 * start() and stop() remove the 'initialized' and 'error' listeners they added. The listeners
 * that modbus-serial registers on its own net.Server and sockets are not reachable from here,
 * and its close() removes only the 'data' listener. They are released together with the server
 * once nothing references it. Reusing a server instance would also require removing them
 * (see #253).
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
      }, 10000)

      server.on('initialized', () => {
        isInitializing = false
        delete this.initReject
        clearTimeout(this.initTimeout)
        delete this.initTimeout
        EventEmitter.prototype.removeAllListeners.call(server, 'initialized')
        EventEmitter.prototype.removeAllListeners.call(server, 'error')
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
      EventEmitter.prototype.removeAllListeners.call(this.server, 'error')
    }

    // If initialization is pending, reject it
    if (this.initReject) {
      this.initReject(new Error('Transport stopped during initialization'))
      delete this.initReject
    }

    if (!this.server) {
      return
    }

    // Only close the server if it was started, otherwise just clean up
    if (!this.started) {
      delete this.server
      return
    }

    return new Promise<void>((resolve, reject) => {
      if (!this.server) {
        resolve()
        return
      }

      this.server.close((err) => {
        if (err) {
          reject(err)
        } else {
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
