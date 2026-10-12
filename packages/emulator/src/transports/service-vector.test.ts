/**
 * Tests for the service vector shared by the TCP and RTU transports
 */

import { describe, it, expect, jest } from '@jest/globals'

import { GATEWAY_TARGET_DEVICE_FAILED } from '../utils/modbus-protocol-helpers.js'

import { createServiceVector, type RequestHandler } from './service-vector.js'
import { callServiceVector } from './test-helpers.js'

type VectorMethods = Record<string, (...args: unknown[]) => unknown>

const UNIT_ID = 7

const createVector = (handler?: RequestHandler): VectorMethods =>
  createServiceVector(() => handler) as unknown as VectorMethods

// Read methods deliver their result through a callback
const READ_CALLS = [
  { method: 'getHoldingRegister', args: [10, UNIT_ID], functionCode: 0x03 },
  { method: 'getInputRegister', args: [10, UNIT_ID], functionCode: 0x04 },
  { method: 'getMultipleHoldingRegisters', args: [10, 2, UNIT_ID], functionCode: 0x03 },
  { method: 'getMultipleInputRegisters', args: [10, 2, UNIT_ID], functionCode: 0x04 },
  { method: 'getCoil', args: [10, UNIT_ID], functionCode: 0x01 },
  { method: 'getDiscreteInput', args: [10, UNIT_ID], functionCode: 0x02 },
]

const respondWith = (bytes: number[]): jest.MockedFunction<RequestHandler> =>
  jest.fn<RequestHandler>().mockResolvedValue(Buffer.from(bytes))

