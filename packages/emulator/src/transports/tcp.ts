/**
 * TCP transport for Modbus emulator
 *
 * This implementation uses modbus-serial ServerTCP for protocol handling.
 */

import { EventEmitter } from 'events'

import { ServerTCP } from 'modbus-serial'
import type { IServiceVector } from 'modbus-serial/ServerTCP'

import {
  buildRegisterReadRequest,
  parseRegisterReadResponse,
  buildRegisterWriteRequest,
  buildCoilReadRequest,
  parseCoilReadResponse,
  buildCoilWriteRequest,
} from '../utils/modbus-protocol-helpers.js'

import { BaseTransport } from './base.js'

export interface TcpTransportConfig {
  host: string
  port: number
}

export class TcpTransport extends BaseTransport {
  private config: TcpTransportConfig
  private requestHandler?: (slaveId: number, request: Buffer) => Promise<Buffer>
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

    // Create service vector that bridges modbus-serial callbacks to our request handler
    const serviceVector: IServiceVector = {
      getHoldingRegister: async (addr: number, unitID: number) => {
        return this.handleRegisterRead(unitID, 0x03, addr, 1)
      },
      getInputRegister: async (addr: number, unitID: number) => {
        return this.handleRegisterRead(unitID, 0x04, addr, 1)
      },
      getMultipleHoldingRegisters: async (addr: number, length: number, unitID: number) => {
        return this.handleRegisterRead(unitID, 0x03, addr, length)
      },
      getMultipleInputRegisters: async (addr: number, length: number, unitID: number) => {
        return this.handleRegisterRead(unitID, 0x04, addr, length)
      },
      setRegister: async (addr: number, value: number, unitID: number) => {
        return this.handleRegisterWrite(unitID, 0x06, addr, [value])
      },
      setRegisterArray: async (addr: number, values: number[], unitID: number) => {
        return this.handleRegisterWrite(unitID, 0x10, addr, values)
      },
      getCoil: async (addr: number, unitID: number) => {
        return this.handleCoilRead(unitID, 0x01, addr, 1)
      },
      getDiscreteInput: async (addr: number, unitID: number) => {
        return this.handleCoilRead(unitID, 0x02, addr, 1)
      },
      setCoil: async (addr: number, value: boolean, unitID: number) => {
        return this.handleCoilWrite(unitID, 0x05, addr, value)
      },
    }

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

      const cleanupOnError = (): void => {
        isInitializing = false
        this.initReject = undefined
        if (this.initTimeout) {
          clearTimeout(this.initTimeout)
          this.initTimeout = undefined
        }
        EventEmitter.prototype.removeAllListeners.call(server, 'initialized')
        EventEmitter.prototype.removeAllListeners.call(server, 'error')
        delete this.server
      }

      const cleanupOnSuccess = (): void => {
        isInitializing = false
        this.initReject = undefined
        if (this.initTimeout) {
          clearTimeout(this.initTimeout)
          this.initTimeout = undefined
        }
        EventEmitter.prototype.removeAllListeners.call(server, 'initialized')
        EventEmitter.prototype.removeAllListeners.call(server, 'error')
      }

      this.initTimeout = setTimeout(() => {
        cleanupOnError()
        reject(new Error('TCP server initialization timeout after 10s'))
      }, 10000)

      server.on('initialized', () => {
        cleanupOnSuccess()
        this.started = true
        resolve()
      })

      // Handle errors - cast to EventEmitter as modbus-serial types don't include 'error' event
      ;(server as unknown as EventEmitter).on('error', (err: Error) => {
        if (isInitializing) {
          cleanupOnError()
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
      this.initTimeout = undefined
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
      this.initReject = undefined
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

  onRequest(handler: (slaveId: number, request: Buffer) => Promise<Buffer>): void {
    this.requestHandler = handler
  }

  /**
   * Handle register read operations
   */
  private async handleRegisterRead(
    unitID: number,
    functionCode: number,
    addr: number,
    length: number
  ): Promise<number[]> {
    if (!this.requestHandler) {
      throw new Error('No request handler set')
    }

    const request = buildRegisterReadRequest({ unitID, functionCode, addr, length })
    const response = await this.requestHandler(unitID, request)
    return parseRegisterReadResponse(response)
  }

  /**
   * Handle register write operations
   */
  private async handleRegisterWrite(
    unitID: number,
    functionCode: number,
    addr: number,
    values: number[]
  ): Promise<void> {
    if (!this.requestHandler) {
      throw new Error('No request handler set')
    }

    const request = buildRegisterWriteRequest({ unitID, functionCode, addr, values })
    await this.requestHandler(unitID, request)
  }

  /**
   * Handle coil read operations
   */
  private async handleCoilRead(
    unitID: number,
    functionCode: number,
    addr: number,
    length: number
  ): Promise<boolean> {
    if (!this.requestHandler) {
      throw new Error('No request handler set')
    }

    const request = buildCoilReadRequest({ unitID, functionCode, addr, length })
    const response = await this.requestHandler(unitID, request)
    return parseCoilReadResponse(response)
  }

  /**
   * Handle coil write operations
   */
  private async handleCoilWrite(
    unitID: number,
    functionCode: number,
    addr: number,
    value: boolean
  ): Promise<void> {
    if (!this.requestHandler) {
      throw new Error('No request handler set')
    }

    const request = buildCoilWriteRequest({ unitID, functionCode, addr, value })
    await this.requestHandler(unitID, request)
  }
}
