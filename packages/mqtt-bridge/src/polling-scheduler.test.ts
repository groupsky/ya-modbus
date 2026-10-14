import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'
import type { DeviceDriver } from '@ya-modbus/driver-types'

import { PollingScheduler } from './polling-scheduler.js'
import type { DeviceConfig } from './types.js'

describe('PollingScheduler', () => {
  let scheduler: PollingScheduler
  let onDataCallback: jest.Mock
  let onErrorCallback: jest.Mock

  beforeEach(() => {
    onDataCallback = jest.fn()
    onErrorCallback = jest.fn()
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

    it('should first poll after the default interval when polling is not configured', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
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

      await jest.advanceTimersByTimeAsync(4999)
      expect(mockReadDataPoints).not.toHaveBeenCalled()

      await jest.advanceTimersByTimeAsync(1)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)
    })

    // setTimeout turns a delay below 1, NaN or above 2^31-1 (Infinity included) into 1ms, which
    // would poll the device in a tight loop and flood the bus when config validation was bypassed
    it.each([0, -1000, NaN, Infinity, 2 ** 31])('should reject polling interval %p', (interval) => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval },
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

      expect(() => scheduler.scheduleDevice('device1', config, driver)).toThrow(
        `Invalid polling interval for device device1: ${interval}`
      )
      expect(scheduler.isScheduled('device1')).toBe(false)
    })

    // The same applies to the retry backoff: a backoff above 2^31-1 would make a failing device
    // retry after 1ms instead of backing off
    it.each([0, -1000, NaN, Infinity, 2 ** 31])(
      'should reject retry backoff %p',
      (retryBackoff) => {
        const config: DeviceConfig = {
          deviceId: 'device1',
          driver: 'test-driver',
          connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
          polling: { interval: 1000, retryBackoff },
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

        expect(() => scheduler.scheduleDevice('device1', config, driver)).toThrow(
          `Invalid retry backoff for device device1: ${retryBackoff}`
        )
        expect(scheduler.isScheduled('device1')).toBe(false)
      }
    )

    it('should keep the default retry backoff within the timer limit for a long interval', async () => {
      const interval = 2 ** 30 + 1 // twice the interval would be above 2^31-1
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval, maxRetries: 1 },
      }

      const readDataPoints = jest.fn().mockRejectedValue(new Error('Read timeout'))
      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      await jest.advanceTimersByTimeAsync(interval)
      expect(readDataPoints).toHaveBeenCalledTimes(1)

      // The longest delay setTimeout supports. Without the limit the delay would be 1ms.
      await jest.advanceTimersByTimeAsync(1000)
      expect(readDataPoints).toHaveBeenCalledTimes(1)
      await jest.advanceTimersByTimeAsync(2 ** 31 - 1)
      expect(readDataPoints).toHaveBeenCalledTimes(2)
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
      expect(onErrorCallback).toHaveBeenCalledWith('device1', expect.any(Error), 1)

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

    it('should reset to normal interval after recovery from backoff', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000, maxRetries: 3, retryBackoff: 2000 },
      }

      const mockReadDataPoints = jest
        .fn()
        .mockRejectedValueOnce(new Error('Read timeout'))
        .mockRejectedValueOnce(new Error('Read timeout'))
        .mockRejectedValueOnce(new Error('Read timeout'))
        .mockRejectedValueOnce(new Error('Read timeout'))
        .mockResolvedValue({ temp: 25 })

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

      // First three failures - normal interval (1000ms each)
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2)
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(3)

      // Fourth failure - enters backoff (2000ms)
      await jest.advanceTimersByTimeAsync(2000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(4)

      // Fifth attempt succeeds - resets lastFailureCount to 0
      await jest.advanceTimersByTimeAsync(2000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(5)
      expect(onDataCallback).toHaveBeenCalledTimes(1)
      expect(onDataCallback).toHaveBeenCalledWith('device1', { temp: 25 })

      // Next poll should use normal interval (1000ms), not backoff (2000ms)
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(6)

      // Verify it stays on normal interval
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(7)
    })

    // With maxRetries 0 the check `failureCount >= maxRetries` was true even for 0 failures,
    // so every poll waited retryBackoff, including the first poll and polls after successful reads
    it.each([
      { mode: 'interval', pollDelay: 1000 },
      { mode: 'continuous', pollDelay: 1 },
    ] as const)(
      'should keep the normal poll delay after successful reads when maxRetries is 0 ($mode mode)',
      async ({ mode, pollDelay }) => {
        const config: DeviceConfig = {
          deviceId: 'device1',
          driver: 'test-driver',
          connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
          polling: { interval: 1000, mode, maxRetries: 0, retryBackoff: 5000 },
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

        await jest.advanceTimersByTimeAsync(pollDelay)
        expect(mockReadDataPoints).toHaveBeenCalledTimes(1)

        await jest.advanceTimersByTimeAsync(pollDelay)
        expect(mockReadDataPoints).toHaveBeenCalledTimes(2)

        await jest.advanceTimersByTimeAsync(pollDelay)
        expect(mockReadDataPoints).toHaveBeenCalledTimes(3)
      }
    )

    it('should back off after the first failure and recover when maxRetries is 0', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000, maxRetries: 0, retryBackoff: 5000 },
      }

      const mockReadDataPoints = jest
        .fn()
        .mockRejectedValueOnce(new Error('Read timeout'))
        .mockResolvedValue({ temp: 25.5 })

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

      // First poll at the normal interval fails
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)

      // No retries allowed, so the next poll waits for the full backoff
      await jest.advanceTimersByTimeAsync(4999)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)

      await jest.advanceTimersByTimeAsync(1)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2)

      // The read succeeded, so polling returns to the normal interval
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(3)
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
      expect(onErrorCallback).toHaveBeenCalledWith('device1', expect.any(Error), 1)
      expect(onErrorCallback.mock.calls[0][1].message).toBe('String error')
    })
  })

  describe('continuous polling mode', () => {
    it('should poll immediately after response in continuous mode', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000, mode: 'continuous' },
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

      // In continuous mode, polls happen with minimal delay (1ms)
      await jest.advanceTimersByTimeAsync(1)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)

      await jest.advanceTimersByTimeAsync(1)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2)

      await jest.advanceTimersByTimeAsync(1)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(3)

      await jest.advanceTimersByTimeAsync(1)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(4)
    })

    it('should use interval mode by default when mode not specified', async () => {
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

      // Should NOT poll immediately - needs full interval
      await jest.advanceTimersByTimeAsync(1)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)

      // Second poll after interval
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2)
    })

    it('should wait interval before retrying after a failed read in continuous mode', async () => {
      // Bug scenario: a failing device was re-polled every 1ms (before maxRetries was
      // reached), flooding a shared RTU bus. Failed reads must wait `interval` instead.
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000, mode: 'continuous' },
      }

      const mockReadDataPoints = jest
        .fn()
        .mockRejectedValueOnce(new Error('Read timeout'))
        .mockResolvedValue({ temp: 25 })

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

      // First poll after 1ms fails
      await jest.advanceTimersByTimeAsync(1)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)
      expect(onErrorCallback).toHaveBeenCalledTimes(1)

      // Retry must NOT happen before the interval has passed
      await jest.advanceTimersByTimeAsync(999)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)

      // Retry happens after the interval and succeeds
      await jest.advanceTimersByTimeAsync(1)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2)
      expect(onDataCallback).toHaveBeenCalledTimes(1)

      // After a successful read, continuous polling resumes with minimal delay
      await jest.advanceTimersByTimeAsync(1)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(3)
    })

    it('should respect backoff in continuous mode after max retries', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000, mode: 'continuous', maxRetries: 2, retryBackoff: 3000 },
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

      // First poll - continuous mode (1ms), fails
      await jest.advanceTimersByTimeAsync(1)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)

      // Second attempt - after a failure, waits the interval (1000ms), fails
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2)

      // Third attempt - should use backoff (3000ms) after exceeding maxRetries
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2) // No new attempt

      await jest.advanceTimersByTimeAsync(1999)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2) // Backoff not over yet

      await jest.advanceTimersByTimeAsync(1)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(3)
    })

    it('should return to continuous polling after recovery from backoff', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000, mode: 'continuous', maxRetries: 2, retryBackoff: 3000 },
      }

      const mockReadDataPoints = jest
        .fn()
        .mockRejectedValueOnce(new Error('Read timeout'))
        .mockRejectedValueOnce(new Error('Read timeout'))
        .mockRejectedValueOnce(new Error('Read timeout'))
        .mockResolvedValue({ temp: 25 })

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

      // First failure - continuous mode (1ms)
      await jest.advanceTimersByTimeAsync(1)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)

      // Second failure - waits the interval after a failed read (1000ms)
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2)

      // Third failure - backoff (3000ms)
      await jest.advanceTimersByTimeAsync(3000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(3)

      // Fourth attempt succeeds - still in backoff
      await jest.advanceTimersByTimeAsync(3000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(4)
      expect(onDataCallback).toHaveBeenCalledTimes(1)

      // After success, should return to continuous mode (1ms)
      await jest.advanceTimersByTimeAsync(1)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(5)

      await jest.advanceTimersByTimeAsync(1)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(6)
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

    it('should leave no pending timers after stop and schedule them again on restart', () => {
      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: jest.fn(),
      }

      for (const deviceId of ['device1', 'device2']) {
        const config: DeviceConfig = {
          deviceId,
          driver: 'test-driver',
          connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
          polling: { interval: 1000 },
        }
        scheduler.scheduleDevice(deviceId, config, driver)
      }

      scheduler.start()
      expect(jest.getTimerCount()).toBe(2)

      scheduler.stop()
      expect(jest.getTimerCount()).toBe(0)

      scheduler.start()
      expect(jest.getTimerCount()).toBe(2)
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

    it('should handle data callback throwing exception', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 100 },
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

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Make onDataCallback throw
      onDataCallback.mockImplementationOnce(() => {
        throw new Error('Data callback error')
      })

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      // First poll - data callback throws
      await jest.advanceTimersByTimeAsync(100)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in data callback for device device1:',
        expect.objectContaining({ message: 'Data callback error' })
      )

      // Second poll should still happen (polling continues despite callback error)
      onDataCallback.mockRestore()
      await jest.advanceTimersByTimeAsync(100)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2)

      consoleErrorSpy.mockRestore()
    })

    it('should handle error callback throwing exception', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 100 },
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

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Make onErrorCallback throw
      onErrorCallback.mockImplementationOnce(() => {
        throw new Error('Error callback error')
      })

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      // First poll - error callback throws
      await jest.advanceTimersByTimeAsync(100)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in error callback for device device1:',
        expect.objectContaining({ message: 'Error callback error' })
      )

      // Second poll should still happen (polling continues despite callback error)
      onErrorCallback.mockRestore()
      await jest.advanceTimersByTimeAsync(100)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2)

      consoleErrorSpy.mockRestore()
    })

    it('should exit backoff when polling succeeds even if data callback throws', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000, maxRetries: 3, retryBackoff: 3000 },
      }

      const mockReadDataPoints = jest
        .fn()
        .mockRejectedValueOnce(new Error('Read timeout'))
        .mockRejectedValueOnce(new Error('Read timeout'))
        .mockRejectedValueOnce(new Error('Read timeout'))
        .mockRejectedValueOnce(new Error('Read timeout'))
        .mockResolvedValue({ temp: 25.5 }) // Fifth poll succeeds

      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        dataPoints: [{ id: 'temp', name: 'Temperature', type: 'number', unit: '°C' }],
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      // First three failures at normal interval (lastFailureCount: 1, 2, 3)
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2)
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(3)

      // Fourth poll enters backoff (lastFailureCount 3 >= maxRetries 3)
      await jest.advanceTimersByTimeAsync(3000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(4)

      // Fifth poll still in backoff - but succeeds, callback throws
      onDataCallback.mockImplementationOnce(() => {
        throw new Error('Data callback error')
      })

      await jest.advanceTimersByTimeAsync(3000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(5)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in data callback for device device1:',
        expect.objectContaining({ message: 'Data callback error' })
      )

      // CRITICAL TEST: Next poll should use NORMAL interval (1000ms), NOT backoff (3000ms)
      // because the device polling succeeded (even though callback threw)
      onDataCallback.mockRestore()
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(6)

      consoleErrorSpy.mockRestore()
    })

    it('should increment lastFailureCount even when error callback throws', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 1000, maxRetries: 3, retryBackoff: 3000 },
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

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

      // Make error callback throw every time
      onErrorCallback.mockImplementation(() => {
        throw new Error('Error callback error')
      })

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      // First failure (lastFailureCount = 1) - error callback throws
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error in error callback for device device1:',
        expect.objectContaining({ message: 'Error callback error' })
      )

      // Second failure (lastFailureCount = 2) - error callback throws again
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(2)

      // Third failure (lastFailureCount = 3) - error callback throws again
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(3)

      // CRITICAL TEST: Should enter backoff despite callback throwing
      // Fourth poll should wait 3000ms (backoff) because lastFailureCount (3) >= maxRetries (3)
      await jest.advanceTimersByTimeAsync(1000)
      expect(mockReadDataPoints).toHaveBeenCalledTimes(3) // Still 3, waiting for backoff

      await jest.advanceTimersByTimeAsync(2000) // Complete backoff delay
      expect(mockReadDataPoints).toHaveBeenCalledTimes(4) // Now 4

      consoleErrorSpy.mockRestore()
      onErrorCallback.mockRestore()
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

    it('should read the driver data points once when scheduling, not on every poll', async () => {
      const config: DeviceConfig = {
        deviceId: 'device1',
        driver: 'test-driver',
        connection: { type: 'rtu', port: '/dev/ttyUSB0', baudRate: 9600, slaveId: 1 },
        polling: { interval: 100 },
      }

      const getDataPoints = jest.fn(() => [
        { id: 'temp', name: 'Temperature', type: 'number' as const, unit: '°C' },
        { id: 'humidity', name: 'Humidity', type: 'number' as const, unit: '%' },
      ])
      const mockReadDataPoints = jest.fn().mockResolvedValue({ temp: 25.5, humidity: 40 })

      const driver: DeviceDriver = {
        name: 'test',
        manufacturer: 'Test',
        model: 'TEST-001',
        get dataPoints() {
          return getDataPoints()
        },
        readDataPoint: jest.fn(),
        writeDataPoint: jest.fn(),
        readDataPoints: mockReadDataPoints,
      }

      scheduler.scheduleDevice('device1', config, driver)
      scheduler.start()

      await jest.advanceTimersByTimeAsync(300)

      expect(mockReadDataPoints).toHaveBeenCalledTimes(3)
      expect(mockReadDataPoints).toHaveBeenNthCalledWith(1, ['temp', 'humidity'])
      expect(mockReadDataPoints).toHaveBeenNthCalledWith(2, ['temp', 'humidity'])
      expect(mockReadDataPoints).toHaveBeenNthCalledWith(3, ['temp', 'humidity'])
      expect(getDataPoints).toHaveBeenCalledTimes(1)
    })
  })
})
