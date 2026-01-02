import { describe, it, expect, jest } from '@jest/globals'
import type { DeviceDriver, CreateDriverFunction, Transport } from '@ya-modbus/driver-types'

import { DriverLoader } from './driver-loader.js'
import type { DeviceConnection } from './types.js'

// Mock transport factory for tests
const mockTransportFactory = (_connection: DeviceConnection): Transport => ({
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

describe('DriverLoader', () => {
  describe('constructor', () => {
    it('should create instance without import function', () => {
      const loader = new DriverLoader()
      expect(loader).toBeInstanceOf(DriverLoader)
    })

    it('should create instance with custom import function', () => {
      const mockImport = jest.fn()
      const loader = new DriverLoader(mockImport, mockTransportFactory)
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
      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
      }

      const driver = await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')

      expect(driver).toBe(mockDriver)
      expect(mockCreateDriver).toHaveBeenCalled()
      expect(mockImport).toHaveBeenCalledWith('ya-modbus-driver-test')
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

      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
      }

      const driver1 = await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')
      const driver2 = await loader.loadDriver('ya-modbus-driver-test', connection, 'device2')

      expect(driver1).not.toBe(driver2) // Different instances
      expect(mockCreateDriver).toHaveBeenCalledTimes(2) // Called for each device
      expect(mockImport).toHaveBeenCalledTimes(1) // Package loaded only once
    })

    it('should throw error if driver package not found', async () => {
      const mockImport = jest.fn().mockRejectedValue(new Error('Cannot find module'))
      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'tcp',
        host: 'localhost',
        port: 502,
        slaveId: 1,
      }

      await expect(loader.loadDriver('ya-modbus-driver-nonexistent', connection)).rejects.toThrow(
        'Failed to load driver'
      )
    })

    it('should throw error if driver does not export createDriver', async () => {
      const mockImport = jest.fn().mockResolvedValue({})
      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
      }

      await expect(loader.loadDriver('ya-modbus-driver-invalid', connection)).rejects.toThrow(
        'does not export createDriver function'
      )
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
      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
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
      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

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
      const mockImport = jest.fn().mockRejectedValue('String error')
      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
      }

      await expect(loader.loadDriver('ya-modbus-driver-bad', connection)).rejects.toThrow(
        'Failed to load driver package ya-modbus-driver-bad: String error'
      )
    })

    it('should reject driver package name not starting with ya-modbus-driver-', async () => {
      const loader = new DriverLoader(undefined, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
      }

      await expect(loader.loadDriver('malicious-driver', connection)).rejects.toThrow(
        "Invalid driver package name: must start with 'ya-modbus-driver-'"
      )
    })

    it('should reject driver package name with path traversal', async () => {
      const loader = new DriverLoader(undefined, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
      }

      await expect(loader.loadDriver('../../malicious-code', connection)).rejects.toThrow(
        "Invalid driver package name: must start with 'ya-modbus-driver-'"
      )
    })

    it('should reject driver package name with forward slash', async () => {
      const loader = new DriverLoader(undefined, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
      }

      await expect(loader.loadDriver('ya-modbus-driver-test/../evil', connection)).rejects.toThrow(
        'path traversal not allowed'
      )
    })

    it('should reject driver package name with backslash', async () => {
      const loader = new DriverLoader(undefined, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
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
      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
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

      const mockTransportFactory = jest.fn().mockReturnValue(mockTransport)
      const mockCreateDriver: CreateDriverFunction = jest
        .fn()
        .mockRejectedValue(new Error('Driver creation failed'))
      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
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

      const mockTransportFactory = jest.fn().mockReturnValue(mockTransport)
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
      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
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
      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
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
      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
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

      const mockTransportFactory = jest.fn().mockReturnValue(mockTransport)
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
      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
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

      const mockTransportFactory = jest.fn().mockReturnValue(mockTransport)
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
      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
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

      const mockTransportFactory = jest.fn().mockReturnValue(mockTransport)
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
      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
      }

      await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')

      // Unload should fail due to destroy error, but transport should still be closed
      await expect(loader.unloadDriver('device1')).rejects.toThrow('Destroy failed')
      expect(mockClose).toHaveBeenCalled()
    })
  })

  describe('factory reference counting', () => {
    it('should remove factory when last device using it is unloaded', async () => {
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
      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
      }

      // Load driver for one device
      await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')
      expect(mockImport).toHaveBeenCalledTimes(1)

      // Unload the device
      await loader.unloadDriver('device1')

      // Load the same driver for a new device - should need to import again
      mockImport.mockClear()
      await loader.loadDriver('ya-modbus-driver-test', connection, 'device2')
      expect(mockImport).toHaveBeenCalledTimes(1) // Factory was removed, needs re-import
    })

    it('should keep factory when other devices are still using it', async () => {
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

      const mockDriver3: DeviceDriver = {
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
        .mockResolvedValueOnce(mockDriver3)

      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
      }

      // Load driver for two devices
      await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')
      await loader.loadDriver('ya-modbus-driver-test', connection, 'device2')
      expect(mockImport).toHaveBeenCalledTimes(1) // Factory cached

      // Unload one device
      await loader.unloadDriver('device1')

      // Load the same driver for a third device - should not need to import
      mockImport.mockClear()
      await loader.loadDriver('ya-modbus-driver-test', connection, 'device3')
      expect(mockImport).not.toHaveBeenCalled() // Factory still cached
    })

    it('should handle multiple different factories independently', async () => {
      const mockDriver1: DeviceDriver = {
        name: 'test-device-1',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      const mockDriver2: DeviceDriver = {
        name: 'test-device-2',
        manufacturer: 'Test Manufacturer',
        model: 'TEST-002',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      const mockCreateDriver1: CreateDriverFunction = jest.fn().mockResolvedValue(mockDriver1)
      const mockCreateDriver2: CreateDriverFunction = jest.fn().mockResolvedValue(mockDriver2)

      const mockImport = jest
        .fn()
        .mockResolvedValueOnce({ createDriver: mockCreateDriver1 })
        .mockResolvedValueOnce({ createDriver: mockCreateDriver2 })
        .mockResolvedValueOnce({ createDriver: mockCreateDriver1 })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
      }

      // Load two different drivers
      await loader.loadDriver('ya-modbus-driver-test1', connection, 'device1')
      await loader.loadDriver('ya-modbus-driver-test2', connection, 'device2')
      expect(mockImport).toHaveBeenCalledTimes(2)

      // Unload device1 - should remove factory1 but keep factory2
      await loader.unloadDriver('device1')

      // Load driver1 again - should need to re-import
      await loader.loadDriver('ya-modbus-driver-test1', connection, 'device3')
      expect(mockImport).toHaveBeenCalledTimes(3)
    })
  })

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
      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      const loader = new DriverLoader(mockImport, mockTransportFactory)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
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

  describe('createMockTransport fallback', () => {
    it('should use createMockTransport when no transport factory is provided', async () => {
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
      const mockImport = jest.fn().mockResolvedValue({ createDriver: mockCreateDriver })

      // Create loader without transport factory - will use createMockTransport
      const loader = new DriverLoader(mockImport)

      const connection: DeviceConnection = {
        type: 'rtu',
        port: '/dev/ttyUSB0',
        baudRate: 9600,
        slaveId: 1,
      }

      // Loading should succeed - createMockTransport is called
      const driver = await loader.loadDriver('ya-modbus-driver-test', connection, 'device1')
      expect(driver).toBe(mockDriver)

      // Verify createDriver was called with a transport
      expect(mockCreateDriver).toHaveBeenCalledWith(
        expect.objectContaining({
          slaveId: 1,
          transport: expect.objectContaining({
            readHoldingRegisters: expect.any(Function),
            readInputRegisters: expect.any(Function),
            close: expect.any(Function),
          }),
        })
      )

      // Get the transport that was passed to createDriver
      const call = mockCreateDriver.mock.calls[0]
      const transport = call?.[0]?.transport

      // Try to use the mock transport - should throw error synchronously
      expect(() => transport.readHoldingRegisters(0, 1)).toThrow(
        'Transport factory not provided to DriverLoader'
      )
    })
  })
})
