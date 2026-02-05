import type ModbusRTU from 'modbus-serial'

import type { RTUConfig, TCPConfig } from './factory.js'
import { TransportManager } from './manager.js'

jest.mock('modbus-serial')

describe('TransportManager', () => {
  let manager: TransportManager
  let mockClient1: jest.Mocked<ModbusRTU>
  let mockClient2: jest.Mocked<ModbusRTU>

  const createMockClient = (): jest.Mocked<ModbusRTU> => {
    return {
      connectRTUBuffered: jest.fn().mockResolvedValue(undefined),
      connectTCP: jest.fn().mockResolvedValue(undefined),
      setID: jest.fn(),
      setTimeout: jest.fn(),
      close: jest.fn((callback?: () => void) => {
        if (callback) callback()
      }),
      readHoldingRegisters: jest.fn(),
      readInputRegisters: jest.fn(),
      readCoils: jest.fn(),
      readDiscreteInputs: jest.fn(),
      writeRegister: jest.fn(),
      writeRegisters: jest.fn(),
      writeCoil: jest.fn(),
      writeCoils: jest.fn(),
    } as unknown as jest.Mocked<ModbusRTU>
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockClient1 = createMockClient()
    mockClient2 = createMockClient()

    // Mock the ModbusRTU constructor to return our mock clients
    const ModbusRTUMock = jest.requireMock('modbus-serial')
    ModbusRTUMock.mockImplementation(() => {
      // Return mockClient1 first, then mockClient2 for subsequent calls
      const calls = ModbusRTUMock.mock.calls.length
      return calls === 1 ? mockClient1 : mockClient2
    })

    manager = new TransportManager()
  })

  afterEach(async () => {
    await manager.closeAll()
  })

  describe('Client Pooling', () => {
    test('should create only one client for identical RTU configurations', async () => {
      const config: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      const transport1 = await manager.getTransport(config)
      const transport2 = await manager.getTransport(config)

      // Should create only one client
      const ModbusRTUMock = jest.requireMock('modbus-serial')
      expect(ModbusRTUMock).toHaveBeenCalledTimes(1)

      // Should return different transport instances (new SlaveTransport each time)
      expect(transport1).not.toBe(transport2)

      // Verify both transports work
      mockClient1.readHoldingRegisters.mockResolvedValue({
        data: [0x1234],
        buffer: Buffer.from([0x12, 0x34]),
      } as never)

      await transport1.readHoldingRegisters(0, 1)
      await transport2.readHoldingRegisters(0, 1)

      // Both should use the same client
      expect(mockClient1.readHoldingRegisters).toHaveBeenCalledTimes(2)
      expect(mockClient1.setID).toHaveBeenCalledTimes(2)
      expect(mockClient1.setID).toHaveBeenCalledWith(1)
    })

    test('should return different SlaveTransport instances for different slave IDs sharing same client', async () => {
      const config1: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      const config2: RTUConfig = {
        ...config1,
        slaveId: 2, // Different slave ID, same bus
      }

      const transport1 = await manager.getTransport(config1)
      const transport2 = await manager.getTransport(config2)

      // Should create only one client (shared by both slaves)
      const ModbusRTUMock = jest.requireMock('modbus-serial')
      expect(ModbusRTUMock).toHaveBeenCalledTimes(1)

      // Should return different transport instances
      expect(transport1).not.toBe(transport2)

      // Verify both transports use the same client but different slave IDs
      mockClient1.readHoldingRegisters.mockResolvedValue({
        data: [0x1234],
        buffer: Buffer.from([0x12, 0x34]),
      } as never)

      await transport1.readHoldingRegisters(0, 1)
      await transport2.readHoldingRegisters(0, 1)

      // Both should use the same client
      expect(mockClient1.readHoldingRegisters).toHaveBeenCalledTimes(2)

      // But with different slave IDs
      expect(mockClient1.setID).toHaveBeenCalledTimes(2)
      expect(mockClient1.setID).toHaveBeenNthCalledWith(1, 1)
      expect(mockClient1.setID).toHaveBeenNthCalledWith(2, 2)
    })

    test('should create separate clients for different RTU ports', async () => {
      const config1: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      const config2: RTUConfig = {
        ...config1,
        port: '/dev/ttyUSB1', // Different port
      }

      const transport1 = await manager.getTransport(config1)
      const transport2 = await manager.getTransport(config2)

      // Should create two clients (different ports)
      const ModbusRTUMock = jest.requireMock('modbus-serial')
      expect(ModbusRTUMock).toHaveBeenCalledTimes(2)

      // Should return different transport instances
      expect(transport1).not.toBe(transport2)

      // Verify they use different clients
      mockClient1.readHoldingRegisters.mockResolvedValue({
        data: [0x1111],
        buffer: Buffer.from([0x11, 0x11]),
      } as never)

      mockClient2.readHoldingRegisters.mockResolvedValue({
        data: [0x2222],
        buffer: Buffer.from([0x22, 0x22]),
      } as never)

      const result1 = await transport1.readHoldingRegisters(0, 1)
      const result2 = await transport2.readHoldingRegisters(0, 1)

      expect(mockClient1.readHoldingRegisters).toHaveBeenCalledTimes(1)
      expect(mockClient2.readHoldingRegisters).toHaveBeenCalledTimes(1)
      expect(result1).toEqual(Buffer.from([0x11, 0x11]))
      expect(result2).toEqual(Buffer.from([0x22, 0x22]))
    })

    test('should create separate clients for different RTU baud rates', async () => {
      const config1: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      const config2: RTUConfig = {
        ...config1,
        baudRate: 19200, // Different baud rate
      }

      const transport1 = await manager.getTransport(config1)
      const transport2 = await manager.getTransport(config2)

      // Should create two clients (different baud rates)
      const ModbusRTUMock = jest.requireMock('modbus-serial')
      expect(ModbusRTUMock).toHaveBeenCalledTimes(2)

      // Should return different transport instances
      expect(transport1).not.toBe(transport2)
    })

    test('should pool TCP clients for same host:port with different slave IDs', async () => {
      const config1: TCPConfig = {
        host: '192.168.1.100',
        port: 502,
        slaveId: 1,
      }

      const config2: TCPConfig = {
        ...config1,
        slaveId: 2, // Different slave ID
      }

      const transport1 = await manager.getTransport(config1)
      const transport2 = await manager.getTransport(config2)

      // Should create only one client (same host:port)
      const ModbusRTUMock = jest.requireMock('modbus-serial')
      expect(ModbusRTUMock).toHaveBeenCalledTimes(1)

      // Should return different transport instances
      expect(transport1).not.toBe(transport2)

      // Verify both transports use the same client but different slave IDs
      mockClient1.readHoldingRegisters.mockResolvedValue({
        data: [0x1234],
        buffer: Buffer.from([0x12, 0x34]),
      } as never)

      await transport1.readHoldingRegisters(0, 1)
      await transport2.readHoldingRegisters(0, 1)

      expect(mockClient1.readHoldingRegisters).toHaveBeenCalledTimes(2)
      expect(mockClient1.setID).toHaveBeenNthCalledWith(1, 1)
      expect(mockClient1.setID).toHaveBeenNthCalledWith(2, 2)
    })
  })

  describe('Mutex Serialization', () => {
    test('should serialize RTU operations using mutex', async () => {
      const config: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      const executionOrder: string[] = []

      mockClient1.readHoldingRegisters.mockImplementation(async () => {
        executionOrder.push('op1-start')
        await new Promise((resolve) => setTimeout(resolve, 50))
        executionOrder.push('op1-end')
        return {
          data: [0x1234],
          buffer: Buffer.from([0x12, 0x34]),
        } as never
      })

      mockClient1.readInputRegisters.mockImplementation(async () => {
        executionOrder.push('op2-start')
        await new Promise((resolve) => setTimeout(resolve, 10))
        executionOrder.push('op2-end')
        return {
          data: [0x5678],
          buffer: Buffer.from([0x56, 0x78]),
        } as never
      })

      const transport = await manager.getTransport(config)

      // Start two operations concurrently
      // The mutex should serialize them automatically
      const promise1 = transport.readHoldingRegisters(0, 1)
      const promise2 = transport.readInputRegisters(0, 1)

      await Promise.all([promise1, promise2])

      // Operations should be serialized (not interleaved)
      expect(executionOrder).toEqual(['op1-start', 'op1-end', 'op2-start', 'op2-end'])
    })

    test('should allow concurrent operations on different TCP connections', async () => {
      const config1: TCPConfig = {
        host: '192.168.1.100',
        port: 502,
        slaveId: 1,
      }

      const config2: TCPConfig = {
        host: '192.168.1.101',
        port: 502,
        slaveId: 1,
      }

      const executionOrder: string[] = []

      mockClient1.readHoldingRegisters.mockImplementation(async () => {
        executionOrder.push('tcp1-start')
        await new Promise((resolve) => setTimeout(resolve, 50))
        executionOrder.push('tcp1-end')
        return {
          data: [0x1111],
          buffer: Buffer.from([0x11, 0x11]),
        } as never
      })

      mockClient2.readHoldingRegisters.mockImplementation(async () => {
        executionOrder.push('tcp2-start')
        await new Promise((resolve) => setTimeout(resolve, 10))
        executionOrder.push('tcp2-end')
        return {
          data: [0x2222],
          buffer: Buffer.from([0x22, 0x22]),
        } as never
      })

      const transport1 = await manager.getTransport(config1)
      const transport2 = await manager.getTransport(config2)

      // Start two TCP operations concurrently on different connections
      // Different connections have separate mutexes, so they execute concurrently
      const promise1 = transport1.readHoldingRegisters(0, 1)
      const promise2 = transport2.readHoldingRegisters(0, 1)

      await Promise.all([promise1, promise2])

      // Operations on different connections should be interleaved (concurrent)
      expect(executionOrder).toEqual(['tcp1-start', 'tcp2-start', 'tcp2-end', 'tcp1-end'])
    })

    test('should serialize TCP operations on same connection', async () => {
      const config: TCPConfig = {
        host: '192.168.1.100',
        port: 502,
        slaveId: 1,
      }

      const executionOrder: string[] = []

      mockClient1.readHoldingRegisters.mockImplementation(async () => {
        executionOrder.push('op1-start')
        await new Promise((resolve) => setTimeout(resolve, 50))
        executionOrder.push('op1-end')
        return {
          data: [0x1234],
          buffer: Buffer.from([0x12, 0x34]),
        } as never
      })

      mockClient1.readInputRegisters.mockImplementation(async () => {
        executionOrder.push('op2-start')
        await new Promise((resolve) => setTimeout(resolve, 10))
        executionOrder.push('op2-end')
        return {
          data: [0x5678],
          buffer: Buffer.from([0x56, 0x78]),
        } as never
      })

      const transport = await manager.getTransport(config)

      // Start two operations concurrently on the same TCP transport
      // The mutex should serialize them automatically
      const promise1 = transport.readHoldingRegisters(0, 1)
      const promise2 = transport.readInputRegisters(0, 1)

      await Promise.all([promise1, promise2])

      // Operations should be serialized (not interleaved)
      expect(executionOrder).toEqual(['op1-start', 'op1-end', 'op2-start', 'op2-end'])
    })

    test('should propagate errors from operations', async () => {
      const config: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      const testError = new Error('Modbus error')
      mockClient1.readHoldingRegisters.mockRejectedValue(testError)

      const transport = await manager.getTransport(config)

      // Should fail after retries (default 3)
      await expect(transport.readHoldingRegisters(0, 1)).rejects.toThrow('Modbus error')
      expect(mockClient1.readHoldingRegisters).toHaveBeenCalledTimes(3)
    })

    test('should serialize operations across different slaves on same bus', async () => {
      const config1: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      const config2: RTUConfig = {
        ...config1,
        slaveId: 2,
      }

      const executionOrder: string[] = []

      mockClient1.readHoldingRegisters.mockImplementation(async () => {
        const slaveId = mockClient1.setID.mock.calls[mockClient1.setID.mock.calls.length - 1][0]
        executionOrder.push(`start-slave${slaveId}`)
        await new Promise((resolve) => setTimeout(resolve, 50))
        executionOrder.push(`end-slave${slaveId}`)
        return {
          data: [0x0000],
          buffer: Buffer.from([0x00, 0x00]),
        } as never
      })

      const transport1 = await manager.getTransport(config1)
      const transport2 = await manager.getTransport(config2)

      // Start operations on different slaves concurrently
      const promise1 = transport1.readHoldingRegisters(0, 1)
      const promise2 = transport2.readHoldingRegisters(0, 1)

      await Promise.all([promise1, promise2])

      // Operations should be serialized even across different slaves
      expect(executionOrder).toEqual(['start-slave1', 'end-slave1', 'start-slave2', 'end-slave2'])
      expect(mockClient1.setID).toHaveBeenCalledTimes(2)
      expect(mockClient1.setID).toHaveBeenNthCalledWith(1, 1)
      expect(mockClient1.setID).toHaveBeenNthCalledWith(2, 2)
    })
  })

  describe('Stats Tracking', () => {
    test('should track client connections', async () => {
      const config: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      // Multiple getTransport calls with same config should create only one client
      await manager.getTransport(config)
      await manager.getTransport(config)
      await manager.getTransport(config)

      const stats = manager.getStats()
      expect(stats.totalTransports).toBe(1) // One client connection
      expect(stats.rtuTransports).toBe(1)
      expect(stats.tcpTransports).toBe(0)
    })

    test('should provide stats for multiple connection types', async () => {
      const rtuConfig: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      const tcpConfig: TCPConfig = {
        host: '192.168.1.100',
        port: 502,
        slaveId: 1,
      }

      await manager.getTransport(rtuConfig)
      await manager.getTransport(tcpConfig)

      const stats = manager.getStats()
      expect(stats.totalTransports).toBe(2) // Two client connections
      expect(stats.rtuTransports).toBe(1)
      expect(stats.tcpTransports).toBe(1)
    })

    test('should count connections not transport instances', async () => {
      const config1: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      const config2: RTUConfig = {
        ...config1,
        slaveId: 2, // Different slave, same bus
      }

      await manager.getTransport(config1)
      await manager.getTransport(config2)

      // Two different slaves on same bus should count as ONE connection
      const stats = manager.getStats()
      expect(stats.totalTransports).toBe(1)
      expect(stats.rtuTransports).toBe(1)
    })
  })

  describe('Lifecycle Management', () => {
    test('should close all clients on closeAll', async () => {
      const config1: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      const config2: RTUConfig = {
        port: '/dev/ttyUSB1',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      await manager.getTransport(config1)
      await manager.getTransport(config2)

      await manager.closeAll()

      // Both clients should be closed
      expect(mockClient1.close).toHaveBeenCalledTimes(1)
      expect(mockClient2.close).toHaveBeenCalledTimes(1)
    })

    test('should clear all connections after closeAll', async () => {
      const config: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      await manager.getTransport(config)
      await manager.closeAll()

      const stats = manager.getStats()
      expect(stats.totalTransports).toBe(0)
    })

    test('should handle errors during closeAll gracefully', async () => {
      const config: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      // Mock client.close to throw an error
      mockClient1.close.mockImplementation(() => {
        throw new Error('Close failed')
      })

      await manager.getTransport(config)

      // Should not throw even if close fails
      await expect(manager.closeAll()).resolves.toBeUndefined()
    })

    test('should close client only once even if shared by multiple slaves', async () => {
      const config1: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      const config2: RTUConfig = {
        ...config1,
        slaveId: 2, // Different slave, same bus
      }

      await manager.getTransport(config1)
      await manager.getTransport(config2)

      await manager.closeAll()

      // Should close the shared client only once
      expect(mockClient1.close).toHaveBeenCalledTimes(1)
    })
  })
})
