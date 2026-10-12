/**
 * Tests for the service vector shared by the TCP and RTU transports
 */

import { describe, it, expect, jest } from '@jest/globals'

import { createServiceVector, type RequestHandler } from './service-vector.js'
import { callServiceVector } from './test-helpers.js'

type VectorMethods = Record<string, (...args: unknown[]) => unknown>

const UNIT_ID = 7

const createVector = (handler?: RequestHandler): VectorMethods =>
  createServiceVector(() => handler) as unknown as VectorMethods

// Read methods deliver their result through a callback
const READ_CALLS = [
  { method: 'getHoldingRegister', args: [10, UNIT_ID] },
  { method: 'getInputRegister', args: [10, UNIT_ID] },
  { method: 'getMultipleHoldingRegisters', args: [10, 2, UNIT_ID] },
  { method: 'getMultipleInputRegisters', args: [10, 2, UNIT_ID] },
  { method: 'getCoil', args: [10, UNIT_ID] },
  { method: 'getDiscreteInput', args: [10, UNIT_ID] },
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
    },
    {
      method: 'setRegisterArray',
      args: [10, [230, 52], UNIT_ID],
      request: [UNIT_ID, 0x10, 0x00, 0x0a, 0x00, 0x02, 0x04, 0x00, 0xe6, 0x00, 0x34],
    },
    {
      method: 'setCoil',
      args: [10, true, UNIT_ID],
      request: [UNIT_ID, 0x05, 0x00, 0x0a, 0xff, 0x00],
    },
    {
      method: 'setCoil',
      args: [10, false, UNIT_ID],
      request: [UNIT_ID, 0x05, 0x00, 0x0a, 0x00, 0x00],
    },
  ])('$method($args) forwards the write request', async ({ method, args, request }) => {
    const handler = respondWith([UNIT_ID, 0x00, 0x00, 0x00, 0x00, 0x00])
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
})
