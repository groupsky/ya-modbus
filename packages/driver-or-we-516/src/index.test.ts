/**
 * Tests for ORNO OR-WE-516 3-Phase Energy Meter Driver
 */

import type { Transport } from '@ya-modbus/driver-types'

import { createDriver, DEFAULT_CONFIG, SUPPORTED_CONFIG } from './index'

/**
 * Single register integer data points (register offsets)
 */
const SINGLE_REGISTER_OFFSETS = new Set([0, 2, 3, 8, 13]) // serial_number, device_address, baud_rate, ct_rate, cycle_time

/**
 * Helper to create a buffer with IEEE 754 floats at specified register offsets
 */
function createRealtimeBuffer(values: Record<number, number>): Buffer {
  const buffer = Buffer.alloc(120) // 60 registers × 2 bytes
  for (const [registerOffset, value] of Object.entries(values)) {
    const offset = Number(registerOffset)
    if (SINGLE_REGISTER_OFFSETS.has(offset)) {
      // Single register values (serial, address, baud, ct_rate, cycle_time)
      buffer.writeUInt16BE(value, offset * 2)
    } else {
      // Float values
      buffer.writeFloatBE(value, offset * 2)
    }
  }
  return buffer
}

/**
 * Helper to create energy buffer with IEEE 754 floats
 */
function createEnergyBuffer(values: Record<number, number>): Buffer {
  const buffer = Buffer.alloc(96) // 48 registers × 2 bytes
  for (const [registerOffset, value] of Object.entries(values)) {
    buffer.writeFloatBE(value, Number(registerOffset) * 2)
  }
  return buffer
}

describe('Configuration Constants', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should export default device configuration', () => {
      expect(DEFAULT_CONFIG).toBeDefined()
      expect(DEFAULT_CONFIG.baudRate).toBe(9600)
      expect(DEFAULT_CONFIG.parity).toBe('odd')
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
      expect(SUPPORTED_CONFIG.validParity).toEqual(['odd'])
      expect(SUPPORTED_CONFIG.validDataBits).toEqual([8])
      expect(SUPPORTED_CONFIG.validStopBits).toEqual([1])
      expect(SUPPORTED_CONFIG.validAddressRange).toEqual([1, 247])
    })

    it('should include DEFAULT_CONFIG values in supported ranges', () => {
      expect(SUPPORTED_CONFIG.validBaudRates).toContain(DEFAULT_CONFIG.baudRate)
      expect(SUPPORTED_CONFIG.validParity).toContain(DEFAULT_CONFIG.parity)
      expect(SUPPORTED_CONFIG.validDataBits).toContain(DEFAULT_CONFIG.dataBits)
      expect(SUPPORTED_CONFIG.validStopBits).toContain(DEFAULT_CONFIG.stopBits)

      const [min, max] = SUPPORTED_CONFIG.validAddressRange
      expect(DEFAULT_CONFIG.defaultAddress).toBeGreaterThanOrEqual(min)
      expect(DEFAULT_CONFIG.defaultAddress).toBeLessThanOrEqual(max)
    })
  })
})

