/**
 * Main ModbusEmulator class
 */

import { EmulatedDevice } from './device.js'
import type { BaseTransport } from './transports/base.js'
import { MemoryTransport } from './transports/memory.js'
import type { EmulatorConfig, DeviceConfig } from './types/config.js'
import type { EmulatedDevice as IEmulatedDevice } from './types/device.js'

export class ModbusEmulator {
  private config: EmulatorConfig
  private devices: Map<number, IEmulatedDevice> = new Map()
  private transport: BaseTransport
  private started = false

  constructor(config: EmulatorConfig) {
    this.config = config

    // Create transport based on config
    if (config.transport === 'memory') {
      this.transport = new MemoryTransport()
    } else {
      throw new Error(`Unsupported transport: ${config.transport}`)
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
      response[1] = request.length > 1 ? request[1] | 0x80 : 0x80
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

  addDevice(config: DeviceConfig): IEmulatedDevice {
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

  getDevice(slaveId: number): IEmulatedDevice | undefined {
    return this.devices.get(slaveId)
  }
}
