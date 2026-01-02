/**
 * Tests for MemoryTransport
 */

import { describe, it, expect, beforeEach } from '@jest/globals'

import { MemoryTransport } from './memory.js'

describe('MemoryTransport', () => {
  let transport: MemoryTransport

  beforeEach(() => {
    transport = new MemoryTransport()
  })

  describe('lifecycle', () => {
    it('should create transport', () => {
      expect(transport).toBeDefined()
    })

    it('should start and stop transport', async () => {
      await expect(transport.start()).resolves.not.toThrow()
      await expect(transport.stop()).resolves.not.toThrow()
    })
  })

  describe('request/response', () => {
    beforeEach(async () => {
      await transport.start()
    })

    it('should send request and receive response', async () => {
      const request = Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01])
      const expectedResponse = Buffer.from([0x01, 0x03, 0x02, 0x00, 0xe6])

      // Set up request handler
      transport.onRequest((slaveId, req) => {
        expect(slaveId).toBe(1)
        expect(req).toEqual(request)
        return Promise.resolve(expectedResponse)
      })

      // Send request and get response
      const response = await transport.sendRequest(1, request)
      expect(response).toEqual(expectedResponse)
    })

    it('should handle multiple requests sequentially', async () => {
      let requestCount = 0

      transport.onRequest((slaveId, _req) => {
        requestCount++
        return Promise.resolve(Buffer.from([slaveId, requestCount]))
      })

      const response1 = await transport.sendRequest(1, Buffer.from([0x01, 0x03]))
      const response2 = await transport.sendRequest(2, Buffer.from([0x02, 0x04]))

      expect(response1).toEqual(Buffer.from([0x01, 0x01]))
      expect(response2).toEqual(Buffer.from([0x02, 0x02]))
      expect(requestCount).toBe(2)
    })

    it('should throw if no request handler set', async () => {
      await expect(transport.sendRequest(1, Buffer.from([0x01, 0x03]))).rejects.toThrow(
        'No request handler set'
      )
    })

    it('should allow sending responses (no-op for memory transport)', async () => {
      await expect(transport.send(1, Buffer.from([0x01, 0x03]))).resolves.not.toThrow()
    })
  })
})
