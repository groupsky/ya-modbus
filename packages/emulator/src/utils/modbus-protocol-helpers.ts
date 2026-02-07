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
export function parseRegisterReadResponse(response: Buffer): number[] {
  const byteCount = response[2]
  if (byteCount === undefined || response.length < 3 + byteCount) {
    throw new Error('Invalid response')
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
export function parseCoilReadResponse(response: Buffer): boolean {
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
