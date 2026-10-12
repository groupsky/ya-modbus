/**
 * Modbus function code handlers
 */

import type { EmulatedDevice } from '../device.js'
import type { VerboseLogger } from '../verbose-logger.js'

// Modbus exception codes
export const ILLEGAL_FUNCTION = 0x01
export const ILLEGAL_DATA_ADDRESS = 0x02
export const ILLEGAL_DATA_VALUE = 0x03

// Limits of the Modbus specification: a response carries at most 250 data bytes (2000 coils),
// a request at most 246 (1968 coils)
const MAX_READ_COILS = 2000
const MAX_WRITE_COILS = 1968

// Coil addresses are 16 bits. A request must not reach past the last one, 65535.
const COIL_ADDRESS_COUNT = 0x10000

// Value of Write Single Coil that switches the coil on. Off is 0x0000.
const COIL_ON = 0xff00

/**
 * Handle a Modbus request and return the response
 */
export function handleModbusRequest(
  device: EmulatedDevice,
  request: Buffer,
  verboseLogger?: VerboseLogger
): Buffer {
  if (request.length < 2) {
    return createExceptionResponse(request[0] ?? 0, 0x00, ILLEGAL_DATA_VALUE)
  }

  // Buffer access is safe after length check
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const slaveId = request[0]!
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const functionCode = request[1]!

  try {
    switch (functionCode) {
      case 0x01:
        return handleReadBits(device, request, 0x01, verboseLogger)
      case 0x02:
        return handleReadBits(device, request, 0x02, verboseLogger)
      case 0x03:
        return handleReadHoldingRegisters(device, request, verboseLogger)
      case 0x04:
        return handleReadInputRegisters(device, request, verboseLogger)
      case 0x05:
        return handleWriteSingleCoil(device, request, verboseLogger)
      case 0x06:
        return handleWriteSingleRegister(device, request, verboseLogger)
      case 0x0f:
        return handleWriteMultipleCoils(device, request, verboseLogger)
      case 0x10:
        return handleWriteMultipleRegisters(device, request, verboseLogger)
      default:
        return createExceptionResponse(slaveId, functionCode, ILLEGAL_FUNCTION)
    }
  } catch {
    // If error occurs, return illegal data value exception
    return createExceptionResponse(slaveId, functionCode, ILLEGAL_DATA_VALUE)
  }
}

/**
 * 0x01 - Read Coils and 0x02 - Read Discrete Inputs
 *
 * The response packs the bits into bytes, the lowest address in the least significant bit of
 * the first byte.
 */
function handleReadBits(
  device: EmulatedDevice,
  request: Buffer,
  functionCode: 0x01 | 0x02,
  verboseLogger?: VerboseLogger
): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const slaveId = request[0]!
  if (request.length < 6) {
    return createExceptionResponse(slaveId, functionCode, ILLEGAL_DATA_VALUE)
  }

  const startAddress = request.readUInt16BE(2)
  const quantity = request.readUInt16BE(4)
  if (quantity < 1 || quantity > MAX_READ_COILS) {
    return createExceptionResponse(slaveId, functionCode, ILLEGAL_DATA_VALUE)
  }
  if (startAddress + quantity > COIL_ADDRESS_COUNT) {
    return createExceptionResponse(slaveId, functionCode, ILLEGAL_DATA_ADDRESS)
  }

  const byteCount = Math.ceil(quantity / 8)
  const response = Buffer.alloc(3 + byteCount)
  response[0] = slaveId
  response[1] = functionCode
  response[2] = byteCount

  for (let i = 0; i < quantity; i++) {
    const address = startAddress + i
    const bit = functionCode === 0x01 ? device.getCoil(address) : device.getDiscreteInput(address)
    if (bit) {
      const index = 3 + (i >> 3)
      response[index] = response.readUInt8(index) | (1 << (i & 7))
    }
  }

  verboseLogger?.logRead(slaveId, functionCode, startAddress, quantity, response)

  return response
}

/**
 * 0x03 - Read Holding Registers
 */
function handleReadHoldingRegisters(
  device: EmulatedDevice,
  request: Buffer,
  verboseLogger?: VerboseLogger
): Buffer {
  if (request.length < 6) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return createExceptionResponse(request[0]!, 0x03, ILLEGAL_DATA_VALUE)
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const slaveId = request[0]!
  const startAddress = request.readUInt16BE(2)
  const quantity = request.readUInt16BE(4)

  const byteCount = quantity * 2
  const response = Buffer.alloc(3 + byteCount)

  response[0] = slaveId
  response[1] = 0x03
  response[2] = byteCount

  for (let i = 0; i < quantity; i++) {
    const value = device.getHoldingRegister(startAddress + i)
    response.writeUInt16BE(value, 3 + i * 2)
  }

  verboseLogger?.logRead(slaveId, 0x03, startAddress, quantity, response)

  return response
}

/**
 * 0x04 - Read Input Registers
 */
