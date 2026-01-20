/**
 * TCP transport for Modbus emulator
 *
 * Implements a Modbus TCP server using Node's net module.
 * Handles MBAP framing and delegates protocol handling to the emulator.
 */

import { createServer, type Server, type Socket } from 'node:net'

import { BaseTransport } from './base.js'

export interface TcpTransportConfig {
  port: number
  host?: string
  maxConnections?: number
}

export class TcpTransport extends BaseTransport {
  private server?: Server
  private requestHandler?: (slaveId: number, request: Buffer) => Promise<Buffer>
  private started = false
  private config: TcpTransportConfig
  private actualPort = 0
  private connections = new Set<Socket>()

  constructor(config: TcpTransportConfig) {
    super()
    this.config = config
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error('Transport already started')
    }

    this.server = createServer((socket) => {
      this.handleConnection(socket)
    })

    // Set max connections if configured
    if (this.config.maxConnections !== undefined) {
      this.server.maxConnections = this.config.maxConnections
    }

    return new Promise<void>((resolve, reject) => {
      const onError = (err: Error): void => {
        reject(err)
      }

      this.server?.once('error', onError)

      this.server?.listen(this.config.port, this.config.host ?? '127.0.0.1', () => {
        this.server?.removeListener('error', onError)

        const address = this.server?.address()
        if (address && typeof address === 'object') {
          this.actualPort = address.port
        }

        this.started = true
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    if (!this.started || !this.server) {
      return
    }

    // Close all connections
    for (const socket of this.connections) {
      socket.destroy()
    }
    this.connections.clear()

    return new Promise<void>((resolve) => {
      this.server?.close(() => {
        this.started = false
        this.actualPort = 0
        resolve()
      })
    })
  }

  send(_slaveId: number, _response: Buffer): Promise<void> {
    if (!this.started) {
      return Promise.reject(new Error('Transport not started'))
    }
    // Responses are sent directly in handleMBAPRequest
    return Promise.resolve()
  }

  onRequest(handler: (slaveId: number, request: Buffer) => Promise<Buffer>): void {
    this.requestHandler = handler
  }

  /**
   * Get the actual port the server is listening on
   */
  getPort(): number {
    return this.actualPort
  }

  /**
   * Handle new TCP connection
   */
  private handleConnection(socket: Socket): void {
    this.connections.add(socket)

    let buffer = Buffer.alloc(0)

    socket.on('data', (data: Buffer) => {
      buffer = Buffer.concat([buffer, data])

      // Try to parse complete MBAP frames
      while (buffer.length >= 6) {
        // MBAP header is 6 bytes: [Transaction ID (2)] [Protocol ID (2)] [Length (2)]
        const length = buffer.readUInt16BE(4)

        // Check if we have a complete frame
        const frameLength = 6 + length
        if (buffer.length < frameLength) {
          break
        }

        // Extract the frame
        const frame = buffer.subarray(0, frameLength)
        buffer = buffer.subarray(frameLength)

        // Handle the request
        this.handleMBAPRequest(socket, frame).catch(() => {
          // Ignore errors - socket might be closed
        })
      }
    })

    socket.on('close', () => {
      this.connections.delete(socket)
    })

    socket.on('error', () => {
      this.connections.delete(socket)
    })
  }

  /**
   * Handle MBAP request frame
   */
  private async handleMBAPRequest(socket: Socket, frame: Buffer): Promise<void> {
    if (frame.length < 7) {
      return
    }

    // Parse MBAP header
    const transactionId = frame.readUInt16BE(0)
    const protocolId = frame.readUInt16BE(2)

    // Verify protocol ID (should be 0 for Modbus)
    if (protocolId !== 0) {
      return
    }

    // Extract Unit ID and PDU (skip MBAP header of 6 bytes)
    const unitId = frame.readUInt8(6)
    const pdu = frame.subarray(7)

    // Build request buffer: [UnitID][PDU...]
    const request = Buffer.concat([Buffer.from([unitId]), pdu])

    if (!this.requestHandler) {
      return
    }

    try {
      // Get response from handler (format: [UnitID][FunctionCode][Data...])
      const response = await this.requestHandler(unitId, request)

      // Extract unit ID and PDU from response
      const responseUnitId = response[0] ?? unitId
      const responsePdu = response.subarray(1)

      // Build MBAP response
      // MBAP: [TransactionID(2)][ProtocolID(2)][Length(2)][UnitID(1)][PDU...]
      const responseLength = 1 + responsePdu.length // Unit ID + PDU
      const mbapResponse = Buffer.alloc(6 + responseLength)

      mbapResponse.writeUInt16BE(transactionId, 0)
      mbapResponse.writeUInt16BE(0, 2) // Protocol ID
      mbapResponse.writeUInt16BE(responseLength, 4)
      mbapResponse.writeUInt8(responseUnitId, 6)
      responsePdu.copy(mbapResponse, 7)

      socket.write(mbapResponse)
    } catch {
      // Don't send response if handler fails
    }
  }
}
