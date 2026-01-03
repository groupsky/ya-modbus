import type { Transport } from '@ya-modbus/driver-types'

import { createTransport } from './factory.js'
import type { RTUConfig, TCPConfig } from './factory.js'
import { TransportManager } from './manager.js'

jest.mock('./factory.js')

describe('TransportManager', () => {
  let manager: TransportManager
  let mockTransport1: jest.Mocked<Transport>
  let mockTransport2: jest.Mocked<Transport>

  beforeEach(() => {
    jest.clearAllMocks()
    manager = new TransportManager()

    mockTransport1 = {
      readHoldingRegisters: jest.fn(),
      readInputRegisters: jest.fn(),
      readCoils: jest.fn(),
      readDiscreteInputs: jest.fn(),
      writeSingleRegister: jest.fn(),
      writeSingleCoil: jest.fn(),
      writeMultipleRegisters: jest.fn(),
      writeMultipleCoils: jest.fn(),
      close: jest.fn(),
    }

    mockTransport2 = {
      readHoldingRegisters: jest.fn(),
      readInputRegisters: jest.fn(),
      readCoils: jest.fn(),
      readDiscreteInputs: jest.fn(),
      writeSingleRegister: jest.fn(),
      writeSingleCoil: jest.fn(),
      writeMultipleRegisters: jest.fn(),
      writeMultipleCoils: jest.fn(),
      close: jest.fn(),
    }
  })

  afterEach(async () => {
    await manager.closeAll()
  })

  describe('Transport Pooling', () => {
    test('should return same transport instance for identical RTU configurations', async () => {
      const config: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      jest.mocked(createTransport).mockResolvedValueOnce(mockTransport1)

      const transport1 = await manager.getTransport(config)
      const transport2 = await manager.getTransport(config)

      expect(createTransport).toHaveBeenCalledTimes(1)
      expect(transport1).toBe(transport2)
    })

    test('should return same transport for different slave IDs on same RTU port', async () => {
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

      jest.mocked(createTransport).mockResolvedValueOnce(mockTransport1)

      const transport1 = await manager.getTransport(config1)
      const transport2 = await manager.getTransport(config2)

      expect(createTransport).toHaveBeenCalledTimes(1)
      expect(transport1).toBe(transport2)
    })

    test('should create separate transports for different RTU ports', async () => {
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

      jest.mocked(createTransport).mockResolvedValueOnce(mockTransport1)
      jest.mocked(createTransport).mockResolvedValueOnce(mockTransport2)

      const transport1 = await manager.getTransport(config1)
      const transport2 = await manager.getTransport(config2)

      expect(createTransport).toHaveBeenCalledTimes(2)
      expect(transport1).not.toBe(transport2)
    })

    test('should create separate transports for different RTU baud rates', async () => {
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

      jest.mocked(createTransport).mockResolvedValueOnce(mockTransport1)
      jest.mocked(createTransport).mockResolvedValueOnce(mockTransport2)

      const transport1 = await manager.getTransport(config1)
      const transport2 = await manager.getTransport(config2)

      expect(createTransport).toHaveBeenCalledTimes(2)
      expect(transport1).not.toBe(transport2)
    })

    test('should pool TCP transports for same host:port', async () => {
      const config: TCPConfig = {
        host: '192.168.1.100',
        port: 502,
        slaveId: 1,
      }

      jest.mocked(createTransport).mockResolvedValueOnce(mockTransport1)

      const transport1 = await manager.getTransport(config)
      const transport2 = await manager.getTransport(config)

      // TCP transports should be pooled - same instance for same host:port
      expect(createTransport).toHaveBeenCalledTimes(1)
      expect(transport1).toBe(transport2)
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

      mockTransport1.readHoldingRegisters.mockImplementation(async () => {
        executionOrder.push('op1-start')
        await new Promise((resolve) => setTimeout(resolve, 50))
        executionOrder.push('op1-end')
        return Buffer.alloc(4)
      })

      mockTransport1.readInputRegisters.mockImplementation(async () => {
        executionOrder.push('op2-start')
        await new Promise((resolve) => setTimeout(resolve, 10))
        executionOrder.push('op2-end')
        return Buffer.alloc(4)
      })

      jest.mocked(createTransport).mockResolvedValue(mockTransport1)

      const transport = await manager.getTransport(config)

      // Start two operations concurrently on the wrapped transport
      // The mutex wrapper should serialize them automatically
      const promise1 = transport.readHoldingRegisters(1, 0, 2)
      const promise2 = transport.readInputRegisters(1, 0, 2)

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

      mockTransport1.readHoldingRegisters.mockImplementation(async () => {
        executionOrder.push('tcp1-start')
        await new Promise((resolve) => setTimeout(resolve, 50))
        executionOrder.push('tcp1-end')
        return Buffer.alloc(4)
      })

      mockTransport2.readHoldingRegisters.mockImplementation(async () => {
        executionOrder.push('tcp2-start')
        await new Promise((resolve) => setTimeout(resolve, 10))
        executionOrder.push('tcp2-end')
        return Buffer.alloc(4)
      })

      jest
        .mocked(createTransport)
        .mockResolvedValueOnce(mockTransport1)
        .mockResolvedValueOnce(mockTransport2)

      const transport1 = await manager.getTransport(config1)
      const transport2 = await manager.getTransport(config2)

      // Start two TCP operations concurrently on different connections
      // Different connections have separate mutexes, so they execute concurrently
      const promise1 = transport1.readHoldingRegisters(0, 2)
      const promise2 = transport2.readHoldingRegisters(0, 2)

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

      mockTransport1.readHoldingRegisters.mockImplementation(async () => {
        executionOrder.push('op1-start')
        await new Promise((resolve) => setTimeout(resolve, 50))
        executionOrder.push('op1-end')
        return Buffer.alloc(4)
      })

      mockTransport1.readInputRegisters.mockImplementation(async () => {
        executionOrder.push('op2-start')
        await new Promise((resolve) => setTimeout(resolve, 10))
        executionOrder.push('op2-end')
        return Buffer.alloc(4)
      })

      jest.mocked(createTransport).mockResolvedValue(mockTransport1)

      const transport = await manager.getTransport(config)

      // Start two operations concurrently on the same TCP transport
      // The mutex wrapper should serialize them automatically
      const promise1 = transport.readHoldingRegisters(0, 2)
      const promise2 = transport.readInputRegisters(0, 2)

      await Promise.all([promise1, promise2])

      // Operations should be serialized (not interleaved)
      expect(executionOrder).toEqual(['op1-start', 'op1-end', 'op2-start', 'op2-end'])
    })

    test('should propagate errors from mutex-wrapped operations', async () => {
      const config: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      const testError = new Error('Modbus error')
      mockTransport1.readHoldingRegisters.mockRejectedValue(testError)

      jest.mocked(createTransport).mockResolvedValue(mockTransport1)

      const transport = await manager.getTransport(config)

      await expect(transport.readHoldingRegisters(1, 0, 2)).rejects.toThrow('Modbus error')
    })
  })

  describe('Reference Counting', () => {
    test('should track transport references', async () => {
      const config: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      jest.mocked(createTransport).mockResolvedValue(mockTransport1)

      await manager.getTransport(config)
      await manager.getTransport(config)
      await manager.getTransport(config)

      const stats = manager.getStats()
      expect(stats.totalTransports).toBe(1)
      expect(stats.rtuTransports).toBe(1)
      expect(stats.tcpTransports).toBe(0)
    })

    test('should provide stats for multiple transport types', async () => {
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

      jest.mocked(createTransport).mockResolvedValue(mockTransport1)

      await manager.getTransport(rtuConfig)
      await manager.getTransport(tcpConfig)

      const stats = manager.getStats()
      expect(stats.totalTransports).toBe(2)
      expect(stats.rtuTransports).toBe(1)
      expect(stats.tcpTransports).toBe(1)
    })
  })

  describe('Lifecycle Management', () => {
    test('should close all transports on closeAll', async () => {
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

      jest
        .mocked(createTransport)
        .mockResolvedValueOnce(mockTransport1)
        .mockResolvedValueOnce(mockTransport2)

      await manager.getTransport(config1)
      await manager.getTransport(config2)

      await manager.closeAll()

      expect(mockTransport1.close).toHaveBeenCalledTimes(1)
      expect(mockTransport2.close).toHaveBeenCalledTimes(1)
    })

    test('should clear all transports after closeAll', async () => {
      const config: RTUConfig = {
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
        slaveId: 1,
      }

      jest.mocked(createTransport).mockResolvedValue(mockTransport1)

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

      mockTransport1.close.mockRejectedValue(new Error('Close failed'))

      jest.mocked(createTransport).mockResolvedValue(mockTransport1)

      await manager.getTransport(config)

      // Should not throw even if close fails
      await expect(manager.closeAll()).resolves.toBeUndefined()
    })
  })
})
