/**
 * RTU (serial) transport for Modbus emulator
 *
 * This implementation uses modbus-serial for protocol handling.
 * Serial port communication will be added in future iterations.
 */

import { BaseTransport } from './base.js'

export interface RtuTransportConfig {
  port: string
  baudRate?: number
  parity?: 'none' | 'even' | 'odd'
  dataBits?: 7 | 8
  stopBits?: 1 | 2
}

export class RtuTransport extends BaseTransport {
  private config: RtuTransportConfig
  private requestHandler?: (slaveId: number, request: Buffer) => Promise<Buffer>
  private started = false

  constructor(config: RtuTransportConfig) {
    super()
    this.config = {
      baudRate: 9600,
      parity: 'none',
      dataBits: 8,
      stopBits: 1,
      ...config,
    }
  }

  start(): Promise<void> {
    this.started = true
    // Serial port initialization will be implemented when needed
    // For now, this is a placeholder for the interface
    return Promise.resolve()
  }

  stop(): Promise<void> {
    if (!this.started) {
      return Promise.resolve()
    }
    this.started = false
    // Serial port cleanup will be implemented when needed
    return Promise.resolve()
  }

  send(_slaveId: number, _response: Buffer): Promise<void> {
    if (!this.started) {
      return Promise.reject(new Error('Transport not started'))
    }
    // Response sending will be implemented with serial port
    return Promise.resolve()
  }

  onRequest(handler: (slaveId: number, request: Buffer) => Promise<Buffer>): void {
    this.requestHandler = handler
  }

  /**
   * Handle complete RTU frame (for testing/future implementation)
   */
  private async handleFrame(frame: Buffer): Promise<void> {
    // Minimum frame: slave_id + function_code + CRC (4 bytes)
    if (frame.length < 4) {
      return
    }

    // Verify CRC
    if (!this.verifyCRC(frame)) {
      return
    }

    // Extract slave ID
    const slaveId = frame[0]

    // Remove CRC to get request data
    const request = frame.subarray(0, frame.length - 2)

    if (!this.requestHandler) {
      return
    }

    try {
      // Get response from handler
      const response = await this.requestHandler(slaveId, request)

      // Send response
      await this.send(slaveId, response)
    } catch {
      // Don't send response if handler fails
    }
  }

  /**
   * Calculate Modbus RTU CRC-16 (Modbus variant)
   *
   * Returns CRC as a 16-bit value that can be written with writeUInt16LE
   */
  private calculateCRC(buffer: Buffer): number {
    let crc = 0xffff

    for (let i = 0; i < buffer.length; i++) {
      crc ^= buffer[i]

      for (let j = 0; j < 8; j++) {
        if (crc & 0x0001) {
          crc = (crc >> 1) ^ 0xa001
        } else {
          crc = crc >> 1
        }
      }
    }

    // Swap bytes for little-endian representation
    // CRC is stored low byte first in Modbus RTU
    return ((crc & 0xff) << 8) | ((crc >> 8) & 0xff)
  }

  /**
   * Verify CRC of RTU frame
   */
  private verifyCRC(frame: Buffer): boolean {
    if (frame.length < 4) {
      return false
    }

    // Get CRC from frame (last 2 bytes, little-endian)
    const receivedCRC = frame.readUInt16LE(frame.length - 2)

    // Calculate CRC of data (everything except last 2 bytes)
    const data = frame.subarray(0, frame.length - 2)
    const calculatedCRC = this.calculateCRC(data)

    return receivedCRC === calculatedCRC
  }

  /**
   * Add CRC to buffer
   */
  private addCRC(buffer: Buffer): Buffer {
    const crc = this.calculateCRC(buffer)
    const result = Buffer.alloc(buffer.length + 2)
    buffer.copy(result)
    result.writeUInt16LE(crc, buffer.length)
    return result
  }
}
