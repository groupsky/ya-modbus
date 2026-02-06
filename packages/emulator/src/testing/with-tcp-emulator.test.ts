/**
 * Tests for withTcpEmulator helper
 */

import { withTcpEmulator } from './with-tcp-emulator.js'

describe('withTcpEmulator', () => {
  it('provides working TCP emulator with specified registers', async () => {
    await withTcpEmulator(
      {
        slaveId: 1,
        holding: { 0: 0x1234, 1: 0x5678 },
        input: { 0: 0xabcd, 1: 0xef01 },
      },
      async ({ host, port }) => {
        // Create client
        const { createTCPTransport } = await import('@ya-modbus/transport')
        const transport = await createTCPTransport({
          host,
          port,
          slaveId: 1,
        })

        try {
          // Read holding registers
          const holdingBuffer = await transport.readHoldingRegisters(0, 2)
          expect(holdingBuffer.readUInt16BE(0)).toBe(0x1234)
          expect(holdingBuffer.readUInt16BE(2)).toBe(0x5678)

          // Read input registers
          const inputBuffer = await transport.readInputRegisters(0, 2)
          expect(inputBuffer.readUInt16BE(0)).toBe(0xabcd)
          expect(inputBuffer.readUInt16BE(2)).toBe(0xef01)
        } finally {
          await transport.close()
        }
      }
    )
  })

  it('handles write operations', async () => {
    await withTcpEmulator(
      {
        slaveId: 1,
        holding: { 0: 0x0000 },
      },
      async ({ host, port, emulator }) => {
        const { createTCPTransport } = await import('@ya-modbus/transport')
        const transport = await createTCPTransport({
          host,
          port,
          slaveId: 1,
        })

        try {
          // Write a register
          await transport.writeSingleRegister(0, 0x9999)

          // Verify it was written
          const device = emulator.getDevice(1)
          expect(device?.getHoldingRegister(0)).toBe(0x9999)
        } finally {
          await transport.close()
        }
      }
    )
  })

  it('uses dynamic port allocation by default', async () => {
    await withTcpEmulator({ slaveId: 1 }, ({ port }) => {
      expect(port).toBeGreaterThan(0)
      expect(port).not.toBe(502) // Should not use default Modbus port
      return Promise.resolve()
    })
  })

  it('supports multiple concurrent emulators', async () => {
    const promise1 = withTcpEmulator(
      { slaveId: 1, holding: { 0: 0x1111 } },
      async ({ host, port }) => {
        const { createTCPTransport } = await import('@ya-modbus/transport')
        const transport = await createTCPTransport({ host, port, slaveId: 1 })
        try {
          const buffer = await transport.readHoldingRegisters(0, 1)
          return buffer.readUInt16BE(0)
        } finally {
          await transport.close()
        }
      }
    )

    const promise2 = withTcpEmulator(
      { slaveId: 1, holding: { 0: 0x2222 } },
      async ({ host, port }) => {
        const { createTCPTransport } = await import('@ya-modbus/transport')
        const transport = await createTCPTransport({ host, port, slaveId: 1 })
        try {
          const buffer = await transport.readHoldingRegisters(0, 1)
          return buffer.readUInt16BE(0)
        } finally {
          await transport.close()
        }
      }
    )

    const [value1, value2] = await Promise.all([promise1, promise2])
    expect(value1).toBe(0x1111)
    expect(value2).toBe(0x2222)
  })

  it('cleans up resources after callback completes', async () => {
    let capturedPort = 0

    await withTcpEmulator({ slaveId: 1 }, ({ port }) => {
      capturedPort = port
      return Promise.resolve()
    })

    // Try to connect to the captured port - should fail
    const { createTCPTransport } = await import('@ya-modbus/transport')
    await expect(
      createTCPTransport({
        host: '127.0.0.1',
        port: capturedPort,
        slaveId: 1,
        timeout: 100,
      })
    ).rejects.toThrow()
  })
})
