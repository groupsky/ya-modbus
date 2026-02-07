/**
 * TCP transport for Modbus emulator
 *
 * This implementation uses modbus-serial ServerTCP for protocol handling.
 */

import { ServerTCP } from 'modbus-serial'
import type { IServiceVector } from 'modbus-serial/ServerTCP'

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

    // Wait for initialized event
    return new Promise<void>((resolve) => {
      server.on('initialized', () => {
        this.started = true
        resolve()
      })

      // Handle errors
      server.on('error', (err) => {
        // Log error but don't stop server
        console.error('TCP transport error:', err)
      })
    })
  }

  async stop(): Promise<void> {
    if (!this.started || !this.server) {
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

    // Build Modbus request buffer
    const request = Buffer.alloc(6)
    request[0] = unitID
    request[1] = functionCode
    request.writeUInt16BE(addr, 2)
    request.writeUInt16BE(length, 4)

    // Call handler
    const response = await this.requestHandler(unitID, request)

    // Parse response
    const byteCount = response[2]
    if (byteCount === undefined || response.length < 3 + byteCount) {
      throw new Error('Invalid response')
    }

    // Extract register values
    const values: number[] = []
    for (let i = 0; i < byteCount / 2; i++) {
      values.push(response.readUInt16BE(3 + i * 2))
    }

    return values
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

    // Build Modbus request buffer
    let request: Buffer
    if (functionCode === 0x06) {
      // Write single register
      request = Buffer.alloc(6)
      request[0] = unitID
      request[1] = functionCode
      request.writeUInt16BE(addr, 2)
      request.writeUInt16BE(values[0] ?? 0, 4)
    } else {
      // Write multiple registers
      const byteCount = values.length * 2
      request = Buffer.alloc(7 + byteCount)
      request[0] = unitID
      request[1] = functionCode
      request.writeUInt16BE(addr, 2)
      request.writeUInt16BE(values.length, 4)
      request[6] = byteCount
      for (let i = 0; i < values.length; i++) {
        request.writeUInt16BE(values[i] ?? 0, 7 + i * 2)
      }
    }

    // Call handler and ignore response
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

    // Build Modbus request buffer
    const request = Buffer.alloc(6)
    request[0] = unitID
    request[1] = functionCode
    request.writeUInt16BE(addr, 2)
    request.writeUInt16BE(length, 4)

    // Call handler
    const response = await this.requestHandler(unitID, request)

    // Parse response - get first bit from first byte of coil data
    const byteCount = response[2]
    if (byteCount === undefined || response.length < 4) {
      throw new Error('Invalid response')
    }

    const coilByte = response[3]
    if (coilByte === undefined) {
      throw new Error('Invalid response')
    }
    return (coilByte & 0x01) === 1
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

    // Build Modbus request buffer
    const request = Buffer.alloc(6)
    request[0] = unitID
    request[1] = functionCode
    request.writeUInt16BE(addr, 2)
    request.writeUInt16BE(value ? 0xff00 : 0x0000, 4)

    // Call handler and ignore response
    await this.requestHandler(unitID, request)
  }
}
