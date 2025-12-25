/**
 * Tests for XYMD1 Temperature and Humidity Sensor Driver
 */

import type { Transport } from '@ya-modbus/driver-types'

import { createDriver, DEFAULT_CONFIG } from './index'

describe('DEFAULT_CONFIG', () => {
  it('should export default device configuration', () => {
    expect(DEFAULT_CONFIG).toBeDefined()
    expect(DEFAULT_CONFIG.baudRate).toBe(9600)
    expect(DEFAULT_CONFIG.parity).toBe('even')
    expect(DEFAULT_CONFIG.dataBits).toBe(8)
    expect(DEFAULT_CONFIG.stopBits).toBe(1)
    expect(DEFAULT_CONFIG.defaultAddress).toBe(1)
  })

  it('should have correct baud rate from valid rates', () => {
    // Ensure default baud rate is one of the valid rates for XYMD1
    expect([9600, 14400, 19200]).toContain(DEFAULT_CONFIG.baudRate)
  })

  it('should have all required properties', () => {
    // Verify all expected properties are present
    expect(DEFAULT_CONFIG).toHaveProperty('baudRate')
    expect(DEFAULT_CONFIG).toHaveProperty('parity')
    expect(DEFAULT_CONFIG).toHaveProperty('dataBits')
    expect(DEFAULT_CONFIG).toHaveProperty('stopBits')
    expect(DEFAULT_CONFIG).toHaveProperty('defaultAddress')
  })
})