function handleReadInputRegisters(
  device: EmulatedDevice,
  request: Buffer,
  verboseLogger?: VerboseLogger
): Buffer {
  if (request.length < 6) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return createExceptionResponse(request[0]!, 0x04, ILLEGAL_DATA_VALUE)
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const slaveId = request[0]!
  const startAddress = request.readUInt16BE(2)
  const quantity = request.readUInt16BE(4)

  const byteCount = quantity * 2
  const response = Buffer.alloc(3 + byteCount)

  response[0] = slaveId
  response[1] = 0x04
  response[2] = byteCount

  for (let i = 0; i < quantity; i++) {
    const value = device.getInputRegister(startAddress + i)
    response.writeUInt16BE(value, 3 + i * 2)
  }

  verboseLogger?.logRead(slaveId, 0x04, startAddress, quantity, response)

  return response
}

/**
 * 0x05 - Write Single Coil
 */
function handleWriteSingleCoil(
  device: EmulatedDevice,
  request: Buffer,
  verboseLogger?: VerboseLogger
): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const slaveId = request[0]!
  if (request.length < 6) {
    return createExceptionResponse(slaveId, 0x05, ILLEGAL_DATA_VALUE)
  }

  const address = request.readUInt16BE(2)
  const value = request.readUInt16BE(4)
  if (value !== COIL_ON && value !== 0x0000) {
    return createExceptionResponse(slaveId, 0x05, ILLEGAL_DATA_VALUE)
  }

  device.setCoil(address, value === COIL_ON)

  verboseLogger?.logWrite(slaveId, 0x05, address, 1, [value === COIL_ON ? 1 : 0])

  // Echo the request as response
  return request
}

/**
 * 0x06 - Write Single Register
 */
function handleWriteSingleRegister(
  device: EmulatedDevice,
  request: Buffer,
  verboseLogger?: VerboseLogger
): Buffer {
  if (request.length < 6) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return createExceptionResponse(request[0]!, 0x06, ILLEGAL_DATA_VALUE)
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const slaveId = request[0]!
  const address = request.readUInt16BE(2)
  const value = request.readUInt16BE(4)

  device.setHoldingRegister(address, value)

  if (verboseLogger) {
    verboseLogger.logWrite(slaveId, 0x06, address, 1, [value])
  }

  // Echo the request as response
  return request
}

/**
 * 0x0F - Write Multiple Coils
 *
 * The request packs the bits into bytes, the lowest address in the least significant bit of
 * the first byte. The request is checked as a whole before the first coil is written.
 */
function handleWriteMultipleCoils(
  device: EmulatedDevice,
  request: Buffer,
  verboseLogger?: VerboseLogger
): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const slaveId = request[0]!
  if (request.length < 7) {
    return createExceptionResponse(slaveId, 0x0f, ILLEGAL_DATA_VALUE)
  }

  const startAddress = request.readUInt16BE(2)
  const quantity = request.readUInt16BE(4)
  const byteCount = request.readUInt8(6)
  if (
    quantity < 1 ||
    quantity > MAX_WRITE_COILS ||
    byteCount !== Math.ceil(quantity / 8) ||
    request.length < 7 + byteCount
  ) {
    return createExceptionResponse(slaveId, 0x0f, ILLEGAL_DATA_VALUE)
  }
  if (startAddress + quantity > COIL_ADDRESS_COUNT) {
    return createExceptionResponse(slaveId, 0x0f, ILLEGAL_DATA_ADDRESS)
  }

  const values: number[] = []
  for (let i = 0; i < quantity; i++) {
    const bit = (request.readUInt8(7 + (i >> 3)) >> (i & 7)) & 1
    device.setCoil(startAddress + i, bit === 1)
    values.push(bit)
  }

  verboseLogger?.logWrite(slaveId, 0x0f, startAddress, quantity, values)

  // Response: slave_id + function_code + start_address + quantity
  const response = Buffer.alloc(6)
  response[0] = slaveId
  response[1] = 0x0f
  response.writeUInt16BE(startAddress, 2)
  response.writeUInt16BE(quantity, 4)

  return response
}

/**
 * 0x10 - Write Multiple Registers
 */
function handleWriteMultipleRegisters(
  device: EmulatedDevice,
  request: Buffer,
  verboseLogger?: VerboseLogger
): Buffer {
  if (request.length < 7) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return createExceptionResponse(request[0]!, 0x10, ILLEGAL_DATA_VALUE)
  }

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const slaveId = request[0]!
  const startAddress = request.readUInt16BE(2)
  const quantity = request.readUInt16BE(4)
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const byteCount = request[6]!

  if (request.length < 7 + byteCount) {
    return createExceptionResponse(slaveId, 0x10, ILLEGAL_DATA_VALUE)
  }

  // Write registers
  const values: number[] = []
  for (let i = 0; i < quantity; i++) {
    const value = request.readUInt16BE(7 + i * 2)
    device.setHoldingRegister(startAddress + i, value)
    values.push(value)
  }

  // Log write operation if verbose logging enabled
  if (verboseLogger) {
    verboseLogger.logWrite(slaveId, 0x10, startAddress, quantity, values)
  }

  // Response: slave_id + function_code + start_address + quantity
  const response = Buffer.alloc(6)
  response[0] = slaveId
  response[1] = 0x10
  response.writeUInt16BE(startAddress, 2)
  response.writeUInt16BE(quantity, 4)

  return response
}

/**
 * Create a Modbus exception response
 */
function createExceptionResponse(
  slaveId: number,
  functionCode: number,
  exceptionCode: number
): Buffer {
  const response = Buffer.alloc(3)
  response[0] = slaveId
  response[1] = functionCode | 0x80 // Set error bit
  response[2] = exceptionCode
  return response
}
