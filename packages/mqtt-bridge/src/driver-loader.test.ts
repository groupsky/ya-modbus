import { describe, it, expect, jest } from '@jest/globals'
import type { LoadedDriver } from '@ya-modbus/driver-loader'
import type { DeviceDriver, CreateDriverFunction, Transport } from '@ya-modbus/driver-types'
import { TransportManager } from '@ya-modbus/transport'

import { DriverLoader } from './driver-loader.js'
import type { DeviceConnection } from './types.js'

// Mock transport for tests
const createMockTransport = (): jest.Mocked<Transport> => ({
  readHoldingRegisters: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  readInputRegisters: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  readCoils: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  readDiscreteInputs: jest.fn().mockResolvedValue(Buffer.alloc(0)),
  writeRegister: jest.fn().mockResolvedValue(undefined),
  writeMultipleRegisters: jest.fn().mockResolvedValue(undefined),
  writeCoil: jest.fn().mockResolvedValue(undefined),
  writeMultipleCoils: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
})

// Mock transport manager for tests
const createMockTransportManager = (): jest.Mocked<TransportManager> => {
  const mockTransport = createMockTransport()
  return {
    getTransport: jest.fn().mockResolvedValue(mockTransport),
    executeWithLock: jest.fn().mockImplementation((_transport, fn) => fn()),
    getStats: jest.fn().mockReturnValue({ totalTransports: 0, rtuTransports: 0, tcpTransports: 0 }),
    closeAll: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<TransportManager>
}

describe('DriverLoader', () => {
  describe('constructor', () => {
    it('should create instance without loadDriver function', () => {
      const loader = new DriverLoader()
      expect(loader).toBeInstanceOf(DriverLoader)
    })

    it('should create instance with custom loadDriver function and transport manager', () => {
      const mockLoadDriver = jest.fn()
      const mockTransportManager = createMockTransportManager()
      const loader = new DriverLoader(mockLoadDriver, mockTransportManager)
      expect(loader).toBeInstanceOf(DriverLoader)
    })
  })

  describe('loadDriver', () => {
    it('should load and cache a driver package', async () => {
      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      const mockCreateDriver: CreateDriverFunction = jest.fn().mockResolvedValue(mockDriver)
      const mockLoadedDriver: LoadedDriver = { createDriver: mockCreateDriver }
      const mockLoadDriver = jest.fn().mockResolvedValue(mockLoadedDriver)

      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      const driver = await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')

      expect(driver).toBe(mockDriver)
      expect(mockCreateDriver).toHaveBeenCalled()
      expect(mockLoadDriver).toHaveBeenCalledWith({ driverPackage: 'ya-modbus-driver-test' })
    })

    it('should create different instances for different devices', async () => {
      const mockDriver1: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      const mockDriver2: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      const mockCreateDriver: CreateDriverFunction = jest
        .fn()
        .mockResolvedValueOnce(mockDriver1)
        .mockResolvedValueOnce(mockDriver2)

      const mockLoadedDriver: LoadedDriver = { createDriver: mockCreateDriver }
      const mockLoadDriver = jest.fn().mockResolvedValue(mockLoadedDriver)

      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      const driver1 = await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')
      const driver2 = await loader.loadDriver('ya-modbus-driver-test', connection, 'device2')

      expect(driver1).not.toBe(driver2) // Different instances
      expect(mockCreateDriver).toHaveBeenCalledTimes(2) // Called for each device
      expect(mockLoadDriver).toHaveBeenCalledTimes(2) // Package loaded for each device (caching is in driver-loader package)
    })

    it('should throw error if driver package not found', async () => {
      const mockLoadDriver = jest
        .fn()
        .mockRejectedValue(new Error('Driver package not found: ya-modbus-driver-nonexistent'))
      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'tcp',
        host: 'localhost',
        slaveId: 1,
      }

      await expect(loader.loadDriver('ya-modbus-driver-nonexistent', connection)).rejects.toThrow(
        'Driver package not found'
      )
    })

    it('should throw error if driver does not export createDriver', async () => {
      const mockLoadedDriver = { createDriver: undefined as unknown as CreateDriverFunction }
      const mockLoadDriver = jest.fn().mockResolvedValue(mockLoadedDriver)
      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      await expect(loader.loadDriver('ya-modbus-driver-invalid', connection)).rejects.toThrow()
    })

    it('should call initialize method if driver provides it', async () => {
      const mockInitialize = jest.fn().mockResolvedValue(undefined)
      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
        initialize: mockInitialize,
      }

      const mockCreateDriver: CreateDriverFunction = jest.fn().mockResolvedValue(mockDriver)
      const mockLoadDriver = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')

      expect(mockInitialize).toHaveBeenCalled()
    })

    it('should handle TCP connections', async () => {
      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      const mockCreateDriver: CreateDriverFunction = jest.fn().mockResolvedValue(mockDriver)
      const mockLoadDriver = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'tcp',
        host: '192.168.1.100',
        port: 502,
        slaveId: 1,
      }

      const driver = await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')

      expect(driver).toBe(mockDriver)
      expect(mockCreateDriver).toHaveBeenCalledWith(
        expect.objectContaining({
          slaveId: 1,
          transport: expect.any(Object),
        })
      )
    })

    it('should handle non-Error exceptions during driver loading', async () => {
      const mockLoadDriver = jest.fn().mockRejectedValue('String error')
      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      await expect(loader.loadDriver('ya-modbus-driver-bad', connection)).rejects.toEqual(
        'String error'
      )
    })

    it('should reject driver package name not starting with ya-modbus-driver-', async () => {
      const loader = new DriverLoader(undefined, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      await expect(loader.loadDriver('malicious-driver', connection)).rejects.toThrow(
        "Invalid driver package name: must start with 'ya-modbus-driver-'"
      )
    })

    it('should reject driver package name with path traversal', async () => {
      const loader = new DriverLoader(undefined, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      await expect(loader.loadDriver('../../malicious-code', connection)).rejects.toThrow(
        "Invalid driver package name: must start with 'ya-modbus-driver-'"
      )
    })

    it('should reject driver package name with forward slash', async () => {
      const loader = new DriverLoader(undefined, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      await expect(loader.loadDriver('ya-modbus-driver-test/../evil', connection)).rejects.toThrow(
        'path traversal not allowed'
      )
    })

    it('should reject driver package name with backslash', async () => {
      const loader = new DriverLoader(undefined, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      await expect(
        loader.loadDriver('ya-modbus-driver-test\\..\\evil', connection)
      ).rejects.toThrow('path traversal not allowed')
    })

    it('should not cache driver if deviceId is not provided', async () => {
      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      const mockCreateDriver: CreateDriverFunction = jest.fn().mockResolvedValue(mockDriver)
      const mockLoadDriver = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      const driver = await loader.loadDriver('ya-modbus-driver-test', connection)

      expect(driver).toBe(mockDriver)
      expect(loader.getDriver('device1')).toBeUndefined()
    })

    it('should close transport when driver creation fails', async () => {
      const mockClose = jest.fn().mockResolvedValue(undefined)
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn(),
        readInputRegisters: jest.fn(),
        readCoils: jest.fn(),
        readDiscreteInputs: jest.fn(),
        writeSingleRegister: jest.fn(),
        writeMultipleRegisters: jest.fn(),
        writeSingleCoil: jest.fn(),
        writeMultipleCoils: jest.fn(),
        close: mockClose,
      }

      const _mockTransportManager = jest.fn().mockResolvedValue(mockTransport)
      const mockCreateDriver: CreateDriverFunction = jest
        .fn()
        .mockRejectedValue(new Error('Driver creation failed'))
      const mockLoadDriver = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      await expect(
        loader.loadDriver('ya-modbus-driver-test', connection, 'device1')
      ).rejects.toThrow('Driver creation failed')

      expect(mockClose).toHaveBeenCalled()
    })

    it('should close transport when driver initialization fails', async () => {
      const mockClose = jest.fn().mockResolvedValue(undefined)
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn(),
        readInputRegisters: jest.fn(),
        readCoils: jest.fn(),
        readDiscreteInputs: jest.fn(),
        writeSingleRegister: jest.fn(),
        writeMultipleRegisters: jest.fn(),
        writeSingleCoil: jest.fn(),
        writeMultipleCoils: jest.fn(),
        close: mockClose,
      }

      const _mockTransportManager = jest.fn().mockResolvedValue(mockTransport)
      const mockInitialize = jest.fn().mockRejectedValue(new Error('Initialization failed'))
      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
        initialize: mockInitialize,
      }

      const mockCreateDriver: CreateDriverFunction = jest.fn().mockResolvedValue(mockDriver)
      const mockLoadDriver = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      await expect(
        loader.loadDriver('ya-modbus-driver-test', connection, 'device1')
      ).rejects.toThrow('Initialization failed')

      expect(mockClose).toHaveBeenCalled()
    })
  })

  describe('unloadDriver', () => {
    it('should call destroy on driver if it exists', async () => {
      const mockDestroy = jest.fn().mockResolvedValue(undefined)
      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
        destroy: mockDestroy,
      }

      const mockCreateDriver: CreateDriverFunction = jest.fn().mockResolvedValue(mockDriver)
      const mockLoadDriver = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')
      await loader.unloadDriver('device1')

      expect(mockDestroy).toHaveBeenCalled()
    })

    it('should not throw if driver has no destroy method', async () => {
      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      const mockCreateDriver: CreateDriverFunction = jest.fn().mockResolvedValue(mockDriver)
      const mockLoadDriver = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')

      await expect(loader.unloadDriver('device1')).resolves.not.toThrow()
    })

    it('should not throw if device not found', async () => {
      const loader = new DriverLoader()

      await expect(loader.unloadDriver('nonexistent')).resolves.not.toThrow()
    })

    it('should close transport when unloading driver', async () => {
      const mockClose = jest.fn().mockResolvedValue(undefined)
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn(),
        readInputRegisters: jest.fn(),
        readCoils: jest.fn(),
        readDiscreteInputs: jest.fn(),
        writeSingleRegister: jest.fn(),
        writeMultipleRegisters: jest.fn(),
        writeSingleCoil: jest.fn(),
        writeMultipleCoils: jest.fn(),
        close: mockClose,
      }

      const _mockTransportManager = jest.fn().mockResolvedValue(mockTransport)
      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      const mockCreateDriver: CreateDriverFunction = jest.fn().mockResolvedValue(mockDriver)
      const mockLoadDriver = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')
      await loader.unloadDriver('device1')

      expect(mockClose).toHaveBeenCalled()
    })

    it('should close transport even if driver has no destroy method', async () => {
      const mockClose = jest.fn().mockResolvedValue(undefined)
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn(),
        readInputRegisters: jest.fn(),
        readCoils: jest.fn(),
        readDiscreteInputs: jest.fn(),
        writeSingleRegister: jest.fn(),
        writeMultipleRegisters: jest.fn(),
        writeSingleCoil: jest.fn(),
        writeMultipleCoils: jest.fn(),
        close: mockClose,
      }

      const _mockTransportManager = jest.fn().mockResolvedValue(mockTransport)
      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
        // No destroy method
      }

      const mockCreateDriver: CreateDriverFunction = jest.fn().mockResolvedValue(mockDriver)
      const mockLoadDriver = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')
      await loader.unloadDriver('device1')

      expect(mockClose).toHaveBeenCalled()
    })

    it('should close transport even if driver destroy fails', async () => {
      const mockClose = jest.fn().mockResolvedValue(undefined)
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn(),
        readInputRegisters: jest.fn(),
        readCoils: jest.fn(),
        readDiscreteInputs: jest.fn(),
        writeSingleRegister: jest.fn(),
        writeMultipleRegisters: jest.fn(),
        writeSingleCoil: jest.fn(),
        writeMultipleCoils: jest.fn(),
        close: mockClose,
      }

      const _mockTransportManager = jest.fn().mockResolvedValue(mockTransport)
      const mockDestroy = jest.fn().mockRejectedValue(new Error('Destroy failed'))
      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
        destroy: mockDestroy,
      }

      const mockCreateDriver: CreateDriverFunction = jest.fn().mockResolvedValue(mockDriver)
      const mockLoadDriver = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')

      // Unload should fail due to destroy error, but transport should still be closed
      await expect(loader.unloadDriver('device1')).rejects.toThrow('Destroy failed')
      expect(mockClose).toHaveBeenCalled()
    })
  })

  // Note: Factory reference counting tests were removed as that responsibility
  // has been moved to the @ya-modbus/driver-loader package

  describe('getDriver', () => {
    it('should return driver instance if loaded', async () => {
      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      const mockCreateDriver: CreateDriverFunction = jest.fn().mockResolvedValue(mockDriver)
      const mockLoadDriver = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockLoadDriver, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')

      const driver = loader.getDriver('device1')
      expect(driver).toBe(mockDriver)
    })

    it('should return undefined if driver not loaded', () => {
      const loader = new DriverLoader()
      const driver = loader.getDriver('nonexistent')
      expect(driver).toBeUndefined()
    })
  })

  describe('createDefaultTransport fallback', () => {
    it('should use createDefaultTransport when no transport factory is provided', async () => {
      const mockClose = jest.fn().mockResolvedValue(undefined)
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn(),
        readInputRegisters: jest.fn(),
        readCoils: jest.fn(),
        readDiscreteInputs: jest.fn(),
        writeSingleRegister: jest.fn(),
        writeMultipleRegisters: jest.fn(),
        writeSingleCoil: jest.fn(),
        writeMultipleCoils: jest.fn(),
        close: mockClose,
      }

      // Mock the createTransport function from transport package
      const mockCreateTransport = jest.fn().mockResolvedValue(mockTransport)
      jest.spyOn(transportModule, 'createTransport').mockImplementation(mockCreateTransport)

      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      const mockCreateDriver: CreateDriverFunction = jest.fn().mockResolvedValue(mockDriver)
      const mockLoadDriver = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      // Create loader without transport factory - will use createDefaultTransport
      const loader = new DriverLoader(mockLoadDriver)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
        parity: 'none',
        dataBits: 8,
        stopBits: 1,
      }

      // Loading should succeed - createDefaultTransport is called
      const driver = await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')
      expect(driver).toBe(mockDriver)

      // Verify createTransport was called with correct config
      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          parity: 'none',
          dataBits: 8,
          stopBits: 1,
          slaveId: 1,
        })
      )

      // Verify createDriver was called with a transport
      expect(mockCreateDriver).toHaveBeenCalledWith(
        expect.objectContaining({
          slaveId: 1,
          transport: mockTransport,
        })
      )
    })

    it('should use createDefaultTransport for TCP connections when no transport factory is provided', async () => {
      const mockClose = jest.fn().mockResolvedValue(undefined)
      const mockTransport: Transport = {
        readHoldingRegisters: jest.fn(),
        readInputRegisters: jest.fn(),
        readCoils: jest.fn(),
        readDiscreteInputs: jest.fn(),
        writeSingleRegister: jest.fn(),
        writeMultipleRegisters: jest.fn(),
        writeSingleCoil: jest.fn(),
        writeMultipleCoils: jest.fn(),
        close: mockClose,
      }

      // Mock the createTransport function from transport package
      const mockCreateTransport = jest.fn().mockResolvedValue(mockTransport)
      jest.spyOn(transportModule, 'createTransport').mockImplementation(mockCreateTransport)

      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      const mockCreateDriver: CreateDriverFunction = jest.fn().mockResolvedValue(mockDriver)
      const mockLoadDriver = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      // Create loader without transport factory - will use createDefaultTransport
      const loader = new DriverLoader(mockLoadDriver)

      const connection: DeviceConnection = {
        type: 'tcp',
        host: '192.168.1.100',
        port: 502,
        slaveId: 1,
        timeout: 5000,
      }

      // Loading should succeed - createDefaultTransport is called
      const driver = await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')
      expect(driver).toBe(mockDriver)

      // Verify createTransport was called with correct config for TCP
      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: '192.168.1.100',
          port: 502,
          slaveId: 1,
          timeout: 5000,
        })
      )

      // Verify createDriver was called with a transport
      expect(mockCreateDriver).toHaveBeenCalledWith(
        expect.objectContaining({
          slaveId: 1,
          transport: mockTransport,
        })
      )
    })
  })
})