describe('XYMD1 Driver', () => {
  let mockTransport: jest.Mocked<Transport>

  beforeEach(() => {
    mockTransport = {
      readHoldingRegisters: jest.fn(),
      readInputRegisters: jest.fn(),
      readCoils: jest.fn(),
      readDiscreteInputs: jest.fn(),
      writeSingleRegister: jest.fn(),
      writeMultipleRegisters: jest.fn(),
      writeSingleCoil: jest.fn(),
      writeMultipleCoils: jest.fn(),
    }
  })

  describe('createDriver', () => {
    it('should create driver with correct metadata', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      expect(driver.name).toBe('XY-MD1')
      expect(driver.manufacturer).toBe('Unknown')
      expect(driver.model).toBe('XY-MD1')
    })

    it('should expose temperature and humidity data points', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      const dataPoints = driver.dataPoints
      expect(dataPoints).toHaveLength(6)

      const tempPoint = dataPoints.find((dp) => dp.id === 'temperature')
      expect(tempPoint).toBeDefined()
      expect(tempPoint?.type).toBe('float')
      expect(tempPoint?.unit).toBe('°C')
      expect(tempPoint?.access).toBe('r')

      const humidityPoint = dataPoints.find((dp) => dp.id === 'humidity')
      expect(humidityPoint).toBeDefined()
      expect(humidityPoint?.type).toBe('float')
      expect(humidityPoint?.unit).toBe('%')
      expect(humidityPoint?.access).toBe('r')

      const addressPoint = dataPoints.find((dp) => dp.id === 'device_address')
      expect(addressPoint).toBeDefined()
      expect(addressPoint?.type).toBe('integer')
      expect(addressPoint?.access).toBe('rw')
      expect(addressPoint?.pollType).toBe('on-demand')

      const baudRatePoint = dataPoints.find((dp) => dp.id === 'baud_rate')
      expect(baudRatePoint).toBeDefined()
      expect(baudRatePoint?.type).toBe('enum')
      expect(baudRatePoint?.access).toBe('rw')
      expect(baudRatePoint?.pollType).toBe('on-demand')

      const tempCorrectionPoint = dataPoints.find((dp) => dp.id === 'temperature_correction')
      expect(tempCorrectionPoint).toBeDefined()
      expect(tempCorrectionPoint?.type).toBe('float')
      expect(tempCorrectionPoint?.unit).toBe('°C')
      expect(tempCorrectionPoint?.access).toBe('rw')
      expect(tempCorrectionPoint?.pollType).toBe('on-demand')
      expect(tempCorrectionPoint?.min).toBe(-10.0)
      expect(tempCorrectionPoint?.max).toBe(10.0)

      const humCorrectionPoint = dataPoints.find((dp) => dp.id === 'humidity_correction')
      expect(humCorrectionPoint).toBeDefined()
      expect(humCorrectionPoint?.type).toBe('float')
      expect(humCorrectionPoint?.unit).toBe('%')
      expect(humCorrectionPoint?.access).toBe('rw')
      expect(humCorrectionPoint?.pollType).toBe('on-demand')
      expect(humCorrectionPoint?.min).toBe(-10.0)
      expect(humCorrectionPoint?.max).toBe(10.0)
    })
  })

  describe('readDataPoint', () => {
    it('should read temperature value', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response: temperature = 245 (24.5°C)
      mockTransport.readInputRegisters.mockResolvedValue(
        Buffer.from([0x00, 0xf5, 0x00, 0x00]) // 245 in first register
      )

      const temp = await driver.readDataPoint('temperature')
      expect(temp).toBe(24.5)
      expect(mockTransport.readInputRegisters).toHaveBeenCalledWith(1, 2)
    })

    it('should read humidity value', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response: humidity = 652 (65.2%)
      mockTransport.readInputRegisters.mockResolvedValue(
        Buffer.from([0x00, 0x00, 0x02, 0x8c]) // 652 in second register
      )

      const humidity = await driver.readDataPoint('humidity')
      expect(humidity).toBe(65.2)
      expect(mockTransport.readInputRegisters).toHaveBeenCalledWith(1, 2)
    })

    it('should handle zero values', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      mockTransport.readInputRegisters.mockResolvedValue(Buffer.from([0x00, 0x00, 0x00, 0x00]))

      const temp = await driver.readDataPoint('temperature')
      const humidity = await driver.readDataPoint('humidity')
      expect(temp).toBe(0)
      expect(humidity).toBe(0)
    })

    it('should throw on invalid data point ID', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await expect(driver.readDataPoint('invalid')).rejects.toThrow()
    })

    it('should read device address', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response: address = 5
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([0x00, 0x05]) // Address 5 as 16-bit value
      )

      const address = await driver.readDataPoint('device_address')
      expect(address).toBe(5)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x101, 1)
    })

    it('should read baud rate', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response: baud rate = 9600
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([0x25, 0x80]) // 9600 as 16-bit value
      )

      const baudRate = await driver.readDataPoint('baud_rate')
      expect(baudRate).toBe(9600)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x102, 1)
    })

    it.each([
      {
        dataPoint: 'temperature_correction',
        register: 0x103,
        value: 2.5,
        rawValue: [0x00, 0x19],
        description: '+2.5°C (value 25)',
      },
      {
        dataPoint: 'temperature_correction',
        register: 0x103,
        value: -3.0,
        rawValue: [0xff, 0xe2],
        description: '-3.0°C (value -30 = 0xFFE2)',
      },
      {
        dataPoint: 'temperature_correction',
        register: 0x103,
        value: 0,
        rawValue: [0x00, 0x00],
        description: '0°C',
      },
      {
        dataPoint: 'humidity_correction',
        register: 0x104,
        value: 5.0,
        rawValue: [0x00, 0x32],
        description: '+5.0%RH (value 50)',
      },
      {
        dataPoint: 'humidity_correction',
        register: 0x104,
        value: -3.0,
        rawValue: [0xff, 0xe2],
        description: '-3.0%RH (value -30 = 0xFFE2)',
      },
    ])('should read $dataPoint: $description', async ({ dataPoint, register, value, rawValue }) => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      mockTransport.readHoldingRegisters.mockResolvedValue(Buffer.from(rawValue))

      const correction = await driver.readDataPoint(dataPoint)
      expect(correction).toBe(value)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(register, 1)
    })
  })

  describe('readDataPoints', () => {
    it('should read both temperature and humidity together', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response: temp=245 (24.5°C), humidity=652 (65.2%)
      mockTransport.readInputRegisters.mockResolvedValue(Buffer.from([0x00, 0xf5, 0x02, 0x8c]))

      const values = await driver.readDataPoints(['temperature', 'humidity'])
      expect(values).toEqual({
        temperature: 24.5,
        humidity: 65.2,
      })
      expect(mockTransport.readInputRegisters).toHaveBeenCalledTimes(1)
    })

    it('should read single value efficiently', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      mockTransport.readInputRegisters.mockResolvedValue(Buffer.from([0x00, 0xf5, 0x02, 0x8c]))

      const values = await driver.readDataPoints(['temperature'])
      expect(values).toEqual({ temperature: 24.5 })
    })

    it('should read all data points including device configuration', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock input registers: temp=245 (24.5°C), humidity=652 (65.2%)
      mockTransport.readInputRegisters.mockResolvedValue(Buffer.from([0x00, 0xf5, 0x02, 0x8c]))
      // Mock batched holding registers: device_address=52 (0x0034), baud_rate=9600 (0x2580)
      mockTransport.readHoldingRegisters.mockResolvedValueOnce(
        Buffer.from([0x00, 0x34, 0x25, 0x80])
      )

      const values = await driver.readDataPoints([
        'temperature',
        'humidity',
        'device_address',
        'baud_rate',
      ])

      expect(values).toEqual({
        temperature: 24.5,
        humidity: 65.2,
        device_address: 52,
        baud_rate: 9600,
      })

      // Should read input registers once for temp/humidity
      expect(mockTransport.readInputRegisters).toHaveBeenCalledWith(1, 2)
      // Should batch read both config registers together (optimization)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x101, 2)
    })

    it('should read only device configuration without sensor data', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock batched holding registers: device_address=10 (0x000A), baud_rate=19200 (0x4B00)
      mockTransport.readHoldingRegisters.mockResolvedValueOnce(
        Buffer.from([0x00, 0x0a, 0x4b, 0x00])
      )

      const values = await driver.readDataPoints(['device_address', 'baud_rate'])

      expect(values).toEqual({
        device_address: 10,
        baud_rate: 19200,
      })

      // Should not read input registers
      expect(mockTransport.readInputRegisters).not.toHaveBeenCalled()
      // Should batch read both config registers together (optimization)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x101, 2)
    })

    it('should read correction values without sensor data', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock batched holding registers: temperature_correction=+2.5°C (25), humidity_correction=-3.0%RH (-30)
      mockTransport.readHoldingRegisters.mockResolvedValueOnce(
        Buffer.from([0x00, 0x19, 0xff, 0xe2])
      )

      const values = await driver.readDataPoints(['temperature_correction', 'humidity_correction'])

      expect(values).toEqual({
        temperature_correction: 2.5,
        humidity_correction: -3.0,
      })

      // Should not read input registers
      expect(mockTransport.readInputRegisters).not.toHaveBeenCalled()
      // Should batch read both correction registers together (optimization)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x103, 2)
    })

    it('should read all 4 holding registers in single batch when all requested', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock all 4 holding registers: device_address=52, baud_rate=9600, temp_corr=2.5, hum_corr=-3.0
      mockTransport.readHoldingRegisters.mockResolvedValueOnce(
        Buffer.from([
          0x00,
          0x34, // device_address = 52
          0x25,
          0x80, // baud_rate = 9600
          0x00,
          0x19, // temperature_correction = 2.5 (25)
          0xff,
          0xe2, // humidity_correction = -3.0 (-30)
        ])
      )

      const values = await driver.readDataPoints([
        'device_address',
        'baud_rate',
        'temperature_correction',
        'humidity_correction',
      ])

      expect(values).toEqual({
        device_address: 52,
        baud_rate: 9600,
        temperature_correction: 2.5,
        humidity_correction: -3.0,
      })

      // Should batch read all 4 registers in a single transaction (maximum optimization)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x101, 4)
    })

    it('should read individual device_address when only that is requested', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      mockTransport.readHoldingRegisters.mockResolvedValueOnce(Buffer.from([0x00, 0x0a]))

      const values = await driver.readDataPoints(['device_address'])

      expect(values).toEqual({ device_address: 10 })
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x101, 1)
    })

    it('should read individual baud_rate when only that is requested', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      mockTransport.readHoldingRegisters.mockResolvedValueOnce(Buffer.from([0x4b, 0x00]))

      const values = await driver.readDataPoints(['baud_rate'])

      expect(values).toEqual({ baud_rate: 19200 })
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x102, 1)
    })

    it('should read individual temperature_correction when only that is requested', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      mockTransport.readHoldingRegisters.mockResolvedValueOnce(Buffer.from([0x00, 0x19]))

      const values = await driver.readDataPoints(['temperature_correction'])

      expect(values).toEqual({ temperature_correction: 2.5 })
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x103, 1)
    })

    it('should read individual humidity_correction when only that is requested', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      mockTransport.readHoldingRegisters.mockResolvedValueOnce(Buffer.from([0xff, 0xe2]))

      const values = await driver.readDataPoints(['humidity_correction'])

      expect(values).toEqual({ humidity_correction: -3.0 })
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x104, 1)
    })
  })

  describe('writeDataPoint', () => {
    it('should throw error when writing to read-only data point', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await expect(driver.writeDataPoint('temperature', 25)).rejects.toThrow()
      await expect(driver.writeDataPoint('humidity', 50)).rejects.toThrow()
    })

    it('should configure device address', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await driver.writeDataPoint('device_address', 5)

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(
        0x101,
        Buffer.from([0x00, 0x05]) // Address 5 as 16-bit value
      )
    })

    it('should validate device address range', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await expect(driver.writeDataPoint('device_address', 0)).rejects.toThrow(
        'Invalid device address'
      )
      await expect(driver.writeDataPoint('device_address', 248)).rejects.toThrow(
        'Invalid device address'
      )
      await expect(driver.writeDataPoint('device_address', -1)).rejects.toThrow(
        'Invalid device address'
      )
    })

    it('should accept valid device address range 1-247', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await driver.writeDataPoint('device_address', 1)
      await driver.writeDataPoint('device_address', 247)

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledTimes(2)
    })

    it('should configure baud rate', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await driver.writeDataPoint('baud_rate', 9600)

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(
        0x102,
        Buffer.from([0x25, 0x80]) // 9600 as 16-bit value
      )
    })

    it('should validate baud rate values', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await expect(driver.writeDataPoint('baud_rate', 1234)).rejects.toThrow('Invalid baud rate')
      await expect(driver.writeDataPoint('baud_rate', 'invalid')).rejects.toThrow(
        'Invalid baud rate'
      )
    })

    it('should reject previously-listed but unsupported baud rates', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // These rates were listed in initial implementation but were never actually supported by the device
      await expect(driver.writeDataPoint('baud_rate', 2400)).rejects.toThrow('Invalid baud rate')
      await expect(driver.writeDataPoint('baud_rate', 4800)).rejects.toThrow('Invalid baud rate')
      await expect(driver.writeDataPoint('baud_rate', 38400)).rejects.toThrow('Invalid baud rate')
    })

    it('should accept standard baud rates', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      const validRates = [9600, 14400, 19200]

      for (const rate of validRates) {
        await driver.writeDataPoint('baud_rate', rate)
      }

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledTimes(validRates.length)
    })

    it.each([
      {
        dataPoint: 'temperature_correction',
        register: 0x103,
        value: 2.5,
        encoded: [0x00, 0x19],
        description: '+2.5°C (25 × 10 = 0x0019)',
      },
      {
        dataPoint: 'temperature_correction',
        register: 0x103,
        value: -3.0,
        encoded: [0xff, 0xe2],
        description: '-3.0°C (-30 × 10 = 0xFFE2)',
      },
      {
        dataPoint: 'temperature_correction',
        register: 0x103,
        value: 0,
        encoded: [0x00, 0x00],
        description: '0°C',
      },
      {
        dataPoint: 'humidity_correction',
        register: 0x104,
        value: 5.0,
        encoded: [0x00, 0x32],
        description: '+5.0%RH (50 × 10 = 0x0032)',
      },
      {
        dataPoint: 'humidity_correction',
        register: 0x104,
        value: -3.0,
        encoded: [0xff, 0xe2],
        description: '-3.0%RH (-30 × 10 = 0xFFE2)',
      },
    ])('should write $dataPoint: $description', async ({ dataPoint, register, value, encoded }) => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await driver.writeDataPoint(dataPoint, value)

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(
        register,
        Buffer.from(encoded)
      )
    })

    it.each([
      {
        dataPoint: 'temperature_correction',
        invalidValue: -10.1,
        errorMessage: 'Invalid temperature correction',
      },
      {
        dataPoint: 'temperature_correction',
        invalidValue: 10.1,
        errorMessage: 'Invalid temperature correction',
      },
      {
        dataPoint: 'humidity_correction',
        invalidValue: -10.1,
        errorMessage: 'Invalid humidity correction',
      },
      {
        dataPoint: 'humidity_correction',
        invalidValue: 10.1,
        errorMessage: 'Invalid humidity correction',
      },
    ])(
      'should reject $dataPoint value $invalidValue',
      async ({ dataPoint, invalidValue, errorMessage }) => {
        const driver = await createDriver({
          transport: mockTransport,
          slaveId: 1,
        })

        await expect(driver.writeDataPoint(dataPoint, invalidValue)).rejects.toThrow(errorMessage)
      }
    )

    it.each([
      { dataPoint: 'temperature_correction', values: [-10.0, 10.0] },
      { dataPoint: 'humidity_correction', values: [-10.0, 10.0] },
    ])('should accept $dataPoint boundary values', async ({ dataPoint, values }) => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      for (const value of values) {
        await driver.writeDataPoint(dataPoint, value)
      }

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledTimes(values.length)
    })

    it('should handle floating-point precision correctly when encoding', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Test value 2.55 which could round to either 25 or 26 depending on precision
      // Math.trunc(2.55 * 10) = Math.trunc(25.5) = 25
      await driver.writeDataPoint('temperature_correction', 2.55)

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(
        0x103,
        Buffer.from([0x00, 0x19]) // 25, not 26
      )
    })
  })
})
