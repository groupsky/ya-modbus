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

export class RtuTransport extends BaseTransport {
  private config: RtuTransportConfig
  private requestHandler?: RequestHandler
  private server?: ServerSerial
  private started = false

  constructor(config: RtuTransportConfig) {
    super()
    this.config = config
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error('Transport already started')
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

      // Handle errors
      server.on('error', (err) => {
        // Log error but don't stop server
        console.error('RTU transport error:', err)
      })
    })
  }

  async stop(): Promise<void> {
    if (!this.started || !this.server) {
      return
    }

    // Clean up event listeners to prevent memory leaks (issue #253)
    // Use EventEmitter.prototype since modbus-serial doesn't expose these methods in types
    EventEmitter.prototype.removeAllListeners.call(this.server, 'error')

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
