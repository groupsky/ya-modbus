/**
 * RTU (serial) transport for Modbus emulator
 *
 * This implementation uses modbus-serial ServerSerial for protocol handling.
 */

import { EventEmitter } from 'events'

import { ServerSerial } from 'modbus-serial'
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
  private requestHandler?: (slaveId: number, request: Buffer) => Promise<Buffer>
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
      this.server = new ServerSerial(
        serviceVector,
        {
          ...options,
          openCallback: (err: Error | null) => {
            if (err) {
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

      // Handle errors
      this.server.on('error', (err) => {
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
