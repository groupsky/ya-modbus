import type ModbusRTU from 'modbus-serial'

import { identifyDevice } from './device-identifier.js'

// Mock modbus-serial
jest.mock('modbus-serial')

// The error that the modbus-serial client rejects with for an exception response
function modbusException(code: number, name: string): Error {
  return Object.assign(new Error(`Modbus exception ${code}: ${name}`), { modbusCode: code })
}

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

    // Every exception except the two gateway exceptions comes from a device
    test.each([
      [0x02, 'Illegal data address (register not supported by device)'],
      [0x04, 'Slave device failure (device reports internal error)'],
      [0x06, 'Slave device busy (retry request again later)'],
      [0x09, 'Unknown error'],
      [0x0c, 'Unknown error'],
    ])('identifies device that answers FC43 with exception code %i', async (code, name) => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue(modbusException(code, name))

      const result = await identifyDevice(mockClient as ModbusRTU)

      expect(result.present).toBe(true)
      expect(result.supportsFC43).toBe(false)
      expect(result.exceptionCode).toBe(code)
    })
  })

  describe('device not present', () => {
    // Issue #583: a Modbus TCP gateway answers a request for a slave ID with no device behind
    // it with exception 0x0A or 0x0B. The exception comes from the gateway, not from a device.
    test.each([
      [0x0a, 'Gateway path unavailable (misconfigured gateway)'],
      [0x0b, 'Gateway target device failed to respond (retry request again later)'],
    ])('returns not present on gateway exception code %i', async (code, name) => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue(modbusException(code, name))

      const result = await identifyDevice(mockClient as ModbusRTU)

      expect(result.present).toBe(false)
      expect(result.responseTimeMs).toBeGreaterThan(0)
      expect(result.supportsFC43).toBeUndefined()
      expect(result.exceptionCode).toBeUndefined()
      expect(result.timeout).toBeUndefined()
      expect(result.crcError).toBeUndefined()
    })

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

      // Allow for timing precision variations (±1ms)
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(99)
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

    test('ignores modbusCode if it is not a number', async () => {
      mockClient.readDeviceIdentification = jest.fn().mockRejectedValue({
        message: 'Some error',
        modbusCode: 'invalid', // Non-number modbusCode should be ignored
      })

      const result = await identifyDevice(mockClient as ModbusRTU)

      // Should be treated as a generic error (not timeout, not CRC, not exception)
      expect(result.present).toBe(false)
      expect(result.timeout).toBeUndefined()
      expect(result.crcError).toBeUndefined()
      expect(result.exceptionCode).toBeUndefined()
    })
  })
})
