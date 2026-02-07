/**
 * Main ModbusEmulator class
 */

import { EmulatedDevice } from './device.js'
import type { BaseTransport } from './transports/base.js'
import { MemoryTransport } from './transports/memory.js'
import { RtuTransport } from './transports/rtu.js'
import { TcpTransport } from './transports/tcp.js'
import type { EmulatorConfig, DeviceConfig } from './types/config.js'

export class ModbusEmulator {
  private devices: Map<number, EmulatedDevice> = new Map()
  private transport: BaseTransport
  private started = false

  constructor(config: EmulatorConfig) {
    // Create transport based on config
    if (config.transport === 'memory') {
      this.transport = new MemoryTransport()
    } else if (config.transport === 'rtu') {
      if (!config.port || typeof config.port !== 'string') {
        throw new Error('RTU transport requires port (serial port path)')
      }
      // Build RTU config with only defined properties (exactOptionalPropertyTypes)
      const rtuConfig: {
        port: string
        baudRate?: number
        parity?: 'none' | 'even' | 'odd'
        dataBits?: 7 | 8
        stopBits?: 1 | 2
        lock?: boolean
      } = {
        port: config.port,
        ...(config.baudRate !== undefined && { baudRate: config.baudRate }),
        ...(config.parity !== undefined && { parity: config.parity }),
        ...(config.dataBits !== undefined && { dataBits: config.dataBits }),
        ...(config.stopBits !== undefined && { stopBits: config.stopBits }),
        ...(config.lock !== undefined && { lock: config.lock }),
      }
      this.transport = new RtuTransport(rtuConfig)
    } else if (config.transport === 'tcp') {
      if (!config.host) {
        throw new Error('TCP transport requires host')
      }
      if (!config.port || typeof config.port !== 'number') {
        throw new Error('TCP transport requires port')
      }
      this.transport = new TcpTransport({
        host: config.host,
        port: config.port,
      })
    } else {
      throw new Error(`Unsupported transport: ${String(config.transport)}`)
    }

    // Set up request handler
    this.transport.onRequest(this.handleRequest.bind(this))
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error('Emulator already started')
    }
    await this.transport.start()
    this.started = true
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return
    }
    await this.transport.stop()
    this.started = false
  }

  private async handleRequest(slaveId: number, request: Buffer): Promise<Buffer> {
    // Get the device for this slave ID
    const device = this.devices.get(slaveId)

    if (!device) {
      // No device found - return exception
      const response = Buffer.alloc(3)
      response[0] = slaveId
      const functionCode = request[1]
      response[1] = functionCode !== undefined ? functionCode | 0x80 : 0x80
      response[2] = 0x0b // Gateway Target Device Failed to Respond
      return response
    }

    // Apply timing delay if configured
    const timingSimulator = device.getTimingSimulator()
    if (timingSimulator !== undefined) {
      // Parse register count from request
      const registerCount = this.parseRegisterCount(request)
      await timingSimulator.delay(request, registerCount)
    }

    // Import dynamically to avoid circular dependency issues
    const { handleModbusRequest } = await import('./behaviors/function-codes.js')
    return handleModbusRequest(device, request)
  }

  /**
   * Parse register count from Modbus request
   */
  private parseRegisterCount(request: Buffer): number {
    if (request.length < 6) {
      return 0
    }

    const functionCode = request[1]

    // For read operations, register count is in bytes 4-5
    if (functionCode === 0x03 || functionCode === 0x04) {
      return request.readUInt16BE(4)
    }

    // For write single register, count is 1
    if (functionCode === 0x06) {
      return 1
    }

    // For write multiple registers, count is in bytes 4-5
    if (functionCode === 0x10) {
      return request.readUInt16BE(4)
    }

    return 0
  }

  getTransport(): BaseTransport {
    return this.transport
  }

  addDevice(config: DeviceConfig): EmulatedDevice {
    if (this.devices.has(config.slaveId)) {
      throw new Error(`Device with slave ID ${config.slaveId} already exists`)
    }

    const device = new EmulatedDevice(config)
    this.devices.set(config.slaveId, device)
    return device
  }

  removeDevice(slaveId: number): void {
    if (!this.devices.has(slaveId)) {
      throw new Error(`Device with slave ID ${slaveId} not found`)
    }
    this.devices.delete(slaveId)
  }

  getDevice(slaveId: number): EmulatedDevice | undefined {
    return this.devices.get(slaveId)
  }
}
