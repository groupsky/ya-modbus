import { describe, it, expect, beforeEach } from '@jest/globals'

import { DeviceManager } from './device-manager.js'
import type { DeviceConfig } from './types.js'

describe('DeviceManager', () => {
  let manager: DeviceManager

  beforeEach(() => {
    manager = new DeviceManager()
  })

  describe('addDevice', () => {
    it('should add a new device', () => {
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

      manager.addDevice(config)

      const device = manager.getDevice('device1')
      expect(device).toBeDefined()
      expect(device?.deviceId).toBe('device1')
      expect(device?.state).toBe('initializing')
      expect(device?.enabled).toBe(true)
      expect(device?.connected).toBe(false)
    })

    it('should add device with enabled=false', () => {
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

      manager.addDevice(config)

      const device = manager.getDevice('device1')
      expect(device?.enabled).toBe(false)
    })

    it('should throw error if device already exists', () => {
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

      manager.addDevice(config)

      expect(() => manager.addDevice(config)).toThrow('Device device1 already exists')
    })
  })

  describe('removeDevice', () => {
    it('should remove an existing device', () => {
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

      manager.addDevice(config)
      manager.removeDevice('device1')

      const device = manager.getDevice('device1')
      expect(device).toBeUndefined()
    })

    it('should throw error if device not found', () => {
      expect(() => manager.removeDevice('nonexistent')).toThrow('Device nonexistent not found')
    })
  })

  describe('getDevice', () => {
    it('should return device status', () => {
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

      manager.addDevice(config)

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

    it('should return all devices', () => {
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

      manager.addDevice(config1)
      manager.addDevice(config2)

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

    it('should return correct count', () => {
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

      manager.addDevice(config)
      expect(manager.getDeviceCount()).toBe(1)
    })
  })

  describe('updateDeviceState', () => {
    it('should update device state', () => {
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

      manager.addDevice(config)
      manager.updateDeviceState('device1', {
        state: 'running',
        connected: true,
        lastUpdate: Date.now(),
      })

      const device = manager.getDevice('device1')
      expect(device?.state).toBe('running')
      expect(device?.connected).toBe(true)
      expect(device?.lastUpdate).toBeDefined()
    })

    it('should throw error if device not found', () => {
      expect(() =>
        manager.updateDeviceState('nonexistent', {
          state: 'running',
        })
      ).toThrow('Device nonexistent not found')
    })
  })

  describe('clear', () => {
    it('should remove all devices', () => {
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

      manager.addDevice(config)
      manager.clear()

      expect(manager.getDeviceCount()).toBe(0)
      expect(manager.listDevices()).toEqual([])
    })
  })
})
