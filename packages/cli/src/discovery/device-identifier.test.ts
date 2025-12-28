import type ModbusRTU from 'modbus-serial'

import { identifyDevice } from './device-identifier.js'

// Mock modbus-serial
jest.mock('modbus-serial')

describe('identifyDevice', () => {
  let mockClient: jest.Mocked<Partial<ModbusRTU>>

  beforeEach(() => {
    jest.clearAllMocks()

    mockClient = {
      readDeviceIdentification: jest.fn(),
    }
  })

  describe('successful device identification', () => {
    test('identifies device using FC43 when available', async () => {
      const mockDeviceId = {
        data: {
          0: 'Acme Corp', // VendorName
          1: 'AC-100', // ProductCode
          2: 'v1.2.3', // MajorMinorRevision
        },
        conformityLevel: 0x01,
      }

      mockClient.readDeviceIdentification = jest.fn().mockResolvedValue(mockDeviceId)

      const startTime = performance.now()
      const result = await identifyDevice(mockClient as ModbusRTU)
      const endTime = performance.now()

      expect(result.present).toBe(true)
      expect(result.vendorName).toBe('Acme Corp')
      expect(result.productCode).toBe('AC-100')
      expect(result.modelName).toBeUndefined() // modelName (object ID 7) not fetched
      expect(result.revision).toBe('v1.2.3')
      expect(result.supportsFC43).toBe(true)
      expect(result.responseTimeMs).toBeGreaterThan(0)
      expect(result.responseTimeMs).toBeLessThanOrEqual(endTime - startTime + 5)

      expect(mockClient.readDeviceIdentification).toHaveBeenCalledWith(1, 0)
    })

    test('identifies device even if FC43 returns exception code', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue({
        message: 'Modbus exception 1: Illegal Function',
        modbusCode: 1,
      })

      const result = await identifyDevice(mockClient as ModbusRTU)

      // Exception code means device is present but doesn't support FC43
      expect(result.present).toBe(true)
      expect(result.supportsFC43).toBe(false)
      expect(result.exceptionCode).toBe(1)
      expect(result.responseTimeMs).toBeGreaterThan(0)
    })
  })

  describe('device not present', () => {
    test('returns not present on timeout', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue({
        message: 'Timeout exceeded',
        errno: 'ETIMEDOUT',
      })

      const result = await identifyDevice(mockClient as ModbusRTU)

      expect(result.present).toBe(false)
      expect(result.timeout).toBe(true)
      expect(result.responseTimeMs).toBeGreaterThan(0)
    })

    test('returns not present on CRC error', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue({
        message: 'CRC check failed',
        errno: 'CRC',
      })

      const result = await identifyDevice(mockClient as ModbusRTU)

      expect(result.present).toBe(false)
      expect(result.crcError).toBe(true)
      expect(result.responseTimeMs).toBeGreaterThan(0)
    })
  })

  describe('function code support detection', () => {
    test('sets supportsFC43=true when FC43 succeeds', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockResolvedValue({
        data: {
          0: 'Test',
        },
      })

      const result = await identifyDevice(mockClient as ModbusRTU)

      expect(result.supportsFC43).toBe(true)
    })
  })

  describe('error handling', () => {
    test('handles network errors as device not present', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue({
        message: 'ECONNREFUSED: Connection refused',
        code: 'ECONNREFUSED',
      })

      const result = await identifyDevice(mockClient as ModbusRTU)

      expect(result.present).toBe(false)
    })

    test('handles generic errors as device not present', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue(new Error('Generic error'))

      const result = await identifyDevice(mockClient as ModbusRTU)

      expect(result.present).toBe(false)
    })
  })

  describe('response time measurement', () => {
    test('measures accurate response time for fast responses', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return { data: { 0: 'Fast Device' } }
      })

      const result = await identifyDevice(mockClient as ModbusRTU)

      // Allow for timing precision variations (±1ms)
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(49)
      expect(result.responseTimeMs).toBeLessThan(150) // Allow some tolerance
    })

    test('measures accurate response time for slow responses', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return { data: { 0: 'Slow Device' } }
      })

      const result = await identifyDevice(mockClient as ModbusRTU)

      expect(result.responseTimeMs).toBeGreaterThanOrEqual(100)
      expect(result.responseTimeMs).toBeLessThan(200)
    })
  })

  describe('partial device identification data', () => {
    test('handles FC43 with minimal data', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockResolvedValue({
        data: {
          0: 'Only Vendor',
          // Missing other fields (1, 2)
        },
      })

      const result = await identifyDevice(mockClient as ModbusRTU)

      expect(result.present).toBe(true)
      expect(result.vendorName).toBe('Only Vendor')
      expect(result.productCode).toBeUndefined()
      expect(result.modelName).toBeUndefined()
      expect(result.revision).toBeUndefined()
    })

    test('handles empty FC43 response as success', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockResolvedValue({
        data: {},
      })

      const result = await identifyDevice(mockClient as ModbusRTU)

      // Empty response still means device is present and supports FC43
      expect(result.present).toBe(true)
      expect(result.supportsFC43).toBe(true)
    })
  })

  describe('error detection helpers', () => {
    test('detects timeout via errno ETIMEDOUT', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue({
        errno: 'ETIMEDOUT',
      })

      const result = await identifyDevice(mockClient as ModbusRTU)

      expect(result.present).toBe(false)
      expect(result.timeout).toBe(true)
    })

    test('detects timeout via code ETIMEDOUT', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue({
        code: 'ETIMEDOUT',
      })

      const result = await identifyDevice(mockClient as ModbusRTU)

      expect(result.present).toBe(false)
      expect(result.timeout).toBe(true)
    })

    test('detects CRC error via errno', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue({
        errno: 'CRC',
      })

      const result = await identifyDevice(mockClient as ModbusRTU)

      expect(result.present).toBe(false)
      expect(result.crcError).toBe(true)
    })

    test('detects CRC error via message', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue({
        message: 'CRC check failed',
      })

      const result = await identifyDevice(mockClient as ModbusRTU)

      expect(result.present).toBe(false)
      expect(result.crcError).toBe(true)
    })
  })

  describe('FC43 exception handling', () => {
    test('handles FC43 exception as present but unsupported', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue({
        modbusCode: 1, // Illegal function
      })

      const result = await identifyDevice(mockClient as ModbusRTU)

      expect(result.present).toBe(true)
      expect(result.supportsFC43).toBe(false)
      expect(result.exceptionCode).toBe(1)
    })
  })
})
