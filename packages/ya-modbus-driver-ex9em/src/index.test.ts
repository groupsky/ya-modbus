/**
 * Tests for NOARK Ex9EM Energy Meter Driver
 */

import type { Transport } from '@ya-modbus/driver-types'

import { createDriver, DEFAULT_CONFIG, SUPPORTED_CONFIG } from './index'

describe('Configuration Constants', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should export default device configuration', () => {
      expect(DEFAULT_CONFIG).toBeDefined()
      expect(DEFAULT_CONFIG.baudRate).toBe(9600)
      expect(DEFAULT_CONFIG.parity).toBe('even')
      expect(DEFAULT_CONFIG.dataBits).toBe(8)
      expect(DEFAULT_CONFIG.stopBits).toBe(1)
      expect(DEFAULT_CONFIG.defaultAddress).toBe(1)
    })

    it('should have all required properties', () => {
      expect(DEFAULT_CONFIG).toHaveProperty('baudRate')
      expect(DEFAULT_CONFIG).toHaveProperty('parity')
      expect(DEFAULT_CONFIG).toHaveProperty('dataBits')
      expect(DEFAULT_CONFIG).toHaveProperty('stopBits')
      expect(DEFAULT_CONFIG).toHaveProperty('defaultAddress')
    })
  })

  describe('SUPPORTED_CONFIG', () => {
    it('should export supported configuration values', () => {
      expect(SUPPORTED_CONFIG).toBeDefined()
      expect(SUPPORTED_CONFIG.validBaudRates).toEqual([1200, 2400, 4800, 9600])
      expect(SUPPORTED_CONFIG.validParity).toEqual(['even', 'none'])
      expect(SUPPORTED_CONFIG.validDataBits).toEqual([8])
      expect(SUPPORTED_CONFIG.validStopBits).toEqual([1])
      expect(SUPPORTED_CONFIG.validAddressRange).toEqual([1, 247])
    })

    it('should include DEFAULT_CONFIG baud rate in valid baud rates', () => {
      expect(SUPPORTED_CONFIG.validBaudRates).toContain(DEFAULT_CONFIG.baudRate)
    })

    it('should include DEFAULT_CONFIG parity in valid parity settings', () => {
      expect(SUPPORTED_CONFIG.validParity).toContain(DEFAULT_CONFIG.parity)
    })

    it('should include DEFAULT_CONFIG data bits in valid data bits', () => {
      expect(SUPPORTED_CONFIG.validDataBits).toContain(DEFAULT_CONFIG.dataBits)
    })

    it('should include DEFAULT_CONFIG stop bits in valid stop bits', () => {
      expect(SUPPORTED_CONFIG.validStopBits).toContain(DEFAULT_CONFIG.stopBits)
    })

    it('should include DEFAULT_CONFIG address in valid address range', () => {
      const [min, max] = SUPPORTED_CONFIG.validAddressRange
      expect(DEFAULT_CONFIG.defaultAddress).toBeGreaterThanOrEqual(min)
      expect(DEFAULT_CONFIG.defaultAddress).toBeLessThanOrEqual(max)
    })
  })
})