describe('OR-WE-516 Driver', () => {
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
      close: jest.fn(),
    }
  })

  describe('createDriver', () => {
    it('should create driver with correct metadata', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      expect(driver.name).toBe('OR-WE-516')
      expect(driver.manufacturer).toBe('ORNO')
      expect(driver.model).toBe('OR-WE-516')
    })

    it('should expose all data points', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      const dataPoints = driver.dataPoints
      expect(dataPoints.length).toBeGreaterThan(40)

      // Check some key data points exist
      const voltageL1 = dataPoints.find((dp) => dp.id === 'voltage_l1')
      expect(voltageL1).toBeDefined()
      expect(voltageL1?.type).toBe('float')
      expect(voltageL1?.unit).toBe('V')
      expect(voltageL1?.access).toBe('r')

      const activeEnergyTotal = dataPoints.find((dp) => dp.id === 'active_energy_total')
      expect(activeEnergyTotal).toBeDefined()
      expect(activeEnergyTotal?.type).toBe('float')
      expect(activeEnergyTotal?.unit).toBe('kWh')

      const deviceAddress = dataPoints.find((dp) => dp.id === 'device_address')
      expect(deviceAddress).toBeDefined()
      expect(deviceAddress?.access).toBe('rw')
    })
  })

  describe('readDataPoint', () => {
    describe('realtime data points', () => {
      it.each([
        { id: 'serial_number', registerOffset: 0, value: 12345 },
        { id: 'device_address', registerOffset: 2, value: 5 },
        { id: 'baud_rate', registerOffset: 3, value: 9600 },
        { id: 'ct_rate', registerOffset: 8, value: 1 },
        { id: 'cycle_time', registerOffset: 13, value: 100 },
      ])('should read integer $id', async ({ id, registerOffset, value }) => {
        const driver = await createDriver({
          transport: mockTransport,
          slaveId: 1,
        })

        const buffer = createRealtimeBuffer({ [registerOffset]: value })
        mockTransport.readHoldingRegisters.mockResolvedValue(buffer)

        const result = await driver.readDataPoint(id)

        expect(result).toBe(value)
        expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0, 60)
      })

      it.each([
        { id: 'software_version', registerOffset: 4, value: 1.23 },
        { id: 'hardware_version', registerOffset: 6, value: 2.0 },
        { id: 's0_output_rate', registerOffset: 9, value: 1000.0 },
        { id: 'voltage_l1', registerOffset: 14, value: 230.5 },
        { id: 'voltage_l2', registerOffset: 16, value: 231.2 },
        { id: 'voltage_l3', registerOffset: 18, value: 229.8 },
        { id: 'frequency', registerOffset: 20, value: 50.01 },
        { id: 'current_l1', registerOffset: 22, value: 5.123 },
        { id: 'current_l2', registerOffset: 24, value: 4.567 },
        { id: 'current_l3', registerOffset: 26, value: 6.789 },
        { id: 'active_power_total', registerOffset: 28, value: 3500.5 },
        { id: 'active_power_l1', registerOffset: 30, value: 1200.0 },
        { id: 'active_power_l2', registerOffset: 32, value: 1100.0 },
        { id: 'active_power_l3', registerOffset: 34, value: 1200.5 },
        { id: 'reactive_power_total', registerOffset: 36, value: 500.0 },
        { id: 'reactive_power_l1', registerOffset: 38, value: 166.7 },
        { id: 'reactive_power_l2', registerOffset: 40, value: 166.6 },
        { id: 'reactive_power_l3', registerOffset: 42, value: 166.7 },
        { id: 'apparent_power_total', registerOffset: 44, value: 3535.5 },
        { id: 'apparent_power_l1', registerOffset: 46, value: 1211.5 },
        { id: 'apparent_power_l2', registerOffset: 48, value: 1112.5 },
        { id: 'apparent_power_l3', registerOffset: 50, value: 1211.5 },
        { id: 'power_factor_total', registerOffset: 52, value: 0.99 },
        { id: 'power_factor_l1', registerOffset: 54, value: 0.991 },
        { id: 'power_factor_l2', registerOffset: 56, value: 0.989 },
        { id: 'power_factor_l3', registerOffset: 58, value: 0.992 },
      ])('should read float $id', async ({ id, registerOffset, value }) => {
        const driver = await createDriver({
          transport: mockTransport,
          slaveId: 1,
        })

        const buffer = createRealtimeBuffer({ [registerOffset]: value })
        mockTransport.readHoldingRegisters.mockResolvedValue(buffer)

        const result = await driver.readDataPoint(id)

        expect(result).toBeCloseTo(value, 2)
        expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0, 60)
      })
    })

    describe('energy data points', () => {
      it.each([
        { id: 'active_energy_total', registerOffset: 0, value: 12345.67 },
        { id: 'active_energy_l1', registerOffset: 2, value: 4115.22 },
        { id: 'active_energy_l2', registerOffset: 4, value: 4115.23 },
        { id: 'active_energy_l3', registerOffset: 6, value: 4115.22 },
        { id: 'active_energy_forward', registerOffset: 8, value: 10000.0 },
        { id: 'active_energy_forward_l1', registerOffset: 10, value: 3333.33 },
        { id: 'active_energy_forward_l2', registerOffset: 12, value: 3333.34 },
        { id: 'active_energy_forward_l3', registerOffset: 14, value: 3333.33 },
        { id: 'active_energy_reverse', registerOffset: 16, value: 2345.67 },
        { id: 'active_energy_reverse_l1', registerOffset: 18, value: 781.89 },
        { id: 'active_energy_reverse_l2', registerOffset: 20, value: 781.89 },
        { id: 'active_energy_reverse_l3', registerOffset: 22, value: 781.89 },
        { id: 'reactive_energy_total', registerOffset: 24, value: 1234.56 },
        { id: 'reactive_energy_l1', registerOffset: 26, value: 411.52 },
        { id: 'reactive_energy_l2', registerOffset: 28, value: 411.52 },
        { id: 'reactive_energy_l3', registerOffset: 30, value: 411.52 },
        { id: 'reactive_energy_forward', registerOffset: 32, value: 1000.0 },
        { id: 'reactive_energy_forward_l1', registerOffset: 34, value: 333.33 },
        { id: 'reactive_energy_forward_l2', registerOffset: 36, value: 333.34 },
        { id: 'reactive_energy_forward_l3', registerOffset: 38, value: 333.33 },
        { id: 'reactive_energy_reverse', registerOffset: 40, value: 234.56 },
        { id: 'reactive_energy_reverse_l1', registerOffset: 42, value: 78.19 },
        { id: 'reactive_energy_reverse_l2', registerOffset: 44, value: 78.18 },
        { id: 'reactive_energy_reverse_l3', registerOffset: 46, value: 78.19 },
      ])('should read $id', async ({ id, registerOffset, value }) => {
        const driver = await createDriver({
          transport: mockTransport,
          slaveId: 1,
        })

        const buffer = createEnergyBuffer({ [registerOffset]: value })
        mockTransport.readHoldingRegisters.mockResolvedValue(buffer)

        const result = await driver.readDataPoint(id)

        expect(result).toBeCloseTo(value, 2)
        expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x100, 48)
      })
    })

    describe('edge cases', () => {
      it('should read zero values correctly', async () => {
        const driver = await createDriver({
          transport: mockTransport,
          slaveId: 1,
        })

        const buffer = createRealtimeBuffer({
          22: 0.0, // current_l1 = 0
          28: 0.0, // active_power_total = 0
        })
        mockTransport.readHoldingRegisters.mockResolvedValue(buffer)

        const current = await driver.readDataPoint('current_l1')
        const power = await driver.readDataPoint('active_power_total')

        expect(current).toBe(0)
        expect(power).toBe(0)
      })

      it('should read negative power factor (leading)', async () => {
        const driver = await createDriver({
          transport: mockTransport,
          slaveId: 1,
        })

        // Negative power factor indicates leading power factor (capacitive load)
        const buffer = createRealtimeBuffer({
          52: -0.85, // power_factor_total
        })
        mockTransport.readHoldingRegisters.mockResolvedValue(buffer)

        const result = await driver.readDataPoint('power_factor_total')

        expect(result).toBeCloseTo(-0.85, 2)
      })

      it('should read negative power values (reverse flow)', async () => {
        const driver = await createDriver({
          transport: mockTransport,
          slaveId: 1,
        })

        // Negative power indicates reverse flow (export)
        const buffer = createRealtimeBuffer({
          28: -1500.5, // active_power_total
          36: -250.0, // reactive_power_total
        })
        mockTransport.readHoldingRegisters.mockResolvedValue(buffer)

        const activePower = await driver.readDataPoint('active_power_total')
        const reactivePower = await driver.readDataPoint('reactive_power_total')

        expect(activePower).toBeCloseTo(-1500.5, 1)
        expect(reactivePower).toBeCloseTo(-250.0, 1)
      })
    })

    it('should throw on unknown data point', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      await expect(driver.readDataPoint('unknown_point')).rejects.toThrow('Unknown data point')
    })
  })

  describe('readDataPoints', () => {
    it('should read multiple realtime data points in single request', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      const buffer = createRealtimeBuffer({
        14: 230.5, // voltage_l1
        16: 231.2, // voltage_l2
        18: 229.8, // voltage_l3
      })
      mockTransport.readHoldingRegisters.mockResolvedValue(buffer)

      const result = await driver.readDataPoints(['voltage_l1', 'voltage_l2', 'voltage_l3'])

      expect(result['voltage_l1']).toBeCloseTo(230.5, 1)
      expect(result['voltage_l2']).toBeCloseTo(231.2, 1)
      expect(result['voltage_l3']).toBeCloseTo(229.8, 1)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledTimes(1)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0, 60)
    })

    it('should read multiple energy data points in single request', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      const buffer = createEnergyBuffer({
        0: 12345.67, // active_energy_total
        8: 10000.0, // active_energy_forward
        16: 2345.67, // active_energy_reverse
      })
      mockTransport.readHoldingRegisters.mockResolvedValue(buffer)

      const result = await driver.readDataPoints([
        'active_energy_total',
        'active_energy_forward',
        'active_energy_reverse',
      ])

      expect(result['active_energy_total']).toBeCloseTo(12345.67, 1)
      expect(result['active_energy_forward']).toBeCloseTo(10000.0, 1)
      expect(result['active_energy_reverse']).toBeCloseTo(2345.67, 1)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledTimes(1)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x100, 48)
    })

    it('should read both realtime and energy data points', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      const realtimeBuffer = createRealtimeBuffer({ 14: 230.5 })
      const energyBuffer = createEnergyBuffer({ 0: 12345.67 })

      mockTransport.readHoldingRegisters
        .mockResolvedValueOnce(realtimeBuffer)
        .mockResolvedValueOnce(energyBuffer)

      const result = await driver.readDataPoints(['voltage_l1', 'active_energy_total'])

      expect(result['voltage_l1']).toBeCloseTo(230.5, 1)
      expect(result['active_energy_total']).toBeCloseTo(12345.67, 1)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledTimes(2)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0, 60)
      expect(mockTransport.readHoldingRegisters).toHaveBeenCalledWith(0x100, 48)
    })

    it('should throw on unknown data points', async () => {
      const driver = await createDriver({
        transport: mockTransport,
        slaveId: 1,
      })

      const buffer = createRealtimeBuffer({ 14: 230.5 })
      mockTransport.readHoldingRegisters.mockResolvedValue(buffer)

      await expect(driver.readDataPoints(['voltage_l1', 'unknown_point'])).rejects.toThrow(
        'Unknown data points: unknown_point'
      )
    })
  })

  describe('writeDataPoint', () => {
    describe('device_address', () => {
      it('should write valid device address', async () => {
        const driver = await createDriver({
          transport: mockTransport,
          slaveId: 1,
        })

        await driver.writeDataPoint('device_address', 5)

        expect(mockTransport.writeSingleRegister).toHaveBeenCalledWith(2, 5)
      })

      it.each([1, 247])('should accept boundary address %d', async (address) => {
        const driver = await createDriver({
          transport: mockTransport,
          slaveId: 1,
        })

        await driver.writeDataPoint('device_address', address)

        expect(mockTransport.writeSingleRegister).toHaveBeenCalledWith(2, address)
      })

      it.each([0, 248, -1, 1.5, NaN, 'invalid'])(
        'should reject invalid address %p',
        async (address) => {
          const driver = await createDriver({
            transport: mockTransport,
            slaveId: 1,
          })

          await expect(driver.writeDataPoint('device_address', address)).rejects.toThrow(
            'Invalid device address'
          )
        }
      )
    })

    describe('baud_rate', () => {
      it.each([1200, 2400, 4800, 9600])('should write valid baud rate %d', async (baudRate) => {
        const driver = await createDriver({
          transport: mockTransport,
          slaveId: 1,
        })

        await driver.writeDataPoint('baud_rate', baudRate)

        expect(mockTransport.writeSingleRegister).toHaveBeenCalledWith(3, baudRate)
      })

      it.each([1234, 19200, 'invalid', NaN])('should reject invalid baud rate %p', async (rate) => {
        const driver = await createDriver({
          transport: mockTransport,
          slaveId: 1,
        })

        await expect(driver.writeDataPoint('baud_rate', rate)).rejects.toThrow('Invalid baud rate')
      })
    })

    describe('s0_output_rate', () => {
      it('should write valid S0 output rate', async () => {
        const driver = await createDriver({
          transport: mockTransport,
          slaveId: 1,
        })

        await driver.writeDataPoint('s0_output_rate', 1000.0)

        expect(mockTransport.writeMultipleRegisters).toHaveBeenCalledWith(
          0x0009,
          expect.any(Buffer)
        )

        const writtenBuffer = mockTransport.writeMultipleRegisters.mock.calls[0][1]
        expect(writtenBuffer.readFloatBE(0)).toBeCloseTo(1000.0, 1)
      })

      it.each([NaN, Infinity, -Infinity, 'invalid'])(
        'should reject invalid S0 output rate %p',
        async (value) => {
          const driver = await createDriver({
            transport: mockTransport,
            slaveId: 1,
          })

          await expect(driver.writeDataPoint('s0_output_rate', value)).rejects.toThrow(
            'Invalid S0 output rate'
          )
        }
      )
    })

    describe('cycle_time', () => {
      it('should write valid cycle time', async () => {
        const driver = await createDriver({
          transport: mockTransport,
          slaveId: 1,
        })

        await driver.writeDataPoint('cycle_time', 100)

        expect(mockTransport.writeSingleRegister).toHaveBeenCalledWith(0x000d, 100)
      })

      it.each([0, 65535])('should accept boundary cycle time %d', async (value) => {
        const driver = await createDriver({
          transport: mockTransport,
          slaveId: 1,
        })

        await driver.writeDataPoint('cycle_time', value)

        expect(mockTransport.writeSingleRegister).toHaveBeenCalledWith(0x000d, value)
      })

      it.each([-1, 65536, 1.5, NaN, 'invalid'])(
        'should reject invalid cycle time %p',
        async (value) => {
          const driver = await createDriver({
            transport: mockTransport,
            slaveId: 1,
          })

          await expect(driver.writeDataPoint('cycle_time', value)).rejects.toThrow(
            'Invalid cycle time'
          )
        }
      )
    })

    describe('read-only data points', () => {
      it.each([
        'serial_number',
        'voltage_l1',
        'current_l1',
        'active_power_total',
        'active_energy_total',
        'frequency',
        'power_factor_total',
      ])('should reject writing to read-only data point %s', async (dataPoint) => {
        const driver = await createDriver({
          transport: mockTransport,
          slaveId: 1,
        })

        await expect(driver.writeDataPoint(dataPoint, 123)).rejects.toThrow('read-only')
      })
    })
  })
})
