/**
 * Tests for XYMD1 Temperature and Humidity Sensor Driver
 */

import type { Transport } from '@ya-modbus/driver-types'

import { createDriver } from './index'

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

    it('should read temperature correction (positive value)', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response: +2.5°C correction (value 25)
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([0x00, 0x19]) // 25 as 16-bit value
      )

      const correction = await driver.readDataPoint('temperature_correction')
      expect(correction).toBe(2.5)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x103, 1)
    })

    it('should read temperature correction (negative value)', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response: -3.0°C correction (value -30 = 0xFFE2 in two's complement)
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([0xff, 0xe2]) // -30 as signed 16-bit value
      )

      const correction = await driver.readDataPoint('temperature_correction')
      expect(correction).toBe(-3.0)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x103, 1)
    })

    it('should read temperature correction (zero)', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response: 0°C correction
      mockTransport.readHoldingRegisters.mockResolvedValue(Buffer.from([0x00, 0x00]))

      const correction = await driver.readDataPoint('temperature_correction')
      expect(correction).toBe(0)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x103, 1)
    })

    it('should read humidity correction (positive value)', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response: +5.0%RH correction (value 50)
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([0x00, 0x32]) // 50 as 16-bit value
      )

      const correction = await driver.readDataPoint('humidity_correction')
      expect(correction).toBe(5.0)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x104, 1)
    })

    it('should read humidity correction (negative value)', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response: -3.0%RH correction (value -30 = 0xFFE2 in two's complement)
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([0xff, 0xe2]) // -30 as signed 16-bit value
      )

      const correction = await driver.readDataPoint('humidity_correction')
      expect(correction).toBe(-3.0)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x104, 1)
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
      // Mock holding register for device_address: 52 (0x34)
      mockTransport.readHoldingRegisters.mockResolvedValueOnce(Buffer.from([0x00, 0x34]))
      // Mock holding register for baud_rate: 9600 (0x2580)
      mockTransport.readHoldingRegisters.mockResolvedValueOnce(Buffer.from([0x25, 0x80]))

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
      // Should read holding registers separately for device_address and baud_rate
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x101, 1)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x102, 1)
    })

    it('should read only device configuration without sensor data', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock holding register for device_address: 10 (0x0A)
      mockTransport.readHoldingRegisters.mockResolvedValueOnce(Buffer.from([0x00, 0x0a]))
      // Mock holding register for baud_rate: 19200 (0x4B00)
      mockTransport.readHoldingRegisters.mockResolvedValueOnce(Buffer.from([0x4b, 0x00]))

      const values = await driver.readDataPoints(['device_address', 'baud_rate'])

      expect(values).toEqual({
        device_address: 10,
        baud_rate: 19200,
      })

      // Should not read input registers
      expect(mockTransport.readInputRegisters).not.toHaveBeenCalled()
      // Should read holding registers separately
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x101, 1)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x102, 1)
    })

    it('should read correction values without sensor data', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock holding register for temperature_correction: +2.5°C (25)
      mockTransport.readHoldingRegisters.mockResolvedValueOnce(Buffer.from([0x00, 0x19]))
      // Mock holding register for humidity_correction: -3.0%RH (-30 = 0xFFE2)
      mockTransport.readHoldingRegisters.mockResolvedValueOnce(Buffer.from([0xff, 0xe2]))

      const values = await driver.readDataPoints(['temperature_correction', 'humidity_correction'])

      expect(values).toEqual({
        temperature_correction: 2.5,
        humidity_correction: -3.0,
      })

      // Should not read input registers
      expect(mockTransport.readInputRegisters).not.toHaveBeenCalled()
      // Should read holding registers for corrections
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x103, 1)
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

    it('should accept standard baud rates', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      const validRates = [2400, 4800, 9600, 19200, 38400]

      for (const rate of validRates) {
        await driver.writeDataPoint('baud_rate', rate)
      }

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledTimes(validRates.length)
    })

    it('should write temperature correction (positive value)', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await driver.writeDataPoint('temperature_correction', 2.5)

      // 2.5°C = 25 (×10) = 0x0019
      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(
        0x103,
        Buffer.from([0x00, 0x19])
      )
    })

    it('should write temperature correction (negative value)', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await driver.writeDataPoint('temperature_correction', -3.0)

      // -3.0°C = -30 (×10) = 0xFFE2 in two's complement
      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(
        0x103,
        Buffer.from([0xff, 0xe2])
      )
    })

    it('should write temperature correction (zero)', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await driver.writeDataPoint('temperature_correction', 0)

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(
        0x103,
        Buffer.from([0x00, 0x00])
      )
    })

    it('should write humidity correction (positive value)', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await driver.writeDataPoint('humidity_correction', 5.0)

      // 5.0%RH = 50 (×10) = 0x0032
      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(
        0x104,
        Buffer.from([0x00, 0x32])
      )
    })

    it('should write humidity correction (negative value)', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await driver.writeDataPoint('humidity_correction', -3.0)

      // -3.0%RH = -30 (×10) = 0xFFE2 in two's complement
      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(
        0x104,
        Buffer.from([0xff, 0xe2])
      )
    })

    it('should validate temperature correction range', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await expect(driver.writeDataPoint('temperature_correction', -10.1)).rejects.toThrow(
        'Invalid temperature correction'
      )
      await expect(driver.writeDataPoint('temperature_correction', 10.1)).rejects.toThrow(
        'Invalid temperature correction'
      )
    })

    it('should accept temperature correction boundary values', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await driver.writeDataPoint('temperature_correction', -10.0)
      await driver.writeDataPoint('temperature_correction', 10.0)

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledTimes(2)
    })

    it('should validate humidity correction range', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await expect(driver.writeDataPoint('humidity_correction', -10.1)).rejects.toThrow(
        'Invalid humidity correction'
      )
      await expect(driver.writeDataPoint('humidity_correction', 10.1)).rejects.toThrow(
        'Invalid humidity correction'
      )
    })

    it('should accept humidity correction boundary values', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await driver.writeDataPoint('humidity_correction', -10.0)
      await driver.writeDataPoint('humidity_correction', 10.0)

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledTimes(2)
    })
  })
})
