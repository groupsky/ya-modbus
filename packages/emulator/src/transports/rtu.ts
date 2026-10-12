/**
 * RTU (serial) transport for Modbus emulator
 *
 * This implementation uses modbus-serial ServerSerial for protocol handling.
 */

import { EventEmitter } from 'events'

import { ServerSerial } from 'modbus-serial'

import { BaseTransport } from './base.js'
import { createServiceVector, type RequestHandler } from './service-vector.js'

export interface RtuTransportConfig {
  port: string
  baudRate?: number
  parity?: 'none' | 'even' | 'odd'
  dataBits?: 7 | 8
  stopBits?: 1 | 2
  lock?: boolean
}

/**
 * Every start() creates a new ServerSerial and never reuses an earlier one, so listeners added
 * to it cannot pile up across start/stop cycles. stop() forgets the server once it is closed.
 *
 * start() and stop() remove the 'error' listener they added. The listeners that modbus-serial
 * registers on the serial port and its parser stream are not reachable from here, and its
 * close() removes only the 'data' listener. They are released together with the server once
 * nothing references it. Reusing a server instance would also require removing them
 * (see #253).
 */
export class RtuTransport extends BaseTransport {
  private config: RtuTransportConfig
  private requestHandler?: RequestHandler
  private server?: ServerSerial
  private started = false
  private initReject?: (reason: Error) => void

  constructor(config: RtuTransportConfig) {
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

    // Build options with only defined serial port parameters
    // Filter out undefined values to satisfy exactOptionalPropertyTypes
    const options = Object.fromEntries(
      Object.entries({
        path: this.config.port,
        unitID: 255, // Listen to all unit IDs
        baudRate: this.config.baudRate,
        parity: this.config.parity,
        dataBits: this.config.dataBits,
        stopBits: this.config.stopBits,
      }).filter(([, value]) => value !== undefined)
    ) as unknown as ConstructorParameters<typeof ServerSerial>[1]

    // Create and start server
    return new Promise<void>((resolve, reject) => {
      const server = new ServerSerial(
        serviceVector,
        {
          ...options,
          openCallback: (err: Error | null) => {
            if (this.server !== server) {
              // stop() cancelled this start() while the port was opening (issue #297).
              // Close a port that opened anyway, otherwise it stays open and locked.
              if (!err) {
                server.close((closeErr) => {
                  if (closeErr) {
                    console.error('RTU transport error:', closeErr)
                  }
                })
              }
              return
            }

            delete this.initReject
            if (err) {
              // Clean up error listener to prevent memory leak (issue #280)
              EventEmitter.prototype.removeAllListeners.call(server, 'error')
              reject(err)
            } else {
              this.started = true
              resolve()
            }
          },
        },
        // @ts-expect-error - ServerSerial accepts third parameter serialportOptions but typedef is incomplete
        {
          lock: this.config.lock ?? true,
        }
      )

      this.server = server
      this.initReject = reject

      // Handle errors
      server.on('error', (err) => {
        // Log error but don't stop server
        console.error('RTU transport error:', err)
      })
    })
  }

  async stop(): Promise<void> {
    // Clean up event listeners to prevent memory leaks (issue #253)
    // Use EventEmitter.prototype since modbus-serial doesn't expose these methods in types
    if (this.server) {
      EventEmitter.prototype.removeAllListeners.call(this.server, 'error')
    }

    // If initialization is pending, reject it (issue #297)
    if (this.initReject) {
      this.initReject(new Error('Transport stopped during initialization'))
      delete this.initReject
    }

    if (!this.server) {
      return
    }

    // The port of a server that has not started is not closed here. Forgetting the server
    // makes openCallback close the port if it opens later.
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
