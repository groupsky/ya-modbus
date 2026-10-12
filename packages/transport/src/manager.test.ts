import { EventEmitter } from 'node:events'

import type ModbusRTU from 'modbus-serial'

import type { RTUConfig, TCPConfig } from './factory.js'
import { TransportManager } from './manager.js'

jest.mock('modbus-serial')

describe('TransportManager', () => {
  let manager: TransportManager
  let mockClient1: jest.Mocked<ModbusRTU>
  let mockClient2: jest.Mocked<ModbusRTU>

  // modbus-serial clients are event emitters ('error' and 'close' when the port fails)
  const createMockClient = (): jest.Mocked<ModbusRTU> => {
    return Object.assign(new EventEmitter(), {
      isOpen: true,
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
    }) as unknown as jest.Mocked<ModbusRTU>
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
      })

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
      })

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
      })

      mockClient2.readHoldingRegisters.mockResolvedValue({
        data: [0x2222],
        buffer: Buffer.from([0x22, 0x22]),
      })

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
      })

      await transport1.readHoldingRegisters(0, 1)
      await transport2.readHoldingRegisters(0, 1)

      expect(mockClient1.readHoldingRegisters).toHaveBeenCalledTimes(2)
      expect(mockClient1.setID).toHaveBeenNthCalledWith(1, 1)
      expect(mockClient1.setID).toHaveBeenNthCalledWith(2, 2)
    })
  })

  describe('Client Configuration', () => {
    const rtuConfig: RTUConfig = {
      port: '/dev/ttyUSB0',
      baudRate: 9600,
      dataBits: 8,
      parity: 'even',
      stopBits: 1,
      slaveId: 1,
    }
    const tcpConfig: TCPConfig = { host: '192.168.1.100', slaveId: 1 }

    test.each([
      { type: 'RTU', config: rtuConfig, timeout: undefined, expected: 1000 },
      { type: 'RTU', config: rtuConfig, timeout: 2500, expected: 2500 },
      { type: 'TCP', config: tcpConfig, timeout: undefined, expected: 1000 },
      { type: 'TCP', config: tcpConfig, timeout: 2500, expected: 2500 },
    ])(
      'should set $type client timeout to $expected when config timeout is $timeout',
      async ({ config, timeout, expected }) => {
        await manager.getTransport({ ...config, timeout })

        expect(mockClient1.setTimeout).toHaveBeenCalledWith(expected)
      }
    )
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
        }
      })

      mockClient1.readInputRegisters.mockImplementation(async () => {
        executionOrder.push('op2-start')
        await new Promise((resolve) => setTimeout(resolve, 10))
        executionOrder.push('op2-end')
        return {
          data: [0x5678],
          buffer: Buffer.from([0x56, 0x78]),
        }
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
        }
      })

      mockClient2.readHoldingRegisters.mockImplementation(async () => {
        executionOrder.push('tcp2-start')
        await new Promise((resolve) => setTimeout(resolve, 10))
        executionOrder.push('tcp2-end')
        return {
          data: [0x2222],
          buffer: Buffer.from([0x22, 0x22]),
        }
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
        }
      })

      mockClient1.readInputRegisters.mockImplementation(async () => {
        executionOrder.push('op2-start')
        await new Promise((resolve) => setTimeout(resolve, 10))
        executionOrder.push('op2-end')
        return {
          data: [0x5678],
          buffer: Buffer.from([0x56, 0x78]),
        }
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
        }
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

  describe('Lost Connections', () => {
    // What modbus-serial emits when a write fails because the USB adapter is gone
    const serialPortError = {
      name: 'SerialPortError',
      message: 'EIO: i/o error, write',
      errno: 'ECONNREFUSED',
    }
    const rtuConfig: RTUConfig = {
      port: '/dev/ttyUSB0',
      baudRate: 9600,
      dataBits: 8,
      parity: 'even',
      stopBits: 1,
      slaveId: 1,
      maxRetries: 1,
    }
    const reading = { data: [1], buffer: Buffer.from([0x00, 0x01]) }

    let now: number
    let ModbusRTUMock: jest.Mock

    beforeEach(() => {
      now = 1_000_000
      jest.spyOn(performance, 'now').mockImplementation(() => now)
      mockClient1.readHoldingRegisters.mockResolvedValue(reading)
      mockClient2.readHoldingRegisters.mockResolvedValue(reading)
      ModbusRTUMock = jest.requireMock('modbus-serial')
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    test('rejects requests with a clear error and does not reopen the port before the backoff', async () => {
      const transport = await manager.getTransport(rtuConfig)

      mockClient1.emit('error', serialPortError)
      now += 999

      await expect(transport.readHoldingRegisters(0, 1)).rejects.toMatchObject({
        name: 'ConnectionLostError',
        message: 'Connection to /dev/ttyUSB0 lost: EIO: i/o error, write',
      })
      expect(ModbusRTUMock).toHaveBeenCalledTimes(1)
      expect(mockClient1.readHoldingRegisters).not.toHaveBeenCalled()
    })

    test('rejects a request in flight at once and releases the bus', async () => {
      mockClient1.readHoldingRegisters.mockReturnValue(new Promise(() => {}))
      const transport1 = await manager.getTransport(rtuConfig)
      const transport2 = await manager.getTransport({ ...rtuConfig, slaveId: 2 })

      const inFlight = transport1.readHoldingRegisters(0, 1)
      const queued = transport2.readHoldingRegisters(0, 1)
      await new Promise((resolve) => setImmediate(resolve))
      expect(mockClient1.readHoldingRegisters).toHaveBeenCalledTimes(1)
      mockClient1.emit('close')

      await expect(inFlight).rejects.toMatchObject({
        name: 'ConnectionLostError',
        message: 'Connection to /dev/ttyUSB0 lost: port closed',
      })
      await expect(queued).rejects.toMatchObject({ name: 'ConnectionLostError' })
    })

    test('reopens the port on the next request after the backoff', async () => {
      const transport = await manager.getTransport(rtuConfig)

      mockClient1.emit('close')
      now += 1000

      await expect(transport.readHoldingRegisters(0, 1)).resolves.toEqual(reading.buffer)
      expect(mockClient2.connectRTUBuffered).toHaveBeenCalledWith('/dev/ttyUSB0', {
        baudRate: 9600,
        dataBits: 8,
        parity: 'even',
        stopBits: 1,
      })
      expect(mockClient2.setTimeout).toHaveBeenCalledWith(1000)
      expect(mockClient2.setID).toHaveBeenCalledWith(1)
    })

    test('shares the reopened port with the other devices on the bus', async () => {
      const transport1 = await manager.getTransport(rtuConfig)
      const transport2 = await manager.getTransport({ ...rtuConfig, slaveId: 2 })

      mockClient1.emit('close')
      now += 1000
      await transport1.readHoldingRegisters(0, 1)
      await transport2.readHoldingRegisters(0, 1)

      expect(ModbusRTUMock).toHaveBeenCalledTimes(2)
      expect(mockClient2.setID).toHaveBeenLastCalledWith(2)
      expect(manager.getStats().totalTransports).toBe(1)
    })

    test('waits twice as long after each failed reopen, up to one minute', async () => {
      const transport = await manager.getTransport(rtuConfig)
      ModbusRTUMock.mockImplementation(() => {
        const client = createMockClient()
        client.connectRTUBuffered.mockRejectedValue(
          new Error('Error: No such file or directory, cannot open /dev/ttyUSB0')
        )
        return client
      })
      mockClient1.emit('close')

      let attempts = 0
      for (const delay of [1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000]) {
        now += delay - 1
        await expect(transport.readHoldingRegisters(0, 1)).rejects.toThrow()
        expect(ModbusRTUMock).toHaveBeenCalledTimes(1 + attempts)

        now += 1
        await expect(transport.readHoldingRegisters(0, 1)).rejects.toMatchObject({
          name: 'ConnectionLostError',
          message:
            'Connection to /dev/ttyUSB0 lost: Error: No such file or directory, cannot open /dev/ttyUSB0',
        })
        attempts++
        expect(ModbusRTUMock).toHaveBeenCalledTimes(1 + attempts)
      }
    })

    test('starts again with a short backoff after a request succeeds on the reopened port', async () => {
      const transport = await manager.getTransport(rtuConfig)
      const failingClient = createMockClient()
      failingClient.connectRTUBuffered.mockRejectedValue(new Error('cannot open'))
      const mockClient3 = createMockClient()
      mockClient3.readHoldingRegisters.mockResolvedValue(reading)
      ModbusRTUMock.mockReset()
      ModbusRTUMock.mockReturnValueOnce(failingClient)
        .mockReturnValueOnce(mockClient2)
        .mockReturnValueOnce(mockClient3)

      mockClient1.emit('close')
      now += 1000
      await expect(transport.readHoldingRegisters(0, 1)).rejects.toThrow('cannot open')
      now += 2000
      await transport.readHoldingRegisters(0, 1)
      mockClient2.emit('close')
      now += 1000

      await expect(transport.readHoldingRegisters(0, 1)).resolves.toEqual(reading.buffer)
      expect(mockClient3.readHoldingRegisters).toHaveBeenCalled()
    })

    // An adapter that opens but fails at once must not be reopened every second
    test('waits twice as long when the reopened port is lost before a request succeeds', async () => {
      const transport = await manager.getTransport(rtuConfig)
      const mockClient3 = createMockClient()
      mockClient3.readHoldingRegisters.mockResolvedValue(reading)
      ModbusRTUMock.mockReset()
      ModbusRTUMock.mockReturnValueOnce(mockClient2).mockReturnValueOnce(mockClient3)
      mockClient2.readHoldingRegisters.mockImplementation(() => {
        mockClient2.emit('close')
        return new Promise(() => {})
      })

      mockClient1.emit('close')
      now += 1000
      await expect(transport.readHoldingRegisters(0, 1)).rejects.toMatchObject({
        name: 'ConnectionLostError',
      })
      now += 1999
      await expect(transport.readHoldingRegisters(0, 1)).rejects.toMatchObject({
        name: 'ConnectionLostError',
      })
      expect(ModbusRTUMock).toHaveBeenCalledTimes(1)

      now += 1
      await expect(transport.readHoldingRegisters(0, 1)).resolves.toEqual(reading.buffer)
      expect(ModbusRTUMock).toHaveBeenCalledTimes(2)
    })

    test('ignores events from the lost client after the port is reopened', async () => {
      const transport = await manager.getTransport(rtuConfig)
      mockClient1.emit('close')
      now += 1000
      await transport.readHoldingRegisters(0, 1)

      mockClient1.emit('error', serialPortError)

      await expect(transport.readHoldingRegisters(0, 1)).resolves.toEqual(reading.buffer)
      expect(ModbusRTUMock).toHaveBeenCalledTimes(2)
    })

    // A TCP socket error only clears isOpen in modbus-serial, without an event
    test('reopens the connection when a request finds it closed without an event', async () => {
      const transport = await manager.getTransport({
        host: '192.168.1.100',
        slaveId: 1,
        maxRetries: 1,
      })
      const portNotOpen = {
        name: 'PortNotOpenError',
        message: 'Port Not Open',
        errno: 'ECONNREFUSED',
      }
      Object.assign(mockClient1, { isOpen: false })
      mockClient1.readHoldingRegisters.mockRejectedValue(portNotOpen)

      await expect(transport.readHoldingRegisters(0, 1)).rejects.toMatchObject(portNotOpen)
      await expect(transport.readHoldingRegisters(0, 1)).rejects.toMatchObject({
        name: 'ConnectionLostError',
        message: 'Connection to 192.168.1.100:502 lost: Port Not Open',
      })
      now += 1000

      await expect(transport.readHoldingRegisters(0, 1)).resolves.toEqual(reading.buffer)
      expect(mockClient2.connectTCP).toHaveBeenCalledWith('192.168.1.100', { port: 502 })
    })

    test('keeps the code of the error when a TCP connection cannot be reopened', async () => {
      const transport = await manager.getTransport({
        host: '192.168.1.100',
        slaveId: 1,
        maxRetries: 1,
      })
      mockClient2.connectTCP.mockRejectedValue(
        Object.assign(new Error('connect ECONNREFUSED 192.168.1.100:502'), {
          code: 'ECONNREFUSED',
          errno: -111,
        })
      )
      mockClient1.emit('close')
      now += 1000

      await expect(transport.readHoldingRegisters(0, 1)).rejects.toMatchObject({
        name: 'ConnectionLostError',
        message: 'Connection to 192.168.1.100:502 lost: connect ECONNREFUSED 192.168.1.100:502',
        code: 'ECONNREFUSED',
        errno: -111,
      })
    })

    // modbus-serial never calls back when it closes a TCP client whose socket is closed
    test.each([
      { situation: "emitted 'close'", lose: (client: EventEmitter) => client.emit('close') },
      {
        situation: 'closed without an event',
        lose: (client: EventEmitter) => Object.assign(client, { isOpen: false }),
      },
    ])('closeAll does not wait for a TCP client that $situation', async ({ lose }) => {
      await manager.getTransport({ host: '192.168.1.100', slaveId: 1 })
      mockClient1.close.mockImplementation(() => undefined)
      lose(mockClient1)

      await expect(manager.closeAll()).resolves.toBeUndefined()
    })

    test('stops reopening the port after closeAll', async () => {
      const transport = await manager.getTransport(rtuConfig)
      mockClient1.emit('close')

      await manager.closeAll()
      now += 1000

      await expect(transport.readHoldingRegisters(0, 1)).rejects.toMatchObject({
        name: 'ConnectionLostError',
      })
      expect(ModbusRTUMock).toHaveBeenCalledTimes(1)
    })

    test('closes a client that finishes opening after closeAll', async () => {
      const transport = await manager.getTransport(rtuConfig)
      let finishOpening: () => void = () => undefined
      mockClient2.connectRTUBuffered.mockReturnValue(
        new Promise<void>((resolve) => {
          finishOpening = resolve
        })
      )
      mockClient1.emit('close')
      now += 1000

      const request = transport.readHoldingRegisters(0, 1)
      await new Promise((resolve) => setImmediate(resolve))
      expect(mockClient2.connectRTUBuffered).toHaveBeenCalled()
      await manager.closeAll()
      finishOpening()

      await expect(request).rejects.toMatchObject({ name: 'ConnectionLostError' })
      expect(mockClient2.close).toHaveBeenCalled()
      expect(mockClient2.readHoldingRegisters).not.toHaveBeenCalled()
    })
  })
})
