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

      await expect(loader.loadDriver('nonexistent-driver', connection)).rejects.toThrow(
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

      await expect(loader.loadDriver('invalid-driver', connection)).rejects.toThrow(
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

      await expect(loader.loadDriver('bad-driver', connection)).rejects.toThrow(
        'Failed to load driver package bad-driver: String error'
      )
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
})
