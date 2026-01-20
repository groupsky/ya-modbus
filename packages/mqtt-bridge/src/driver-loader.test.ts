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
  writeSingleRegister: jest.fn().mockResolvedValue(undefined),
  writeMultipleRegisters: jest.fn().mockResolvedValue(undefined),
  writeSingleCoil: jest.fn().mockResolvedValue(undefined),
  writeMultipleCoils: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
})

// Mock transport manager for tests
const createMockTransportManager = (): jest.Mocked<TransportManager> => {
  const mockTransport = createMockTransport()
  return {
    getTransport: jest.fn().mockResolvedValue(mockTransport),
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

    it('should accept scoped driver package names', async () => {
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
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      }

      const driver = await loader.loadDriver('@ya-modbus/driver-test', connection, 'device1')

      expect(driver).toBe(mockDriver)
      expect(mockLoadDriver).toHaveBeenCalledWith({ driverPackage: '@ya-modbus/driver-test' })
    })

    it('should reject scoped driver with path traversal', async () => {
      const loader = new DriverLoader(undefined, createMockTransportManager())

      const connection: DeviceConnection = {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      }

      await expect(loader.loadDriver('@ya-modbus/driver-../evil', connection)).rejects.toThrow(
        'path traversal not allowed'
      )
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

    it('should reject invalid driver package name format', async () => {
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
        'must be @ya-modbus/driver-<name> or ya-modbus-driver-<name>'
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
        'must be @ya-modbus/driver-<name> or ya-modbus-driver-<name>'
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

    it('should propagate errors when driver creation fails', async () => {
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

      // Note: Transport is NOT closed on failure since it may be shared by other devices
      // TransportManager handles cleanup via closeAllTransports()
    })

    it('should propagate errors when driver initialization fails', async () => {
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

      // Note: Transport is NOT closed on failure since it may be shared by other devices
      // TransportManager handles cleanup via closeAllTransports()
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

    it('should remove driver but not close shared transport', async () => {
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

      expect(loader.getDriver('device1')).toBeUndefined()
      // Note: Transport is NOT closed on unload - it's managed by TransportManager
      // and may be shared by other devices
    })

    it('should handle driver without destroy method on unload', async () => {
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
      await expect(loader.unloadDriver('device1')).resolves.not.toThrow()
      expect(loader.getDriver('device1')).toBeUndefined()
    })

    it('should propagate driver destroy errors but still remove driver', async () => {
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

      await expect(loader.unloadDriver('device1')).rejects.toThrow('Destroy failed')
      expect(loader.getDriver('device1')).toBeUndefined()
      // Note: Transport is NOT closed on unload - it's managed by TransportManager
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

  describe('closeAllTransports', () => {
    it('should close all transports via TransportManager', async () => {
      const mockCloseAll = jest.fn().mockResolvedValue(undefined)
      const mockTransportManager = {
        getTransport: jest.fn().mockResolvedValue(createMockTransport()),
        getStats: jest
          .fn()
          .mockReturnValue({ totalTransports: 0, rtuTransports: 0, tcpTransports: 0 }),
        closeAll: mockCloseAll,
      } as unknown as jest.Mocked<TransportManager>

      const loader = new DriverLoader(undefined, mockTransportManager)

      await loader.closeAllTransports()

      expect(mockCloseAll).toHaveBeenCalledTimes(1)
    })
  })
})
