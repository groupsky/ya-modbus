/**
 * Service vector shared by the TCP and RTU transports
 *
 * Bridges modbus-serial service vector calls to a transport's request handler.
 */

import type { IServiceVector } from 'modbus-serial/ServerTCP'

import {
  buildRegisterReadRequest,
  parseRegisterReadResponse,
  buildRegisterWriteRequest,
  buildCoilReadRequest,
  parseCoilReadResponse,
  buildCoilWriteRequest,
} from '../utils/modbus-protocol-helpers.js'

export type RequestHandler = (slaveId: number, request: Buffer) => Promise<Buffer>

/**
 * Create a service vector that forwards every modbus-serial call to the request handler.
 *
 * The handler is looked up on every call, so it can be registered or replaced after the
 * server has been created.
 */
export function createServiceVector(
  getRequestHandler: () => RequestHandler | undefined
): IServiceVector {
  const requireRequestHandler = (): RequestHandler => {
    const requestHandler = getRequestHandler()
    if (!requestHandler) {
      throw new Error('No request handler set')
    }
    return requestHandler
  }

  const handleRegisterRead = async (
    unitID: number,
    functionCode: number,
    addr: number,
    length: number
  ): Promise<number[]> => {
    const requestHandler = requireRequestHandler()
    const request = buildRegisterReadRequest({ unitID, functionCode, addr, length })
    const response = await requestHandler(unitID, request)
    return parseRegisterReadResponse(response, { unitID, functionCode })
  }

  const handleRegisterWrite = async (
    unitID: number,
    functionCode: number,
    addr: number,
    values: number[]
  ): Promise<void> => {
    const requestHandler = requireRequestHandler()
    const request = buildRegisterWriteRequest({ unitID, functionCode, addr, values })
    await requestHandler(unitID, request)
  }

  const handleCoilRead = async (
    unitID: number,
    functionCode: number,
    addr: number,
    length: number
  ): Promise<boolean> => {
    const requestHandler = requireRequestHandler()
    const request = buildCoilReadRequest({ unitID, functionCode, addr, length })
    const response = await requestHandler(unitID, request)
    return parseCoilReadResponse(response, { unitID, functionCode })
  }

  const handleCoilWrite = async (
    unitID: number,
    functionCode: number,
    addr: number,
    value: boolean
  ): Promise<void> => {
    const requestHandler = requireRequestHandler()
    const request = buildCoilWriteRequest({ unitID, functionCode, addr, value })
    await requestHandler(unitID, request)
  }

  // Note: Use callback-style for read operations due to modbus-serial bug where
  // Promise-based callbacks are not properly awaited (see #303, yaacov/node-modbus-serial#548)
  return {
    getHoldingRegister: (
      addr: number,
      unitID: number,
      cb: (err: Error | null, value: number) => void
    ) => {
      handleRegisterRead(unitID, 0x03, addr, 1)
        .then((values) => cb(null, values[0] ?? 0))
        .catch((err: unknown) => cb(err instanceof Error ? err : new Error(String(err)), 0))
    },
    getInputRegister: (
      addr: number,
      unitID: number,
      cb: (err: Error | null, value: number) => void
    ) => {
      handleRegisterRead(unitID, 0x04, addr, 1)
        .then((values) => cb(null, values[0] ?? 0))
        .catch((err: unknown) => cb(err instanceof Error ? err : new Error(String(err)), 0))
    },
    getMultipleHoldingRegisters: (
      addr: number,
      length: number,
      unitID: number,
      cb: (err: Error | null, values: number[]) => void
    ) => {
      handleRegisterRead(unitID, 0x03, addr, length)
        .then((values) => cb(null, values))
        .catch((err: unknown) => cb(err instanceof Error ? err : new Error(String(err)), []))
    },
    getMultipleInputRegisters: (
      addr: number,
      length: number,
      unitID: number,
      cb: (err: Error | null, values: number[]) => void
    ) => {
      handleRegisterRead(unitID, 0x04, addr, length)
        .then((values) => cb(null, values))
        .catch((err: unknown) => cb(err instanceof Error ? err : new Error(String(err)), []))
    },
    setRegister: async (addr: number, value: number, unitID: number) => {
      return handleRegisterWrite(unitID, 0x06, addr, [value])
    },
    setRegisterArray: async (addr: number, values: number[], unitID: number) => {
      return handleRegisterWrite(unitID, 0x10, addr, values)
    },
    getCoil: (addr: number, unitID: number, cb: (err: Error | null, value: boolean) => void) => {
      handleCoilRead(unitID, 0x01, addr, 1)
        .then((value) => cb(null, value))
        .catch((err: unknown) => cb(err instanceof Error ? err : new Error(String(err)), false))
    },
    getDiscreteInput: (
      addr: number,
      unitID: number,
      cb: (err: Error | null, value: boolean) => void
    ) => {
      handleCoilRead(unitID, 0x02, addr, 1)
        .then((value) => cb(null, value))
        .catch((err: unknown) => cb(err instanceof Error ? err : new Error(String(err)), false))
    },
    setCoil: async (addr: number, value: boolean, unitID: number) => {
      return handleCoilWrite(unitID, 0x05, addr, value)
    },
  }
}