describe('Ex9EM Driver', () => {
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

      expect(driver.name).toBe('Ex9EM')
      expect(driver.manufacturer).toBe('NOARK Electric')
      expect(driver.model).toBe('Ex9EM')
    })

    it('should expose all energy meter data points', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      const dataPoints = driver.dataPoints
      expect(dataPoints).toHaveLength(11)

      const voltage = dataPoints.find((dp) => dp.id === 'voltage')
      expect(voltage).toBeDefined()
      expect(voltage?.type).toBe('float')
      expect(voltage?.unit).toBe('V')
      expect(voltage?.access).toBe('r')

      const current = dataPoints.find((dp) => dp.id === 'current')
      expect(current).toBeDefined()
      expect(current?.type).toBe('float')
      expect(current?.unit).toBe('A')
      expect(current?.access).toBe('r')

      const frequency = dataPoints.find((dp) => dp.id === 'frequency')
      expect(frequency).toBeDefined()
      expect(frequency?.type).toBe('float')
      expect(frequency?.unit).toBe('Hz')
      expect(frequency?.access).toBe('r')

      const activePower = dataPoints.find((dp) => dp.id === 'active_power')
      expect(activePower).toBeDefined()
      expect(activePower?.type).toBe('integer')
      expect(activePower?.unit).toBe('W')
      expect(activePower?.access).toBe('r')

      const reactivePower = dataPoints.find((dp) => dp.id === 'reactive_power')
      expect(reactivePower).toBeDefined()
      expect(reactivePower?.type).toBe('integer')
      expect(reactivePower?.unit).toBe('VAr')
      expect(reactivePower?.access).toBe('r')

      const apparentPower = dataPoints.find((dp) => dp.id === 'apparent_power')
      expect(apparentPower).toBeDefined()
      expect(apparentPower?.type).toBe('integer')
      expect(apparentPower?.unit).toBe('VA')
      expect(apparentPower?.access).toBe('r')

      const powerFactor = dataPoints.find((dp) => dp.id === 'power_factor')
      expect(powerFactor).toBeDefined()
      expect(powerFactor?.type).toBe('float')
      expect(powerFactor?.unit).toBeUndefined()
      expect(powerFactor?.access).toBe('r')
      expect(powerFactor?.min).toBe(0)
      expect(powerFactor?.max).toBe(1)

      const totalActiveEnergy = dataPoints.find((dp) => dp.id === 'total_active_energy')
      expect(totalActiveEnergy).toBeDefined()
      expect(totalActiveEnergy?.type).toBe('float')
      expect(totalActiveEnergy?.unit).toBe('kWh')
      expect(totalActiveEnergy?.access).toBe('r')

      const totalReactiveEnergy = dataPoints.find((dp) => dp.id === 'total_reactive_energy')
      expect(totalReactiveEnergy).toBeDefined()
      expect(totalReactiveEnergy?.type).toBe('float')
      expect(totalReactiveEnergy?.unit).toBe('kVArh')
      expect(totalReactiveEnergy?.access).toBe('r')

      const deviceAddress = dataPoints.find((dp) => dp.id === 'device_address')
      expect(deviceAddress).toBeDefined()
      expect(deviceAddress?.type).toBe('integer')
      expect(deviceAddress?.access).toBe('rw')
      expect(deviceAddress?.pollType).toBe('on-demand')
      expect(deviceAddress?.min).toBe(1)
      expect(deviceAddress?.max).toBe(247)

      const baudRate = dataPoints.find((dp) => dp.id === 'baud_rate')
      expect(baudRate).toBeDefined()
      expect(baudRate?.type).toBe('enum')
      expect(baudRate?.access).toBe('rw')
      expect(baudRate?.pollType).toBe('on-demand')
    })
  })

  describe('readDataPoint', () => {
    it('should read voltage value', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response with voltage = 2300 (230.0V) at register 0
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([
          0x08,
          0xfc, // voltage = 2300 (230.0V)
          0x00,
          0x0a, // current = 10 (1.0A)
          0x01,
          0xf4, // frequency = 500 (50.0Hz)
          0x00,
          0xe4, // active_power = 228W
          0x00,
          0x00, // reactive_power = 0VAr
          0x00,
          0xe6, // apparent_power = 230VA
          0x03,
          0xe8, // power_factor = 1000 (1.000)
          0x00,
          0x00,
          0x00,
          0x64, // total_active_energy = 100 (1.00kWh)
          0x00,
          0x00,
          0x00,
          0x00, // total_reactive_energy = 0 (0.00kVArh)
        ])
      )

      const voltage = await driver.readDataPoint('voltage')
      expect(voltage).toBe(230.0)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x0000, 11)
    })

    it('should read current value', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response with current = 52 (5.2A) at register 1
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([
          0x08,
          0xfc, // voltage = 2300 (230.0V)
          0x00,
          0x34, // current = 52 (5.2A)
          0x01,
          0xf4, // frequency = 500 (50.0Hz)
          0x04,
          0xa4, // active_power = 1188W
          0x00,
          0x00, // reactive_power = 0VAr
          0x04,
          0xa6, // apparent_power = 1190VA
          0x03,
          0xe7, // power_factor = 999 (0.999)
          0x00,
          0x00,
          0x00,
          0x64, // total_active_energy = 100 (1.00kWh)
          0x00,
          0x00,
          0x00,
          0x00, // total_reactive_energy = 0 (0.00kVArh)
        ])
      )

      const current = await driver.readDataPoint('current')
      expect(current).toBe(5.2)
    })

    it('should read frequency value', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response with frequency = 500 (50.0Hz) at register 2
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([
          0x08,
          0xfc, // voltage = 2300
          0x00,
          0x0a, // current = 10
          0x01,
          0xf4, // frequency = 500 (50.0Hz)
          0x00,
          0xe4, // active_power = 228W
          0x00,
          0x00, // reactive_power = 0VAr
          0x00,
          0xe6, // apparent_power = 230VA
          0x03,
          0xe8, // power_factor = 1000
          0x00,
          0x00,
          0x00,
          0x64, // total_active_energy = 100
          0x00,
          0x00,
          0x00,
          0x00, // total_reactive_energy = 0
        ])
      )

      const frequency = await driver.readDataPoint('frequency')
      expect(frequency).toBe(50.0)
    })

    it('should read active power value', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response with active_power = 1188W at register 3
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([
          0x08,
          0xfc, // voltage = 2300
          0x00,
          0x34, // current = 52
          0x01,
          0xf4, // frequency = 500
          0x04,
          0xa4, // active_power = 1188W
          0x00,
          0x00, // reactive_power = 0VAr
          0x04,
          0xa6, // apparent_power = 1190VA
          0x03,
          0xe7, // power_factor = 999
          0x00,
          0x00,
          0x00,
          0x64, // total_active_energy = 100
          0x00,
          0x00,
          0x00,
          0x00, // total_reactive_energy = 0
        ])
      )

      const activePower = await driver.readDataPoint('active_power')
      expect(activePower).toBe(1188)
    })

    it('should read reactive power value', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response with reactive_power = 150VAr at register 4
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([
          0x08,
          0xfc, // voltage = 2300
          0x00,
          0x34, // current = 52
          0x01,
          0xf4, // frequency = 500
          0x04,
          0xa4, // active_power = 1188W
          0x00,
          0x96, // reactive_power = 150VAr
          0x04,
          0xb5, // apparent_power = 1205VA
          0x03,
          0xd4, // power_factor = 980
          0x00,
          0x00,
          0x00,
          0x64, // total_active_energy = 100
          0x00,
          0x00,
          0x00,
          0x00, // total_reactive_energy = 0
        ])
      )

      const reactivePower = await driver.readDataPoint('reactive_power')
      expect(reactivePower).toBe(150)
    })

    it('should read apparent power value', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response with apparent_power = 1205VA at register 5
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([
          0x08,
          0xfc, // voltage = 2300
          0x00,
          0x34, // current = 52
          0x01,
          0xf4, // frequency = 500
          0x04,
          0xa4, // active_power = 1188W
          0x00,
          0x96, // reactive_power = 150VAr
          0x04,
          0xb5, // apparent_power = 1205VA
          0x03,
          0xd4, // power_factor = 980
          0x00,
          0x00,
          0x00,
          0x64, // total_active_energy = 100
          0x00,
          0x00,
          0x00,
          0x00, // total_reactive_energy = 0
        ])
      )

      const apparentPower = await driver.readDataPoint('apparent_power')
      expect(apparentPower).toBe(1205)
    })

    it('should read power factor value', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response with power_factor = 850 (0.850) at register 6
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([
          0x08,
          0xfc, // voltage = 2300
          0x00,
          0x34, // current = 52
          0x01,
          0xf4, // frequency = 500
          0x04,
          0xa4, // active_power = 1188W
          0x00,
          0x96, // reactive_power = 150VAr
          0x04,
          0xb5, // apparent_power = 1205VA
          0x03,
          0x52, // power_factor = 850 (0.850)
          0x00,
          0x00,
          0x00,
          0x64, // total_active_energy = 100
          0x00,
          0x00,
          0x00,
          0x00, // total_reactive_energy = 0
        ])
      )

      const powerFactor = await driver.readDataPoint('power_factor')
      expect(powerFactor).toBe(0.85)
    })

    it('should read total active energy value', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response with total_active_energy = 123456 (1234.56kWh) at registers 7-8
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([
          0x08,
          0xfc, // voltage = 2300
          0x00,
          0x34, // current = 52
          0x01,
          0xf4, // frequency = 500
          0x04,
          0xa4, // active_power = 1188W
          0x00,
          0x96, // reactive_power = 150VAr
          0x04,
          0xb5, // apparent_power = 1205VA
          0x03,
          0x52, // power_factor = 850
          0x00,
          0x01,
          0xe2,
          0x40, // total_active_energy = 123456 (1234.56kWh)
          0x00,
          0x00,
          0x00,
          0x00, // total_reactive_energy = 0
        ])
      )

      const totalActiveEnergy = await driver.readDataPoint('total_active_energy')
      expect(totalActiveEnergy).toBe(1234.56)
    })

    it('should read total reactive energy value', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response with total_reactive_energy = 98765 (987.65kVArh) at registers 9-10
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([
          0x08,
          0xfc, // voltage = 2300
          0x00,
          0x34, // current = 52
          0x01,
          0xf4, // frequency = 500
          0x04,
          0xa4, // active_power = 1188W
          0x00,
          0x96, // reactive_power = 150VAr
          0x04,
          0xb5, // apparent_power = 1205VA
          0x03,
          0x52, // power_factor = 850
          0x00,
          0x01,
          0xe2,
          0x40, // total_active_energy = 123456
          0x00,
          0x01,
          0x81,
          0xcd, // total_reactive_energy = 98765 (987.65kVArh)
        ])
      )

      const totalReactiveEnergy = await driver.readDataPoint('total_reactive_energy')
      expect(totalReactiveEnergy).toBe(987.65)
    })

    it('should handle zero values', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // All zeros
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([
          0x00,
          0x00, // voltage = 0
          0x00,
          0x00, // current = 0
          0x00,
          0x00, // frequency = 0
          0x00,
          0x00, // active_power = 0
          0x00,
          0x00, // reactive_power = 0
          0x00,
          0x00, // apparent_power = 0
          0x00,
          0x00, // power_factor = 0
          0x00,
          0x00,
          0x00,
          0x00, // total_active_energy = 0
          0x00,
          0x00,
          0x00,
          0x00, // total_reactive_energy = 0
        ])
      )

      const voltage = await driver.readDataPoint('voltage')
      const current = await driver.readDataPoint('current')
      const frequency = await driver.readDataPoint('frequency')
      const activePower = await driver.readDataPoint('active_power')
      const reactivePower = await driver.readDataPoint('reactive_power')
      const apparentPower = await driver.readDataPoint('apparent_power')
      const powerFactor = await driver.readDataPoint('power_factor')
      const totalActiveEnergy = await driver.readDataPoint('total_active_energy')
      const totalReactiveEnergy = await driver.readDataPoint('total_reactive_energy')

      expect(voltage).toBe(0)
      expect(current).toBe(0)
      expect(frequency).toBe(0)
      expect(activePower).toBe(0)
      expect(reactivePower).toBe(0)
      expect(apparentPower).toBe(0)
      expect(powerFactor).toBe(0)
      expect(totalActiveEnergy).toBe(0)
      expect(totalReactiveEnergy).toBe(0)
    })

    it('should throw on invalid data point ID', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      mockTransport.readHoldingRegisters.mockResolvedValue(Buffer.alloc(22))

      await expect(driver.readDataPoint('invalid')).rejects.toThrow('Unknown data point')
    })

    it('should handle power factor boundary value 0.000', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([
          0x00,
          0x00, // voltage = 0
          0x00,
          0x00, // current = 0
          0x00,
          0x00, // frequency = 0
          0x00,
          0x00, // active_power = 0
          0x00,
          0x00, // reactive_power = 0
          0x00,
          0x00, // apparent_power = 0
          0x00,
          0x00, // power_factor = 0 (0.000)
          0x00,
          0x00,
          0x00,
          0x00, // total_active_energy = 0
          0x00,
          0x00,
          0x00,
          0x00, // total_reactive_energy = 0
        ])
      )

      const powerFactor = await driver.readDataPoint('power_factor')
      expect(powerFactor).toBe(0.0)
    })

    it('should handle power factor boundary value 1.000', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([
          0x08,
          0xfc, // voltage = 2300
          0x00,
          0x34, // current = 52
          0x01,
          0xf4, // frequency = 500
          0x04,
          0xa4, // active_power = 1188W
          0x00,
          0x00, // reactive_power = 0VAr
          0x04,
          0xa4, // apparent_power = 1188VA
          0x03,
          0xe8, // power_factor = 1000 (1.000)
          0x00,
          0x00,
          0x00,
          0x64, // total_active_energy = 100
          0x00,
          0x00,
          0x00,
          0x00, // total_reactive_energy = 0
        ])
      )

      const powerFactor = await driver.readDataPoint('power_factor')
      expect(powerFactor).toBe(1.0)
    })

    it('should handle maximum 32-bit energy values', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Maximum 32-bit value: 0xFFFFFFFF = 4294967295 ÷ 100 = 42949672.95
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([
          0x08,
          0xfc, // voltage = 2300
          0x00,
          0x34, // current = 52
          0x01,
          0xf4, // frequency = 500
          0x04,
          0xa4, // active_power = 1188W
          0x00,
          0x96, // reactive_power = 150VAr
          0x04,
          0xb5, // apparent_power = 1205VA
          0x03,
          0x52, // power_factor = 850
          0xff,
          0xff,
          0xff,
          0xff, // total_active_energy = max (42949672.95 kWh)
          0xff,
          0xff,
          0xff,
          0xff, // total_reactive_energy = max (42949672.95 kVArh)
        ])
      )

      const totalActiveEnergy = await driver.readDataPoint('total_active_energy')
      const totalReactiveEnergy = await driver.readDataPoint('total_reactive_energy')
      expect(totalActiveEnergy).toBe(42949672.95)
      expect(totalReactiveEnergy).toBe(42949672.95)
    })

    it('should read device address', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response: device_address = 52
      mockTransport.readHoldingRegisters.mockResolvedValue(Buffer.from([0x00, 0x34]))

      const address = await driver.readDataPoint('device_address')
      expect(address).toBe(52)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x002b, 1)
    })

    it('should read baud rate', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock response: baud_rate = 4 (9600 bps)
      mockTransport.readHoldingRegisters.mockResolvedValue(Buffer.from([0x00, 0x04]))

      const baudRate = await driver.readDataPoint('baud_rate')
      expect(baudRate).toBe(9600)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x002a, 1)
    })

    it('should decode all supported baud rates correctly', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      const baudRateTests = [
        { encoded: 1, decoded: 1200 },
        { encoded: 2, decoded: 2400 },
        { encoded: 3, decoded: 4800 },
        { encoded: 4, decoded: 9600 },
      ]

      for (const test of baudRateTests) {
        mockTransport.readHoldingRegisters.mockResolvedValue(Buffer.from([0x00, test.encoded]))
        const baudRate = await driver.readDataPoint('baud_rate')
        expect(baudRate).toBe(test.decoded)
      }
    })
  })

  describe('readDataPoints', () => {
    it('should read all data points together', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock complete response
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([
          0x08,
          0xfc, // voltage = 2300 (230.0V)
          0x00,
          0x34, // current = 52 (5.2A)
          0x01,
          0xf4, // frequency = 500 (50.0Hz)
          0x04,
          0xa4, // active_power = 1188W
          0x00,
          0x96, // reactive_power = 150VAr
          0x04,
          0xb5, // apparent_power = 1205VA
          0x03,
          0x52, // power_factor = 850 (0.850)
          0x00,
          0x01,
          0xe2,
          0x40, // total_active_energy = 123456 (1234.56kWh)
          0x00,
          0x01,
          0x81,
          0xcd, // total_reactive_energy = 98765 (987.65kVArh)
        ])
      )

      const values = await driver.readDataPoints([
        'voltage',
        'current',
        'frequency',
        'active_power',
        'reactive_power',
        'apparent_power',
        'power_factor',
        'total_active_energy',
        'total_reactive_energy',
      ])

      expect(values).toEqual({
        voltage: 230.0,
        current: 5.2,
        frequency: 50.0,
        active_power: 1188,
        reactive_power: 150,
        apparent_power: 1205,
        power_factor: 0.85,
        total_active_energy: 1234.56,
        total_reactive_energy: 987.65,
      })

      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledTimes(1)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x0000, 11)
    })

    it('should read subset of data points efficiently', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([
          0x08,
          0xfc, // voltage = 2300 (230.0V)
          0x00,
          0x34, // current = 52 (5.2A)
          0x01,
          0xf4, // frequency = 500 (50.0Hz)
          0x04,
          0xa4, // active_power = 1188W
          0x00,
          0x96, // reactive_power = 150VAr
          0x04,
          0xb5, // apparent_power = 1205VA
          0x03,
          0x52, // power_factor = 850 (0.850)
          0x00,
          0x01,
          0xe2,
          0x40, // total_active_energy = 123456 (1234.56kWh)
          0x00,
          0x01,
          0x81,
          0xcd, // total_reactive_energy = 98765 (987.65kVArh)
        ])
      )

      const values = await driver.readDataPoints(['voltage', 'current', 'active_power'])

      expect(values).toEqual({
        voltage: 230.0,
        current: 5.2,
        active_power: 1188,
      })

      // Should still read all registers in a single transaction
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledTimes(1)
    })

    it('should throw on invalid data point ID in batch read', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      mockTransport.readHoldingRegisters.mockResolvedValue(Buffer.alloc(22))

      await expect(driver.readDataPoints(['voltage', 'invalid'])).rejects.toThrow(
        'Unknown data point'
      )
    })

    it('should batch config registers when reading with measurements', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock measurement registers
      mockTransport.readHoldingRegisters.mockResolvedValueOnce(
        Buffer.from([
          0x08,
          0xfc, // voltage = 2300 (230.0V)
          0x00,
          0x34, // current = 52 (5.2A)
          0x01,
          0xf4, // frequency = 500 (50.0Hz)
          0x04,
          0xa4, // active_power = 1188W
          0x00,
          0x96, // reactive_power = 150VAr
          0x04,
          0xb5, // apparent_power = 1205VA
          0x03,
          0x52, // power_factor = 850 (0.850)
          0x00,
          0x01,
          0xe2,
          0x40, // total_active_energy = 123456 (1234.56kWh)
          0x00,
          0x01,
          0x81,
          0xcd, // total_reactive_energy = 98765 (987.65kVArh)
        ])
      )

      // Mock both config registers in single buffer
      mockTransport.readHoldingRegisters.mockResolvedValueOnce(
        Buffer.from([0x00, 0x04, 0x00, 0x01]) // baud_rate=4 (9600), device_address=1
      )

      const values = await driver.readDataPoints(['voltage', 'baud_rate', 'device_address'])

      expect(values).toEqual({
        voltage: 230.0,
        baud_rate: 9600,
        device_address: 1,
      })

      // Should use 2 transactions: 1 for measurements, 1 batched for both config registers
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledTimes(2)
      expect(mockTransport.readHoldingRegisters).toHaveBeenNthCalledWith(1, 0x0000, 11)
      expect(mockTransport.readHoldingRegisters).toHaveBeenNthCalledWith(2, 0x002a, 2)
    })

    it('should batch read both config registers in single transaction', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock both config registers in single buffer (baud_rate + device_address)
      mockTransport.readHoldingRegisters.mockResolvedValueOnce(
        Buffer.from([0x00, 0x04, 0x00, 0x34]) // baud_rate=4 (9600), device_address=52
      )

      const values = await driver.readDataPoints(['baud_rate', 'device_address'])

      expect(values).toEqual({
        baud_rate: 9600,
        device_address: 52,
      })

      // Should batch read both config registers in single transaction
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledTimes(1)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x002a, 2)
    })

    it('should read single config register individually', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock only baud_rate register
      mockTransport.readHoldingRegisters.mockResolvedValueOnce(Buffer.from([0x00, 0x03]))

      const values = await driver.readDataPoints(['baud_rate'])

      expect(values).toEqual({
        baud_rate: 4800,
      })

      // Should read single config register individually
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledTimes(1)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x002a, 1)
    })

    it('should throw on buffer too short', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock buffer with only 10 bytes (should be 22)
      mockTransport.readHoldingRegisters.mockResolvedValue(Buffer.alloc(10))

      await expect(driver.readDataPoint('voltage')).rejects.toThrow('Buffer too short')
    })
  })

  describe('writeDataPoint', () => {
    it('should throw error when attempting to write to read-only measurement data points', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await expect(driver.writeDataPoint('voltage', 230)).rejects.toThrow('read-only')
      await expect(driver.writeDataPoint('current', 5)).rejects.toThrow('read-only')
      await expect(driver.writeDataPoint('frequency', 50)).rejects.toThrow('read-only')
      await expect(driver.writeDataPoint('active_power', 1000)).rejects.toThrow('read-only')
      await expect(driver.writeDataPoint('reactive_power', 100)).rejects.toThrow('read-only')
      await expect(driver.writeDataPoint('apparent_power', 1000)).rejects.toThrow('read-only')
      await expect(driver.writeDataPoint('power_factor', 0.95)).rejects.toThrow('read-only')
      await expect(driver.writeDataPoint('total_active_energy', 1000)).rejects.toThrow('read-only')
      await expect(driver.writeDataPoint('total_reactive_energy', 500)).rejects.toThrow('read-only')
    })

    it('should write device address', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await driver.writeDataPoint('device_address', 52)

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(
        0x002b,
        Buffer.from([0x00, 0x34])
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

    it('should write baud rate', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await driver.writeDataPoint('baud_rate', 9600)

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(
        0x002a,
        Buffer.from([0x00, 0x04])
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

    it('should accept all supported baud rates', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      const validRates = [1200, 2400, 4800, 9600]

      for (const rate of validRates) {
        await driver.writeDataPoint('baud_rate', rate)
      }

      expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledTimes(validRates.length)
    })

    it('should encode baud rates correctly', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      const baudRateTests = [
        { rate: 1200, encoded: 0x01 },
        { rate: 2400, encoded: 0x02 },
        { rate: 4800, encoded: 0x03 },
        { rate: 9600, encoded: 0x04 },
      ]

      for (const test of baudRateTests) {
        await driver.writeDataPoint('baud_rate', test.rate)
        expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(
          0x002a,
          Buffer.from([0x00, test.encoded])
        )
      }
    })

    it('should reject non-finite values for device_address', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await expect(driver.writeDataPoint('device_address', NaN)).rejects.toThrow(
        'Invalid device address'
      )
      await expect(driver.writeDataPoint('device_address', Infinity)).rejects.toThrow(
        'Invalid device address'
      )
      await expect(driver.writeDataPoint('device_address', -Infinity)).rejects.toThrow(
        'Invalid device address'
      )
    })

    it('should reject non-integer values for device_address', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await expect(driver.writeDataPoint('device_address', 5.5)).rejects.toThrow(
        'Invalid device address: must be an integer between 1 and 247'
      )
    })
  })

  describe('readDataPoint - baud rate decoding', () => {
    it('should decode known baud rate values', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      const testCases = [
        { encoded: 0x01, decoded: 1200 },
        { encoded: 0x02, decoded: 2400 },
        { encoded: 0x03, decoded: 4800 },
        { encoded: 0x04, decoded: 9600 },
      ]

      for (const test of testCases) {
        mockTransport.readHoldingRegisters.mockResolvedValue(Buffer.from([0x00, test.encoded]))
        const value = await driver.readDataPoint('baud_rate')
        expect(value).toBe(test.decoded)
      }
    })

    it('should throw error for unknown baud rate encoding', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock unknown encoded value (e.g., 0x05)
      mockTransport.readHoldingRegisters.mockResolvedValue(Buffer.from([0x00, 0x05]))

      await expect(driver.readDataPoint('baud_rate')).rejects.toThrow(
        'Unknown baud rate encoding from device: 5'
      )
    })

    it('should throw error for unknown baud rate in batched read', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      // Mock both config registers with unknown baud rate encoding
      mockTransport.readHoldingRegisters.mockResolvedValue(
        Buffer.from([0x00, 0x05, 0x00, 0x01]) // baud_rate=5 (unknown), device_address=1
      )

      await expect(driver.readDataPoints(['baud_rate', 'device_address'])).rejects.toThrow(
        'Unknown baud rate encoding from device: 5'
      )
    })
  })
})
