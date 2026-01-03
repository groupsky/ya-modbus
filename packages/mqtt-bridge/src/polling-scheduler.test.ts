import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
import type { DeviceDriver } from '@ya-modbus/driver-types'

import { PollingScheduler } from './polling-scheduler.js'
import type { DeviceConfig } from './types.js'

describe('PollingScheduler', () => {
  let scheduler: PollingScheduler
  let onDataCallback: jest.Mock
  let onErrorCallback: jest.Mock
  let failureCount: number

  beforeEach(() => {
    failureCount = 0
    onDataCallback = jest.fn()
    onErrorCallback = jest.fn().mockImplementation(() => {
      failureCount++
      return failureCount
    })
    scheduler = new PollingScheduler(onDataCallback, onErrorCallback)
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('scheduleDevice', () => {
    it('should schedule polling for a device', () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000 },
      }

      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn().mockResolvedValue({ temp: 25.5 }),
      }

      scheduler.scheduleDevice('device1', config, driver)

      expect(scheduler.isScheduled('device1')).toBe(true)
    })

    it('should use default interval if not specified', () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
      }

      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      scheduler.scheduleDevice('device1', config, driver)

      expect(scheduler.isScheduled('device1')).toBe(true)
    })

    it('should start polling immediately if scheduler is already running', async () => {
      scheduler.start()

      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000 },
      }

      const mockReadDataPoints = jest.fn().mockResolvedValue({ temp: 25.5 })
      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)

      // Device should start polling
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)
    })

    it('should poll device at specified interval', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000 },
      }

      const mockReadDataPoints = jest.fn().mockResolvedValue({ temp: 25.5 })
      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      // First poll
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)
      expect(onDataCallback).toHaveBeenCalledWith('device1', { temp: 25.5 })

      // Second poll
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2)
    })

    it('should handle polling errors without stopping scheduler', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000 },
      }

      const mockReadDataPoints = jest
        .fn()
        .mockRejectedValueOnce(new Error('Read timeout'))
        .mockResolvedValueOnce({ temp: 25.5 })

      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      // First poll - error
      await jest.advanceTimersByTimeAsync(1000)
      expect(onErrorCallback).toHaveBeenCalledWith('device1', expect.any(Error))

      // Second poll - success
      await jest.advanceTimersByTimeAsync(1000)
      expect(onDataCallback).toHaveBeenCalledWith('device1', { temp: 25.5 })
    })

    it('should implement backoff for consecutive failures', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000, maxRetries: 3, retryBackoff: 2000 },
      }

      const mockReadDataPoints = jest.fn().mockRejectedValue(new Error('Read timeout'))

      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      // First failure - normal interval
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)

      // Second failure - normal interval
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2)

      // Third failure - normal interval
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(3)

      // Fourth attempt - should use backoff (2000ms)
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(3) // No new attempt yet

      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(4) // Now it should poll
    })

    it('should handle non-Error exceptions', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000 },
      }

      const mockReadDataPoints = jest.fn().mockRejectedValue('String error')

      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      await jest.advanceTimersByTimeAsync(1000)
      expect(onErrorCallback).toHaveBeenCalledWith('device1', expect.any(Error))
      expect(onErrorCallback.mock.calls[0][1].message).toBe('String error')
    })
  })

  describe('unscheduleDevice', () => {
    it('should stop polling for a device', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000 },
      }

      const mockReadDataPoints = jest.fn().mockResolvedValue({ temp: 25.5 })
      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)

      scheduler.unscheduleDevice('device1')

      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1) // No additional calls
      expect(scheduler.isScheduled('device1')).toBe(false)
    })

    it('should not throw if device is not scheduled', () => {
      expect(() => scheduler.unscheduleDevice('nonexistent')).not.toThrow()
    })
  })

  describe('start/stop', () => {
    it('should start polling all scheduled devices', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000 },
      }

      const mockReadDataPoints = jest.fn().mockResolvedValue({ temp: 25.5 })
      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalled()
    })

    it('should stop polling all devices', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000 },
      }

      const mockReadDataPoints = jest.fn().mockResolvedValue({ temp: 25.5 })
      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)

      scheduler.stop()

      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1) // No additional calls
    })

    it('should allow restart after stop', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000 },
      }

      const mockReadDataPoints = jest.fn().mockResolvedValue({ temp: 25.5 })
      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)

      scheduler.stop()
      scheduler.start()

      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2)
    })
  })

  describe('isScheduled', () => {
    it('should return true if device is scheduled', () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
      }

      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      scheduler.scheduleDevice('device1', config, driver)
      expect(scheduler.isScheduled('device1')).toBe(true)
    })

    it('should return false if device is not scheduled', () => {
      expect(scheduler.isScheduled('nonexistent')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle stop when device has no active timer', () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000 },
      }

      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      // Schedule device but don't start scheduler - no timer will be set
      scheduler.scheduleDevice('device1', config, driver)

      // Stop should not throw even though device has no timer
      expect(() => scheduler.stop()).not.toThrow()
    })

    it('should handle device being unscheduled before timer fires', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000 },
      }

      const mockReadDataPoints = jest.fn().mockResolvedValue({ temp: 25.5 })
      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      // Unschedule device before timer fires
      scheduler.unscheduleDevice('device1')

      // Advance time - timer should not fire because device was unscheduled
      await jest.advanceTimersByTimeAsync(2000)
      expect(mockReadDataPoints).not.toHaveBeenCalled()
    })

    it('should handle scheduler being stopped before timer fires', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000 },
      }

      const mockReadDataPoints = jest.fn().mockResolvedValue({ temp: 25.5 })
      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      // Stop scheduler before first poll
      scheduler.stop()

      // Advance time - timer should not fire because scheduler was stopped
      await jest.advanceTimersByTimeAsync(2000)
      expect(mockReadDataPoints).not.toHaveBeenCalled()
    })

    it('should handle device being removed during polling', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 100 },
      }

      let pollCount = 0
      const mockReadDataPoints = jest.fn().mockImplementation(() => {
        pollCount++
        if (pollCount === 1) {
          // Remove device during first poll
          scheduler.unscheduleDevice('device1')
        }
        return Promise.resolve({ temp: 25.5 })
      })

      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      // First poll should happen
      await jest.advanceTimersByTimeAsync(100)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)

      // Device was removed, so no second poll should happen
      await jest.advanceTimersByTimeAsync(200)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)
    })

    it('should not poll if scheduler stopped after scheduling next poll', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 100 },
      }

      let pollCount = 0
      const mockReadDataPoints = jest.fn().mockImplementation(() => {
        pollCount++
        if (pollCount === 1) {
          // Stop scheduler after first poll completes
          // Next poll is already scheduled but shouldn't execute
          scheduler.stop()
        }
        return Promise.resolve({ temp: 25.5 })
      })

      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      // First poll should happen
      await jest.advanceTimersByTimeAsync(100)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)

      // Scheduler was stopped, so no second poll should happen
      await jest.advanceTimersByTimeAsync(200)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)
    })

    it('should not poll if device removed between scheduling and timer firing', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 100 },
      }

      let pollCount = 0
      const mockReadDataPoints = jest.fn().mockImplementation(() => {
        pollCount++
        // Schedule removal to happen after first poll completes but before next timer fires
        if (pollCount === 1) {
          void Promise.resolve().then(() => {
            scheduler.unscheduleDevice('device1')
          })
        }
        return Promise.resolve({ temp: 25.5 })
      })

      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      // First poll should happen
      await jest.advanceTimersByTimeAsync(100)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)

      // Device was removed, so no second poll should happen
      await jest.advanceTimersByTimeAsync(200)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)
    })
  })
})