describe('createServiceVector', () => {
  it.each([
    {
      method: 'getHoldingRegister',
      args: [10, UNIT_ID],
      functionCode: 0x03,
      response: [UNIT_ID, 0x03, 0x02, 0x00, 0xe6],
      request: [UNIT_ID, 0x03, 0x00, 0x0a, 0x00, 0x01],
      expected: 230,
    },
    {
      method: 'getInputRegister',
      args: [10, UNIT_ID],
      functionCode: 0x04,
      response: [UNIT_ID, 0x04, 0x02, 0x00, 0x34],
      request: [UNIT_ID, 0x04, 0x00, 0x0a, 0x00, 0x01],
      expected: 52,
    },
    {
      method: 'getMultipleHoldingRegisters',
      args: [10, 2, UNIT_ID],
      functionCode: 0x03,
      response: [UNIT_ID, 0x03, 0x04, 0x00, 0xe6, 0x00, 0x34],
      request: [UNIT_ID, 0x03, 0x00, 0x0a, 0x00, 0x02],
      expected: [230, 52],
    },
    {
      method: 'getMultipleInputRegisters',
      args: [10, 2, UNIT_ID],
      functionCode: 0x04,
      response: [UNIT_ID, 0x04, 0x04, 0x00, 0xe6, 0x00, 0x34],
      request: [UNIT_ID, 0x04, 0x00, 0x0a, 0x00, 0x02],
      expected: [230, 52],
    },
    {
      method: 'getCoil',
      args: [10, UNIT_ID],
      functionCode: 0x01,
      response: [UNIT_ID, 0x01, 0x01, 0x01],
      request: [UNIT_ID, 0x01, 0x00, 0x0a, 0x00, 0x01],
      expected: true,
    },
    {
      method: 'getDiscreteInput',
      args: [10, UNIT_ID],
      functionCode: 0x02,
      response: [UNIT_ID, 0x02, 0x01, 0x00],
      request: [UNIT_ID, 0x02, 0x00, 0x0a, 0x00, 0x01],
      expected: false,
    },
  ])(
    '$method sends function code $functionCode and returns the parsed value',
    async ({ method, args, response, request, expected }) => {
      const handler = respondWith(response)
      const vector = createVector(handler)

      const result = await callServiceVector(vector[method]!, ...args)

      expect(result).toEqual(expected)
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(UNIT_ID, Buffer.from(request))
    }
  )

  it.each([
    {
      method: 'setRegister',
      args: [10, 230, UNIT_ID],
      request: [UNIT_ID, 0x06, 0x00, 0x0a, 0x00, 0xe6],
      response: [UNIT_ID, 0x06, 0x00, 0x0a, 0x00, 0xe6],
    },
    {
      method: 'setRegisterArray',
      args: [10, [230, 52], UNIT_ID],
      request: [UNIT_ID, 0x10, 0x00, 0x0a, 0x00, 0x02, 0x04, 0x00, 0xe6, 0x00, 0x34],
      response: [UNIT_ID, 0x10, 0x00, 0x0a, 0x00, 0x02],
    },
    {
      method: 'setCoil',
      args: [10, true, UNIT_ID],
      request: [UNIT_ID, 0x05, 0x00, 0x0a, 0xff, 0x00],
      response: [UNIT_ID, 0x05, 0x00, 0x0a, 0xff, 0x00],
    },
    {
      method: 'setCoil',
      args: [10, false, UNIT_ID],
      request: [UNIT_ID, 0x05, 0x00, 0x0a, 0x00, 0x00],
      response: [UNIT_ID, 0x05, 0x00, 0x0a, 0x00, 0x00],
    },
  ])('$method($args) forwards the write request', async ({ method, args, request, response }) => {
    const handler = respondWith(response)
    const vector = createVector(handler)

    await vector[method]!(...args)

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(UNIT_ID, Buffer.from(request))
  })

  it.each(READ_CALLS)(
    '$method rejects when no request handler is set',
    async ({ method, args }) => {
      const vector = createVector()

      await expect(callServiceVector(vector[method]!, ...args)).rejects.toThrow(
        'No request handler set'
      )
    }
  )

  it.each([
    { method: 'setRegister', args: [10, 230, UNIT_ID] },
    { method: 'setRegisterArray', args: [10, [230], UNIT_ID] },
    { method: 'setCoil', args: [10, true, UNIT_ID] },
  ])('$method rejects when no request handler is set', async ({ method, args }) => {
    const vector = createVector()

    await expect(vector[method]!(...args)).rejects.toThrow('No request handler set')
  })

  it.each(READ_CALLS)('$method passes handler errors to the callback', async ({ method, args }) => {
    const failure = new Error('device offline')
    const vector = createVector(jest.fn<RequestHandler>().mockRejectedValue(failure))

    await expect(callServiceVector(vector[method]!, ...args)).rejects.toBe(failure)
  })

  it.each(READ_CALLS)(
    '$method wraps non-Error rejections in an Error',
    async ({ method, args }) => {
      const vector = createVector(jest.fn<RequestHandler>().mockRejectedValue('device offline'))

      const error = await callServiceVector(vector[method]!, ...args).catch((err: unknown) => err)

      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('device offline')
    }
  )

  it.each([
    { method: 'getHoldingRegister', args: [10, UNIT_ID], fallback: 0 },
    { method: 'getInputRegister', args: [10, UNIT_ID], fallback: 0 },
    { method: 'getMultipleHoldingRegisters', args: [10, 2, UNIT_ID], fallback: [] },
    { method: 'getMultipleInputRegisters', args: [10, 2, UNIT_ID], fallback: [] },
    { method: 'getCoil', args: [10, UNIT_ID], fallback: false },
    { method: 'getDiscreteInput', args: [10, UNIT_ID], fallback: false },
  ])(
    '$method passes $fallback as the value when the request fails',
    async ({ method, args, fallback }) => {
      const vector = createVector(jest.fn<RequestHandler>().mockRejectedValue(new Error('offline')))
      const callback = jest.fn()

      vector[method]!(...args, callback)
      await new Promise((resolve) => setImmediate(resolve))

      expect(callback).toHaveBeenCalledWith(expect.any(Error), fallback)
    }
  )

  it.each([
    { method: 'setRegister', args: [10, 230, UNIT_ID] },
    { method: 'setRegisterArray', args: [10, [230], UNIT_ID] },
    { method: 'setCoil', args: [10, true, UNIT_ID] },
  ])('$method rejects when the request handler fails', async ({ method, args }) => {
    const failure = new Error('device offline')
    const vector = createVector(jest.fn<RequestHandler>().mockRejectedValue(failure))

    await expect(vector[method]!(...args)).rejects.toBe(failure)
  })

  it.each([
    { method: 'getHoldingRegister', functionCode: 0x03 },
    { method: 'getInputRegister', functionCode: 0x04 },
  ])('$method returns 0 for an empty response', async ({ method, functionCode }) => {
    const vector = createVector(respondWith([UNIT_ID, functionCode, 0x00]))

    await expect(callServiceVector(vector[method]!, 10, UNIT_ID)).resolves.toBe(0)
  })

  it('rejects when the response unit ID does not match the request', async () => {
    const vector = createVector(respondWith([UNIT_ID + 1, 0x03, 0x02, 0x00, 0xe6]))

    await expect(callServiceVector(vector['getHoldingRegister']!, 10, UNIT_ID)).rejects.toThrow(
      'Response unitID mismatch'
    )
  })

  it('uses the request handler that is set when a request arrives', async () => {
    let current: RequestHandler | undefined
    const vector = createServiceVector(() => current) as unknown as VectorMethods

    const first = respondWith([UNIT_ID, 0x03, 0x02, 0x00, 0x01])
    const second = respondWith([UNIT_ID, 0x03, 0x02, 0x00, 0x02])

    current = first
    await expect(callServiceVector(vector['getHoldingRegister']!, 0, UNIT_ID)).resolves.toBe(1)
    current = second
    await expect(callServiceVector(vector['getHoldingRegister']!, 0, UNIT_ID)).resolves.toBe(2)

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  describe('exception responses', () => {
    const WRITE_CALLS = [
      { method: 'setRegister', args: [10, 230, UNIT_ID], functionCode: 0x06 },
      { method: 'setRegisterArray', args: [10, [230], UNIT_ID], functionCode: 0x10 },
      { method: 'setCoil', args: [10, true, UNIT_ID], functionCode: 0x05 },
    ]
    const exceptionFor = (functionCode: number, exceptionCode: number): number[] => [
      UNIT_ID,
      functionCode | 0x80,
      exceptionCode,
    ]

    // Issue #561: the response of a write was dropped, so the client got a success response
    it.each(WRITE_CALLS)(
      '$method rejects with the exception code of the response',
      async ({ method, args, functionCode }) => {
        const vector = createVector(respondWith(exceptionFor(functionCode, 0x03)))

        await expect(vector[method]!(...args)).rejects.toMatchObject({
          message: `Modbus exception response: function code ${functionCode}, exception code 3`,
          modbusErrorCode: 0x03,
        })
      }
    )

    it.each([
      { name: 'unit ID', response: [UNIT_ID + 1, 0x06, 0x00, 0x0a, 0x00, 0xe6], error: 'unitID' },
      {
        name: 'function code',
        response: [UNIT_ID, 0x10, 0x00, 0x0a, 0x00, 0x01],
        error: 'function code',
      },
      { name: 'length', response: [UNIT_ID, 0x06], error: 'too short' },
    ])(
      'setRegister rejects when the $name of the response is wrong',
      async ({ response, error }) => {
        const vector = createVector(respondWith(response))

        await expect(vector['setRegister']!(10, 230, UNIT_ID)).rejects.toThrow(error)
      }
    )

    it.each(READ_CALLS)(
      '$method passes the exception code of the response to the callback',
      async ({ method, args, functionCode }) => {
        const vector = createVector(respondWith(exceptionFor(functionCode, 0x02)))

        await expect(callServiceVector(vector[method]!, ...args)).rejects.toMatchObject({
          modbusErrorCode: 0x02,
        })
      }
    )

    it('answers a request for a slave ID without a device with exception 0x0B by default', async () => {
      const vector = createVector(respondWith(exceptionFor(0x06, GATEWAY_TARGET_DEVICE_FAILED)))

      await expect(vector['setRegister']!(10, 230, UNIT_ID)).rejects.toMatchObject({
        modbusErrorCode: GATEWAY_TARGET_DEVICE_FAILED,
      })
    })
  })

  describe('unknownSlave: silence', () => {
    // A slave on a serial line sends no response when the address is not its own
    const createSilentVector = (handler: RequestHandler): VectorMethods =>
      createServiceVector(() => handler, { unknownSlave: 'silence' }) as unknown as VectorMethods
    const noDevice = (functionCode: number): RequestHandler =>
      jest
        .fn<RequestHandler>()
        .mockResolvedValue(
          Buffer.from([UNIT_ID, functionCode | 0x80, GATEWAY_TARGET_DEVICE_FAILED])
        )

    // Gives modbus-serial time to answer, then reports whether it did
    const waitsForAnswer = (answer: Promise<unknown>): Promise<boolean> =>
      Promise.race([
        answer.then(
          () => true,
          () => true
        ),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 50)),
      ])

    it.each([
      { method: 'setRegister', args: [10, 230, UNIT_ID], functionCode: 0x06 },
      { method: 'setRegisterArray', args: [10, [230], UNIT_ID], functionCode: 0x10 },
      { method: 'setCoil', args: [10, true, UNIT_ID], functionCode: 0x05 },
    ])(
      '$method never settles for a slave ID without a device',
      async ({ method, args, functionCode }) => {
        const vector = createSilentVector(noDevice(functionCode))

        await expect(waitsForAnswer(vector[method]!(...args) as Promise<void>)).resolves.toBe(false)
      }
    )

    it.each(READ_CALLS)(
      '$method never calls the callback for a slave ID without a device',
      async ({ method, args, functionCode }) => {
        const vector = createSilentVector(noDevice(functionCode))
        const callback = jest.fn()

        vector[method]!(...args, callback)
        await new Promise((resolve) => setTimeout(resolve, 50))

        expect(callback).not.toHaveBeenCalled()
      }
    )

    it('still answers other exceptions', async () => {
      const handler = respondWith([UNIT_ID, 0x06 | 0x80, 0x03])
      const vector = createSilentVector(handler)

      await expect(vector['setRegister']!(10, 230, UNIT_ID)).rejects.toMatchObject({
        modbusErrorCode: 0x03,
      })
    })
  })
})
