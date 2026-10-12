/**
 * Modbus protocol buffer building and parsing utilities
 *
 * These pure functions handle the low-level Modbus protocol details
 * (buffer construction, parsing) independent of the transport layer.
 */

export interface RegisterReadRequest {
  unitID: number
  functionCode: number
  addr: number
  length: number
}

export interface RegisterWriteRequest {
  unitID: number
  functionCode: number
  addr: number
  values: number[]
}

export interface CoilReadRequest {
  unitID: number
  functionCode: number
  addr: number
  length: number
}

export interface CoilWriteRequest {
  unitID: number
  functionCode: number
  addr: number
  value: boolean
}

/** Exception code of a request for a slave ID that has no device */
export const GATEWAY_TARGET_DEVICE_FAILED = 0x0b

/**
 * A Modbus exception response. modbus-serial reads `modbusErrorCode` from an error that a
 * service vector function throws and answers the client with that exception code.
 */
export class ModbusExceptionError extends Error {
  readonly modbusErrorCode: number

  constructor(functionCode: number, exceptionCode: number) {
    super(
      `Modbus exception response: function code ${functionCode}, exception code ${exceptionCode}`
    )
    this.name = 'ModbusExceptionError'
    this.modbusErrorCode = exceptionCode
  }
}

/**
 * Validates common Modbus response header fields
 * Returns the validated byteCount for further processing
 */
function validateModbusResponseHeader(
  response: Buffer,
  request: { unitID: number; functionCode: number }
): number {
  // Validate minimum response length
  if (response.length < 3) {
    throw new Error(
      `Invalid response: buffer length ${response.length} is too short (minimum 3 bytes)`
    )
  }

  const responseUnitID = response[0]
  const responseFunctionCode = response[1]
  const byteCount = response[2]

  // Validate unitID matches
  if (responseUnitID !== request.unitID) {
    throw new Error(`Response unitID mismatch: expected ${request.unitID}, got ${responseUnitID}`)
  }

  // Check for Modbus exception response (function code with 0x80 bit set)
  if (responseFunctionCode !== undefined && (responseFunctionCode & 0x80) !== 0) {
    // In exception responses, byte 2 is the exception code
    throw new ModbusExceptionError(request.functionCode, response.readUInt8(2))
  }

  // Validate function code matches
  if (responseFunctionCode !== request.functionCode) {
    throw new Error(
      `Response function code mismatch: expected ${request.functionCode}, got ${responseFunctionCode}`
    )
  }

  // Validate byte count exists
  if (byteCount === undefined) {
    throw new Error('Invalid response: byte count is undefined')
  }

  return byteCount
}

/**
 * Builds a Modbus register read request buffer
 */
export function buildRegisterReadRequest(params: RegisterReadRequest): Buffer {
  const request = Buffer.alloc(6)
  request[0] = params.unitID
  request[1] = params.functionCode
  request.writeUInt16BE(params.addr, 2)
  request.writeUInt16BE(params.length, 4)
  return request
}

/**
 * Parses register values from a Modbus response buffer
 */
export function parseRegisterReadResponse(
  response: Buffer,
  request: { unitID: number; functionCode: number }
): number[] {
  const byteCount = validateModbusResponseHeader(response, request)

  // Validate byte count is even (registers are 16-bit)
  if (byteCount % 2 !== 0) {
    throw new Error(`Invalid byte count: ${byteCount} (must be even for 16-bit registers)`)
  }

  // Validate byte count does not exceed Modbus maximum
  if (byteCount > 250) {
    throw new Error(`Invalid byte count: ${byteCount} (maximum is 250)`)
  }

  // Validate buffer length matches expected length
  const expectedLength = 3 + byteCount
  if (response.length !== expectedLength) {
    throw new Error(
      `Invalid response: buffer length ${response.length} does not match expected length ${expectedLength} (3 + byteCount ${byteCount})`
    )
  }

  const values: number[] = []
  for (let i = 0; i < byteCount / 2; i++) {
    values.push(response.readUInt16BE(3 + i * 2))
  }
  return values
}

/**
 * Builds a Modbus register write request buffer
 * Handles both single (0x06) and multiple (0x10) register writes
 */
export function buildRegisterWriteRequest(params: RegisterWriteRequest): Buffer {
  if (params.functionCode === 0x06) {
    // Write single register
    const request = Buffer.alloc(6)
    request[0] = params.unitID
    request[1] = params.functionCode
    request.writeUInt16BE(params.addr, 2)
    request.writeUInt16BE(params.values[0] ?? 0, 4)
    return request
  } else {
    // Write multiple registers
    const byteCount = params.values.length * 2
    const request = Buffer.alloc(7 + byteCount)
    request[0] = params.unitID
    request[1] = params.functionCode
    request.writeUInt16BE(params.addr, 2)
    request.writeUInt16BE(params.values.length, 4)
    request[6] = byteCount
    for (let i = 0; i < params.values.length; i++) {
      request.writeUInt16BE(params.values[i] ?? 0, 7 + i * 2)
    }
    return request
  }
}

/**
 * Builds a Modbus coil read request buffer
 */
export function buildCoilReadRequest(params: CoilReadRequest): Buffer {
  const request = Buffer.alloc(6)
  request[0] = params.unitID
  request[1] = params.functionCode
  request.writeUInt16BE(params.addr, 2)
  request.writeUInt16BE(params.length, 4)
  return request
}

/**
 * Parses a single coil value from a Modbus response buffer
 */
export function parseCoilReadResponse(
  response: Buffer,
  request: { unitID: number; functionCode: number }
): boolean {
  const byteCount = validateModbusResponseHeader(response, request)

  // Validate byte count does not exceed Modbus maximum
  if (byteCount > 250) {
    throw new Error(`Invalid byte count: ${byteCount} (maximum is 250)`)
  }

  // Validate buffer length matches expected length
  const expectedLength = 3 + byteCount
  if (response.length !== expectedLength) {
    throw new Error(
      `Invalid response: buffer length ${response.length} does not match expected length ${expectedLength} (3 + byteCount ${byteCount})`
    )
  }

  const coilByte = response[3]
  if (coilByte === undefined) {
    throw new Error('Invalid response: coil data byte is undefined')
  }
  return (coilByte & 0x01) === 1
}

/**
 * Builds a Modbus coil write request buffer
 */
export function buildCoilWriteRequest(params: CoilWriteRequest): Buffer {
  const request = Buffer.alloc(6)
  request[0] = params.unitID
  request[1] = params.functionCode
  request.writeUInt16BE(params.addr, 2)
  request.writeUInt16BE(params.value ? 0xff00 : 0x0000, 4)
  return request
}

/**
 * Validates the response to a write request (function codes 0x05, 0x06 and 0x10)
 *
 * Throws a ModbusExceptionError for an exception response, so that the client gets the
 * exception code. The write response itself carries nothing that the caller needs.
 */
export function validateWriteResponse(
  response: Buffer,
  request: { unitID: number; functionCode: number }
): void {
  validateModbusResponseHeader(response, request)
}
