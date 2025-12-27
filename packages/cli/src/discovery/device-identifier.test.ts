import type ModbusRTU from 'modbus-serial'

import { identifyDevice } from './device-identifier.js'

// Mock modbus-serial
jest.mock('modbus-serial')

describe('identifyDevice', () => {
  let mockClient: jest.Mocked<Partial<ModbusRTU>>

  beforeEach(() => {
    jest.clearAllMocks()

    mockClient = {
      readHoldingRegisters: jest.fn(),
      readDeviceIdentification: jest.fn(),
      setTimeout: jest.fn(),
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
      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)
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

    test('falls back to FC03 when FC43 not available', async () => {
      mockClient.readDeviceIdentification = undefined // Not implemented
      mockClient.readHoldingRegisters = jest.fn().mockResolvedValue({
        data: [123, 456],
        buffer: Buffer.from([0, 123, 1, 200]),
      })

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      expect(result.present).toBe(true)
      expect(result.supportsFC43).toBeUndefined()
      expect(result.vendorName).toBeUndefined()
      expect(result.responseTimeMs).toBeGreaterThan(0)

      expect(mockClient.readHoldingRegisters).toHaveBeenCalledWith(0, 1)
    })

    test('identifies device even if FC03 returns exception code', async () => {
      mockClient.readDeviceIdentification = undefined
      mockClient.readHoldingRegisters = jest.fn().mockRejectedValue({
        message: 'Modbus exception 2: Illegal Data Address',
        modbusCode: 2,
      })

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      // Exception code means device is present and responding
      expect(result.present).toBe(true)
      expect(result.exceptionCode).toBe(2)
      expect(result.responseTimeMs).toBeGreaterThan(0)
    })
  })

  describe('device not present', () => {
    test('returns not present on timeout', async () => {
      mockClient.readDeviceIdentification = undefined
      mockClient.readHoldingRegisters = jest.fn().mockRejectedValue({
        message: 'Timeout exceeded',
        errno: 'ETIMEDOUT',
      })

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      expect(result.present).toBe(false)
      expect(result.timeout).toBe(true)
      expect(result.responseTimeMs).toBeGreaterThan(0)
    })

    test('returns not present on CRC error', async () => {
      mockClient.readDeviceIdentification = undefined
      mockClient.readHoldingRegisters = jest.fn().mockRejectedValue({
        message: 'CRC check failed',
        errno: 'CRC',
      })

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      expect(result.present).toBe(false)
      expect(result.crcError).toBe(true)
      expect(result.responseTimeMs).toBeGreaterThan(0)
    })
  })

  describe('timeout configuration', () => {
    test('sets client timeout before attempting identification', async () => {
      mockClient.readDeviceIdentification = undefined
      mockClient.readHoldingRegisters = jest.fn().mockResolvedValue({
        data: [100],
        buffer: Buffer.from([0, 100]),
      })

      await identifyDevice(mockClient as ModbusRTU, 2500, 1)

      expect(mockClient.setTimeout).toHaveBeenCalledWith(2500)
    })
  })

  describe('function code support detection', () => {
    test('sets supportsFC43=true when FC43 succeeds', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockResolvedValue({
        data: {
          0: 'Test',
        },
      })

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      expect(result.supportsFC43).toBe(true)
    })
  })

  describe('error handling', () => {
    test('handles network errors as device not present', async () => {
      mockClient.readDeviceIdentification = undefined
      mockClient.readHoldingRegisters = jest.fn().mockRejectedValue({
        message: 'ECONNREFUSED: Connection refused',
        code: 'ECONNREFUSED',
      })

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      expect(result.present).toBe(false)
    })

    test('handles generic errors as device not present', async () => {
      mockClient.readDeviceIdentification = undefined
      mockClient.readHoldingRegisters = jest.fn().mockRejectedValue(new Error('Generic error'))

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      expect(result.present).toBe(false)
    })
  })

  describe('response time measurement', () => {
    test('measures accurate response time for fast responses', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return { data: { 0: 'Fast Device' } }
      })

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      // Allow for timing precision variations (±1ms)
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(49)
      expect(result.responseTimeMs).toBeLessThan(150) // Allow some tolerance
    })

    test('measures accurate response time for slow responses', async () => {
      mockClient.readDeviceIdentification = undefined
      mockClient.readHoldingRegisters = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return { data: [1], buffer: Buffer.from([0, 1]) }
      })

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

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

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

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

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

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

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      expect(result.present).toBe(false)
      expect(result.timeout).toBe(true)
    })

    test('detects timeout via code ETIMEDOUT', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue({
        code: 'ETIMEDOUT',
      })

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      expect(result.present).toBe(false)
      expect(result.timeout).toBe(true)
    })

    test('detects CRC error via errno', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue({
        errno: 'CRC',
      })

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      expect(result.present).toBe(false)
      expect(result.crcError).toBe(true)
    })

    test('detects CRC error via message', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue({
        message: 'CRC check failed',
      })

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      expect(result.present).toBe(false)
      expect(result.crcError).toBe(true)
    })
  })

  describe('FC43 exception handling', () => {
    test('handles FC43 exception as present but unsupported', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue({
        modbusCode: 1, // Illegal function
      })
      mockClient.readHoldingRegisters = jest.fn().mockResolvedValue({
        data: [0],
      })

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      expect(result.present).toBe(true)
      expect(result.supportsFC43).toBe(false)
      expect(result.exceptionCode).toBe(1)
    })
  })

  describe('FC04 fallback logic', () => {
    test('tries register 0 when register 1 throws exception', async () => {
      delete (mockClient as { readDeviceIdentification?: unknown }).readDeviceIdentification

      // FC04 register 1 throws exception
      mockClient.readInputRegisters = jest
        .fn()
        .mockRejectedValueOnce({ modbusCode: 2 }) // First call (register 1) - exception
        .mockResolvedValue({ data: [100] }) // Second call (register 0) - success

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      expect(result.present).toBe(true)
      expect(mockClient.readInputRegisters).toHaveBeenCalledTimes(2)
      expect(mockClient.readInputRegisters).toHaveBeenNthCalledWith(1, 1, 1) // Try register 1 first
      expect(mockClient.readInputRegisters).toHaveBeenNthCalledWith(2, 0, 1) // Fall back to register 0
    })

    test('returns present when both registers throw exceptions', async () => {
      delete (mockClient as { readDeviceIdentification?: unknown }).readDeviceIdentification

      mockClient.readInputRegisters = jest
        .fn()
        .mockRejectedValueOnce({ modbusCode: 2 }) // Register 1 exception
        .mockRejectedValue({ modbusCode: 2 }) // Register 0 exception

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      expect(result.present).toBe(true)
      expect(result.exceptionCode).toBe(2)
    })

    test('returns not present when register 0 times out', async () => {
      delete (mockClient as { readDeviceIdentification?: unknown }).readDeviceIdentification

      mockClient.readInputRegisters = jest
        .fn()
        .mockRejectedValueOnce({ modbusCode: 2 }) // Register 1 exception
        .mockRejectedValue({ message: 'timeout' }) // Register 0 timeout

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      expect(result.present).toBe(false)
      expect(result.timeout).toBe(true)
    })
  })

  describe('FC03 final fallback', () => {
    test('returns not present when all function codes fail with timeout', async () => {
      delete (mockClient as { readDeviceIdentification?: unknown }).readDeviceIdentification

      mockClient.readInputRegisters = jest.fn().mockRejectedValue({ message: 'timeout' })
      mockClient.readHoldingRegisters = jest.fn().mockRejectedValue({ message: 'timeout' })

      const result = await identifyDevice(mockClient as ModbusRTU, 1000, 1)

      expect(result.present).toBe(false)
      expect(result.timeout).toBe(true)
    })
  })
})
