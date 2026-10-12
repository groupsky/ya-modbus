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
  validateWriteResponse,
  ModbusExceptionError,
  GATEWAY_TARGET_DEVICE_FAILED,
} from '../utils/modbus-protocol-helpers.js'

export type RequestHandler = (slaveId: number, request: Buffer) => Promise<Buffer>

export interface ServiceVectorOptions {
  /**
   * What a request for a slave ID that has no device gets. 'exception' answers with exception
   * 0x0B (Gateway Target Device Failed to Respond), as a Modbus TCP gateway does. 'silence'
   * sends no response, as a slave on a serial line does for an address that is not its own,
   * so the client runs into its timeout. Default: 'exception'.
   */
  unknownSlave?: 'exception' | 'silence'
}

/**
 * Create a service vector that forwards every modbus-serial call to the request handler.
 *
 * The handler is looked up on every call, so it can be registered or replaced after the
 * server has been created.
 *
 * An exception response of the handler is thrown as a ModbusExceptionError, and modbus-serial
 * answers the client with its exception code.
 */
export function createServiceVector(
  getRequestHandler: () => RequestHandler | undefined,
  options: ServiceVectorOptions = {}
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
    const response = await requestHandler(unitID, request)
    validateWriteResponse(response, { unitID, functionCode })
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
    const response = await requestHandler(unitID, request)
    validateWriteResponse(response, { unitID, functionCode })
  }

  // The emulator answers exception 0x0B only for a slave ID that has no device
  const isSilenced = (err: unknown): boolean =>
    options.unknownSlave === 'silence' &&
    err instanceof ModbusExceptionError &&
    err.modbusErrorCode === GATEWAY_TARGET_DEVICE_FAILED

  // Passes the result of a read to the modbus-serial callback
  const replyToRead = <T>(
    result: Promise<T>,
    cb: (err: Error | null, value: T) => void,
    fallback: T
  ): void => {
    result
      .then((value) => cb(null, value))
      .catch((err: unknown) => {
        // modbus-serial sends a response only when the callback is called
        if (!isSilenced(err)) {
          cb(err instanceof Error ? err : new Error(String(err)), fallback)
        }
      })
  }

  // Returns the result of a write to modbus-serial
  const replyToWrite = (result: Promise<void>): Promise<void> =>
    result.catch((err: unknown) => {
      if (isSilenced(err)) {
        // modbus-serial sends a response only when the promise settles. A new promise for
        // every call, because the handlers that modbus-serial attaches to it pile up.
        return new Promise<void>(() => undefined)
      }
      throw err
    })

  // Note: Use callback-style for read operations due to modbus-serial bug where
  // Promise-based callbacks are not properly awaited (see #303, yaacov/node-modbus-serial#548)
  return {
    getHoldingRegister: (
      addr: number,
      unitID: number,
      cb: (err: Error | null, value: number) => void
    ) => {
      replyToRead(
        handleRegisterRead(unitID, 0x03, addr, 1).then((values) => values[0] ?? 0),
        cb,
        0
      )
    },
    getInputRegister: (
      addr: number,
      unitID: number,
      cb: (err: Error | null, value: number) => void
    ) => {
      replyToRead(
        handleRegisterRead(unitID, 0x04, addr, 1).then((values) => values[0] ?? 0),
        cb,
        0
      )
    },
    getMultipleHoldingRegisters: (
      addr: number,
      length: number,
      unitID: number,
      cb: (err: Error | null, values: number[]) => void
    ) => {
      replyToRead(handleRegisterRead(unitID, 0x03, addr, length), cb, [])
    },
    getMultipleInputRegisters: (
      addr: number,
      length: number,
      unitID: number,
      cb: (err: Error | null, values: number[]) => void
    ) => {
      replyToRead(handleRegisterRead(unitID, 0x04, addr, length), cb, [])
    },
    setRegister: (addr: number, value: number, unitID: number) =>
      replyToWrite(handleRegisterWrite(unitID, 0x06, addr, [value])),
    setRegisterArray: (addr: number, values: number[], unitID: number) =>
      replyToWrite(handleRegisterWrite(unitID, 0x10, addr, values)),
    getCoil: (addr: number, unitID: number, cb: (err: Error | null, value: boolean) => void) => {
      replyToRead(handleCoilRead(unitID, 0x01, addr, 1), cb, false)
    },
    getDiscreteInput: (
      addr: number,
      unitID: number,
      cb: (err: Error | null, value: boolean) => void
    ) => {
      replyToRead(handleCoilRead(unitID, 0x02, addr, 1), cb, false)
    },
    setCoil: (addr: number, value: boolean, unitID: number) =>
      replyToWrite(handleCoilWrite(unitID, 0x05, addr, value)),
  }
}
