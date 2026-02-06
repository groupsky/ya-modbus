/**
 * Client transport adapter for connecting drivers to the emulator
 *
 * This bridges the driver's Transport interface with the emulator's
 * MemoryTransport by encoding/decoding Modbus frames.
 */

import type { Transport } from '@ya-modbus/driver-types'

import { MemoryTransport } from '../transports/memory.js'

// Modbus function codes
const FC_READ_COILS = 0x01
const FC_READ_DISCRETE_INPUTS = 0x02
const FC_READ_HOLDING_REGISTERS = 0x03
const FC_READ_INPUT_REGISTERS = 0x04
const FC_WRITE_SINGLE_COIL = 0x05
const FC_WRITE_SINGLE_REGISTER = 0x06
const FC_WRITE_MULTIPLE_COILS = 0x0f
const FC_WRITE_MULTIPLE_REGISTERS = 0x10

/**
 * Create a Transport instance that sends requests to the emulator
 */
export function createClientTransport(
  memoryTransport: MemoryTransport,
  slaveId: number
): Transport {
  return {
    async readHoldingRegisters(address: number, count: number): Promise<Buffer> {
      const request = buildReadRequest(slaveId, FC_READ_HOLDING_REGISTERS, address, count)
      const response = await memoryTransport.sendRequest(slaveId, request)
      return parseReadResponse(response)
    },

    async readInputRegisters(address: number, count: number): Promise<Buffer> {
      const request = buildReadRequest(slaveId, FC_READ_INPUT_REGISTERS, address, count)
      const response = await memoryTransport.sendRequest(slaveId, request)
      return parseReadResponse(response)
    },

    async readCoils(address: number, count: number): Promise<Buffer> {
      const request = buildReadRequest(slaveId, FC_READ_COILS, address, count)
      const response = await memoryTransport.sendRequest(slaveId, request)
      return parseReadResponse(response)
    },

    async readDiscreteInputs(address: number, count: number): Promise<Buffer> {
      const request = buildReadRequest(slaveId, FC_READ_DISCRETE_INPUTS, address, count)
      const response = await memoryTransport.sendRequest(slaveId, request)
      return parseReadResponse(response)
    },

    async writeSingleRegister(address: number, value: number): Promise<void> {
      const request = buildWriteSingleRegisterRequest(slaveId, address, value)
      const response = await memoryTransport.sendRequest(slaveId, request)
      checkWriteResponse(response, FC_WRITE_SINGLE_REGISTER)
    },

    async writeMultipleRegisters(address: number, values: Buffer): Promise<void> {
      const request = buildWriteMultipleRegistersRequest(slaveId, address, values)
      const response = await memoryTransport.sendRequest(slaveId, request)
      checkWriteResponse(response, FC_WRITE_MULTIPLE_REGISTERS)
    },

    async writeSingleCoil(address: number, value: boolean): Promise<void> {
      const request = buildWriteSingleCoilRequest(slaveId, address, value)
      const response = await memoryTransport.sendRequest(slaveId, request)
      checkWriteResponse(response, FC_WRITE_SINGLE_COIL)
    },

    async writeMultipleCoils(address: number, values: Buffer): Promise<void> {
      const request = buildWriteMultipleCoilsRequest(slaveId, address, values)
      const response = await memoryTransport.sendRequest(slaveId, request)
      checkWriteResponse(response, FC_WRITE_MULTIPLE_COILS)
    },

    async close(): Promise<void> {
      // Nothing to close for memory transport
    },
  }
}

/**
 * Build a read request (FC 0x01, 0x02, 0x03, 0x04)
 */
function buildReadRequest(
  slaveId: number,
  functionCode: number,
  address: number,
  count: number
): Buffer {
  const request = Buffer.alloc(6)
  request[0] = slaveId
  request[1] = functionCode
  request.writeUInt16BE(address, 2)
  request.writeUInt16BE(count, 4)
  return request
}

/**
 * Build write single register request (FC 0x06)
 */
function buildWriteSingleRegisterRequest(slaveId: number, address: number, value: number): Buffer {
  const request = Buffer.alloc(6)
  request[0] = slaveId
  request[1] = FC_WRITE_SINGLE_REGISTER
  request.writeUInt16BE(address, 2)
  request.writeUInt16BE(value, 4)
  return request
}

/**
 * Build write multiple registers request (FC 0x10)
 */
function buildWriteMultipleRegistersRequest(
  slaveId: number,
  address: number,
  values: Buffer
): Buffer {
  if (values.length % 2 !== 0) {
    throw new Error(`Invalid buffer length ${values.length}: must be even for register writes`)
  }
  const registerCount = values.length / 2
  const request = Buffer.alloc(7 + values.length)
  request[0] = slaveId
  request[1] = FC_WRITE_MULTIPLE_REGISTERS
  request.writeUInt16BE(address, 2)
  request.writeUInt16BE(registerCount, 4)
  request[6] = values.length
  values.copy(request, 7)
  return request
}

/**
 * Build write single coil request (FC 0x05)
 */
function buildWriteSingleCoilRequest(slaveId: number, address: number, value: boolean): Buffer {
  const request = Buffer.alloc(6)
  request[0] = slaveId
  request[1] = FC_WRITE_SINGLE_COIL
  request.writeUInt16BE(address, 2)
  request.writeUInt16BE(value ? 0xff00 : 0x0000, 4)
  return request
}

/**
 * Build write multiple coils request (FC 0x0F)
 *
 * Note: The coil count assumes all bits in the buffer are used.
 * This is a limitation of the Transport interface which takes a Buffer
 * without a separate count parameter for partial byte coil writes.
 */
function buildWriteMultipleCoilsRequest(slaveId: number, address: number, values: Buffer): Buffer {
  const coilCount = values.length * 8
  const request = Buffer.alloc(7 + values.length)
  request[0] = slaveId
  request[1] = FC_WRITE_MULTIPLE_COILS
  request.writeUInt16BE(address, 2)
  request.writeUInt16BE(coilCount, 4)
  request[6] = values.length
  values.copy(request, 7)
  return request
}

/**
 * Parse read response (FC 0x01, 0x02, 0x03, 0x04)
 * Response format: [slaveId, functionCode, byteCount, ...data]
 */
function parseReadResponse(response: Buffer): Buffer {
  const functionCode = response[1]
  if (functionCode !== undefined && (functionCode & 0x80) !== 0) {
    const exceptionCode = response[2]
    throw new Error(`Modbus exception: function=${functionCode & 0x7f}, code=${exceptionCode}`)
  }

  const byteCount = response[2]
  if (byteCount === undefined) {
    throw new Error('Invalid response: missing byte count')
  }

  return response.subarray(3, 3 + byteCount)
}

/**
 * Check write response for errors
 */
function checkWriteResponse(response: Buffer, expectedFunctionCode: number): void {
  const functionCode = response[1]
  if (functionCode !== undefined && (functionCode & 0x80) !== 0) {
    const exceptionCode = response[2]
    throw new Error(`Modbus exception: function=${functionCode & 0x7f}, code=${exceptionCode}`)
  }

  if (functionCode !== expectedFunctionCode) {
    throw new Error(
      `Unexpected function code: expected ${expectedFunctionCode}, got ${functionCode}`
    )
  }
}
