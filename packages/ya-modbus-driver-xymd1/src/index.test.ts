/**
 * Tests for XYMD1 Temperature and Humidity Sensor Driver
 */

import type { Transport } from '@ya-modbus/driver-types';

import { createDriver } from './index';

describe('XYMD1 Driver', () => {
  let mockTransport: jest.Mocked<Transport>;

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
    };
  });

  describe('createDriver', () => {
    it('should create driver with correct metadata', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      expect(driver.name).toBe('XY-MD1');
      expect(driver.manufacturer).toBe('Unknown');
      expect(driver.model).toBe('XY-MD1');
    });

    it('should expose temperature and humidity data points', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      const dataPoints = driver.dataPoints;
      expect(dataPoints).toHaveLength(4);

      const tempPoint = dataPoints.find(dp => dp.id === 'temperature');
      expect(tempPoint).toBeDefined();
      expect(tempPoint?.type).toBe('float');
      expect(tempPoint?.unit).toBe('°C');
      expect(tempPoint?.access).toBe('r');

      const humidityPoint = dataPoints.find(dp => dp.id === 'humidity');
      expect(humidityPoint).toBeDefined();
      expect(humidityPoint?.type).toBe('float');
      expect(humidityPoint?.unit).toBe('%');
      expect(humidityPoint?.access).toBe('r');

      const addressPoint = dataPoints.find(dp => dp.id === 'device_address');
      expect(addressPoint).toBeDefined();
      expect(addressPoint?.type).toBe('integer');
      expect(addressPoint?.access).toBe('rw');
      expect(addressPoint?.pollType).toBe('on-demand');

      const baudRatePoint = dataPoints.find(dp => dp.id === 'baud_rate');
      expect(baudRatePoint).toBeDefined();
      expect(baudRatePoint?.type).toBe('enum');
      expect(baudRatePoint?.access).toBe('rw');
      expect(baudRatePoint?.pollType).toBe('on-demand');
    });
  });

  describe('readDataPoint', () => {
    it('should read temperature value', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      // Mock response: temperature = 245 (24.5°C)
      mockTransport.readInputRegisters.mockResolvedValue(
        Buffer.from([0x00, 0xf5, 0x00, 0x00]) // 245 in first register
      );

      const temp = await driver.readDataPoint('temperature');
      expect(temp).toBe(24.5);
      expect(mockTransport.readInputRegisters).toHaveBeenCalledWith(1, 2);
    });

    it('should read humidity value', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      // Mock response: humidity = 652 (65.2%)
      mockTransport.readInputRegisters.mockResolvedValue(
        Buffer.from([0x00, 0x00, 0x02, 0x8c]) // 652 in second register
      );

      const humidity = await driver.readDataPoint('humidity');
      expect(humidity).toBe(65.2);
      expect(mockTransport.readInputRegisters).toHaveBeenCalledWith(1, 2);
    });

    it('should handle zero values', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      mockTransport.readInputRegisters.mockResolvedValue(
        Buffer.from([0x00, 0x00, 0x00, 0x00])
      );

      const temp = await driver.readDataPoint('temperature');
      const humidity = await driver.readDataPoint('humidity');
      expect(temp).toBe(0);
      expect(humidity).toBe(0);
    });

    it('should throw on invalid data point ID', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      await expect(driver.readDataPoint('invalid')).rejects.toThrow();
    });

    it('should read device address', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      // Mock response: address = 5
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([0x00, 0x05]) // Address 5 as 16-bit value
      );

      const address = await driver.readDataPoint('device_address');
      expect(address).toBe(5);
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x101, 1);
    });

    it('should read baud rate', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      // Mock response: baud rate = 9600
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([0x25, 0x80]) // 9600 as 16-bit value
      );

      const baudRate = await driver.readDataPoint('baud_rate');
      expect(baudRate).toBe(9600);
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x102, 1);
    });
  });

  describe('readDataPoints', () => {
    it('should read both temperature and humidity together', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      // Mock response: temp=245 (24.5°C), humidity=652 (65.2%)
      mockTransport.readInputRegisters.mockResolvedValue(
        Buffer.from([0x00, 0xf5, 0x02, 0x8c])
      );

      const values = await driver.readDataPoints(['temperature', 'humidity']);
      expect(values).toEqual({
        temperature: 24.5,
        humidity: 65.2,
      });
      expect(mockTransport.readInputRegisters).toHaveBeenCalledTimes(1);
    });

    it('should read single value efficiently', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      mockTransport.readInputRegisters.mockResolvedValue(
        Buffer.from([0x00, 0xf5, 0x02, 0x8c])
      );

      const values = await driver.readDataPoints(['temperature']);
      expect(values).toEqual({ temperature: 24.5 });
    });
  });

  describe('writeDataPoint', () => {
    it('should throw error as device is read-only', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      await expect(driver.writeDataPoint('temperature', 25)).rejects.toThrow();
    });

    it('should configure device address', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      await driver.writeDataPoint('device_address', 5);

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(
        0x101,
        Buffer.from([0x00, 0x05]) // Address 5 as 16-bit value
      );
    });

    it('should validate device address range', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      await expect(driver.writeDataPoint('device_address', 0)).rejects.toThrow('Invalid device address');
      await expect(driver.writeDataPoint('device_address', 248)).rejects.toThrow('Invalid device address');
      await expect(driver.writeDataPoint('device_address', -1)).rejects.toThrow('Invalid device address');
    });

    it('should accept valid device address range 1-247', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      await driver.writeDataPoint('device_address', 1);
      await driver.writeDataPoint('device_address', 247);

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledTimes(2);
    });

    it('should configure baud rate', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      await driver.writeDataPoint('baud_rate', 9600);

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(
        0x102,
        Buffer.from([0x25, 0x80]) // 9600 as 16-bit value
      );
    });

    it('should validate baud rate values', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      await expect(driver.writeDataPoint('baud_rate', 1234)).rejects.toThrow('Invalid baud rate');
      await expect(driver.writeDataPoint('baud_rate', 'invalid')).rejects.toThrow('Invalid baud rate');
    });

    it('should accept standard baud rates', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      });

      const validRates = [2400, 4800, 9600, 19200, 38400];

      for (const rate of validRates) {
        await driver.writeDataPoint('baud_rate', rate);
      }

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledTimes(validRates.length);
    });
  });
});
