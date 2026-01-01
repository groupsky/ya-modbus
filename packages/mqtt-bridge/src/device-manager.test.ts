import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import type { DeviceDriver } from '@ya-modbus/driver-types'

import { DeviceManager } from './device-manager.js'
import { DriverLoader } from './driver-loader.js'
import type { DeviceConfig } from './types.js'

describe('DeviceManager', () => {
  let manager: DeviceManager
  let mockDriverLoader: jest.Mocked<DriverLoader>

  beforeEach(() => {
    mockDriverLoader = {
      loadDriver: jest.fn(),
      unloadDriver: jest.fn(),
      getDriver: jest.fn(),
    } as unknown as jest.Mocked<DriverLoader>

    manager = new DeviceManager(mockDriverLoader)
  })

  describe('addDevice', () => {
    it('should add a new device', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          slaveId: 1,
        },
      }

      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      mockDriverLoader.loadDriver.mockResolvedValue(mockDriver)

      await manager.addDevice(config)

      const device = manager.getDevice('device1')
      expect(device).toBeDefined()
      expect(device?.deviceId).toBe('device1')
      expect(device?.state).toBe('connected')
      expect(device?.enabled).toBe(true)
      expect(device?.connected).toBe(true)
      expect(mockDriverLoader.loadDriver).toHaveBeenCalledWith(
        'ya-modbus-driver-test',
        config.connection,
        'device1'
      )
    })

    it('should add device with enabled=false and not load driver', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          slaveId: 1,
        },
        enabled: false,
      }

      await manager.addDevice(config)

      const device = manager.getDevice('device1')
      expect(device?.enabled).toBe(false)
      expect(device?.state).toBe('disconnected')
      expect(mockDriverLoader.loadDriver).not.toHaveBeenCalled()
    })

    it('should throw error if device already exists', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          slaveId: 1,
        },
      }

      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      mockDriverLoader.loadDriver.mockResolvedValue(mockDriver)

      await manager.addDevice(config)

      await expect(manager.addDevice(config)).rejects.toThrow('Device device1 already exists')
    })

    it('should handle driver loading errors', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          slaveId: 1,
        },
      }

      mockDriverLoader.loadDriver.mockRejectedValue(new Error('Failed to load driver'))

      await expect(manager.addDevice(config)).rejects.toThrow('Failed to load driver')

      const device = manager.getDevice('device1')
      expect(device?.state).toBe('error')
      expect(device?.connected).toBe(false)
      expect(device?.errors).toContain('Failed to load driver')
    })
  })

  describe('removeDevice', () => {
    it('should remove an existing device and unload driver', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'tcp',
          host: 'localhost',
          port: 502,
          slaveId: 1,
        },
      }

      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      mockDriverLoader.loadDriver.mockResolvedValue(mockDriver)

      await manager.addDevice(config)
      await manager.removeDevice('device1')

      const device = manager.getDevice('device1')
      expect(device).toBeUndefined()
      expect(mockDriverLoader.unloadDriver).toHaveBeenCalledWith('device1')
    })

    it('should throw error if device not found', async () => {
      await expect(manager.removeDevice('nonexistent')).rejects.toThrow(
        'Device nonexistent not found'
      )
    })
  })

  describe('getDevice', () => {
    it('should return device status', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          slaveId: 1,
        },
      }

      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      mockDriverLoader.loadDriver.mockResolvedValue(mockDriver)

      await manager.addDevice(config)

      const device = manager.getDevice('device1')
      expect(device).toBeDefined()
      expect(device?.deviceId).toBe('device1')
    })

    it('should return undefined for nonexistent device', () => {
      const device = manager.getDevice('nonexistent')
      expect(device).toBeUndefined()
    })
  })

  describe('listDevices', () => {
    it('should return empty array when no devices', () => {
      const devices = manager.listDevices()
      expect(devices).toEqual([])
    })

    it('should return all devices', async () => {
      const config1: DeviceConfig = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          slaveId: 1,
        },
      }

      const config2: DeviceConfig = {
        deviceId: 'device2',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'tcp',
          host: 'localhost',
          port: 502,
          slaveId: 2,
        },
      }

      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      mockDriverLoader.loadDriver.mockResolvedValue(mockDriver)

      await manager.addDevice(config1)
      await manager.addDevice(config2)

      const devices = manager.listDevices()
      expect(devices).toHaveLength(2)
      expect(devices.map((d) => d.deviceId)).toContain('device1')
      expect(devices.map((d) => d.deviceId)).toContain('device2')
    })
  })

  describe('getDeviceCount', () => {
    it('should return 0 when no devices', () => {
      expect(manager.getDeviceCount()).toBe(0)
    })

    it('should return correct count', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          slaveId: 1,
        },
      }

      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      mockDriverLoader.loadDriver.mockResolvedValue(mockDriver)

      await manager.addDevice(config)
      expect(manager.getDeviceCount()).toBe(1)
    })
  })

  describe('updateDeviceState', () => {
    it('should update device state', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          slaveId: 1,
        },
        enabled: false,
      }

      await manager.addDevice(config)
      manager.updateDeviceState('device1', {
        state: 'connected',
        connected: true,
        lastUpdate: Date.now(),
      })

      const device = manager.getDevice('device1')
      expect(device?.state).toBe('connected')
      expect(device?.connected).toBe(true)
      expect(device?.lastUpdate).toBeDefined()
    })

    it('should throw error if device not found', () => {
      expect(() =>
        manager.updateDeviceState('nonexistent', {
          state: 'connected',
        })
      ).toThrow('Device nonexistent not found')
    })
  })

  describe('clear', () => {
    it('should remove all devices', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          slaveId: 1,
        },
      }

      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      mockDriverLoader.loadDriver.mockResolvedValue(mockDriver)

      await manager.addDevice(config)
      await manager.clear()

      expect(manager.getDeviceCount()).toBe(0)
      expect(manager.listDevices()).toEqual([])
      expect(mockDriverLoader.unloadDriver).toHaveBeenCalledWith('device1')
    })
  })

  describe('getDeviceConfig', () => {
    it('should return device config if it exists', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'ya-modbus-driver-test',
        connection: {
          type: 'rtu',
          port: '/dev/ttyUSB0',
          baudRate: 9600,
          slaveId: 1,
        },
      }

      const mockDriver: DeviceDriver = {
        name: 'test-device',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      mockDriverLoader.loadDriver.mockResolvedValue(mockDriver)

      await manager.addDevice(config)

      const deviceConfig = manager.getDeviceConfig('device1')
      expect(deviceConfig).toEqual(config)
    })

    it('should return undefined if device config does not exist', () => {
      const deviceConfig = manager.getDeviceConfig('nonexistent')
      expect(deviceConfig).toBeUndefined()
    })
  })
})
