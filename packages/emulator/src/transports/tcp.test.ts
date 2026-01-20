/**
 * Tests for TCP transport
 */

import { TcpTransport } from './tcp.js'

describe('TcpTransport', () => {
  describe('lifecycle', () => {
    it('starts and stops successfully', async () => {
      const transport = new TcpTransport({ port: 0 })
      await transport.start()
      expect(transport.getPort()).toBeGreaterThan(0)
      await transport.stop()
      expect(transport.getPort()).toBe(0)
    })

    it('rejects operations when not started', async () => {
      const transport = new TcpTransport({ port: 0 })
      await expect(transport.send(1, Buffer.from([0x01, 0x03]))).rejects.toThrow(
        'Transport not started'
      )
    })

    it('allows multiple start/stop cycles', async () => {
      const transport = new TcpTransport({ port: 0 })

      await transport.start()
      expect(transport.getPort()).toBeGreaterThan(0)
      await transport.stop()

      await transport.start()
      expect(transport.getPort()).toBeGreaterThan(0)
      await transport.stop()
    })

    it('returns actual port after starting with port 0', async () => {
      const transport = new TcpTransport({ port: 0 })
      await transport.start()

      const port = transport.getPort()
      expect(port).toBeGreaterThan(0)

      await transport.stop()
    })
  })

  describe('service vector integration', () => {
    it('handles read holding registers request', async () => {
      const transport = new TcpTransport({ port: 0 })

      // Set up request handler that returns test data
      let receivedRequest: Buffer | null = null
      transport.onRequest((slaveId: number, request: Buffer) => {
        receivedRequest = request
        // Response: [SlaveID][FunctionCode][ByteCount][Data...]
        const response = Buffer.from([slaveId, 0x03, 0x04, 0x12, 0x34, 0x56, 0x78])
        return Promise.resolve(response)
      })

      await transport.start()
      const port = transport.getPort()

      // Create a client and send a request
      const { createTCPTransport } = await import('@ya-modbus/transport')
      const client = await createTCPTransport({
        host: '127.0.0.1',
        port,
        slaveId: 1,
      })

      try {
        // Read 2 registers starting at address 0
        const buffer = await client.readHoldingRegisters(0, 2)

        // Verify request was received
        expect(receivedRequest).not.toBeNull()
        expect(receivedRequest?.[0]).toBe(1) // Slave ID
        expect(receivedRequest?.[1]).toBe(0x03) // Function code

        // Verify response data (Buffer contains register values as big-endian uint16)
        expect(buffer.readUInt16BE(0)).toBe(0x1234)
        expect(buffer.readUInt16BE(2)).toBe(0x5678)
      } finally {
        await client.close()
        await transport.stop()
      }
    })

    it('handles write single register request', async () => {
      const transport = new TcpTransport({ port: 0 })

      let receivedRequest: Buffer | null = null
      transport.onRequest((slaveId: number, request: Buffer) => {
        receivedRequest = request
        // Echo back the write request
        return Promise.resolve(request)
      })

      await transport.start()
      const port = transport.getPort()

      const { createTCPTransport } = await import('@ya-modbus/transport')
      const client = await createTCPTransport({
        host: '127.0.0.1',
        port,
        slaveId: 1,
      })

      try {
        // Write value 0x1234 to register 0
        await client.writeSingleRegister(0, 0x1234)

        // Verify request
        expect(receivedRequest).not.toBeNull()
        expect(receivedRequest?.[0]).toBe(1) // Slave ID
        expect(receivedRequest?.[1]).toBe(0x06) // Function code (write single)
      } finally {
        await client.close()
        await transport.stop()
      }
    })
  })

  describe('multiple connections', () => {
    it('handles multiple concurrent clients', async () => {
      const transport = new TcpTransport({ port: 0 })

      const requests: Buffer[] = []
      transport.onRequest((slaveId: number, request: Buffer) => {
        requests.push(Buffer.from(request))
        // Return simple response
        return Promise.resolve(Buffer.from([slaveId, 0x03, 0x02, 0x00, 0x01]))
      })

      await transport.start()
      const port = transport.getPort()

      const { createTCPTransport } = await import('@ya-modbus/transport')

      // Create two clients
      const client1 = await createTCPTransport({
        host: '127.0.0.1',
        port,
        slaveId: 1,
      })
      const client2 = await createTCPTransport({
        host: '127.0.0.1',
        port,
        slaveId: 2,
      })

      try {
        // Both clients make requests
        await Promise.all([client1.readHoldingRegisters(0, 1), client2.readHoldingRegisters(0, 1)])

        // Both requests should be received
        expect(requests.length).toBe(2)
        expect(requests[0]?.[0]).toBe(1) // Client 1 slave ID
        expect(requests[1]?.[0]).toBe(2) // Client 2 slave ID
      } finally {
        await client1.close()
        await client2.close()
        await transport.stop()
      }
    })
  })

  describe('error handling', () => {
    it('handles request handler errors gracefully', async () => {
      const transport = new TcpTransport({ port: 0 })

      transport.onRequest(() => {
        return Promise.reject(new Error('Handler error'))
      })

      await transport.start()
      const port = transport.getPort()

      const { createTCPTransport } = await import('@ya-modbus/transport')
      const client = await createTCPTransport({
        host: '127.0.0.1',
        port,
        slaveId: 1,
      })

      try {
        // Request should fail or timeout
        await expect(client.readHoldingRegisters(0, 1)).rejects.toThrow()
      } finally {
        await client.close()
        await transport.stop()
      }
    })
  })
})
