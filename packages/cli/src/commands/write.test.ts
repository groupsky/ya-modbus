import { writeCommand } from './write.js'
import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'
import * as transportFactory from '../transport/factory.js'
import * as driverLoader from '../driver-loader/loader.js'
import readline from 'readline/promises'

jest.mock('../transport/factory.js')
jest.mock('../driver-loader/loader.js')
jest.mock('readline/promises')

describe('Write Command', () => {
  let mockTransport: jest.Mocked<Transport>
  let mockDriver: jest.Mocked<DeviceDriver>
  let mockCreateDriver: jest.MockedFunction<any>
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()

    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

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

    mockDriver = {
      name: 'Test Device',
      manufacturer: 'Test Corp',
      model: 'TEST-001',
      dataPoints: [
        {
          id: 'setpoint',
          name: 'Setpoint Temperature',
          type: 'float',
          unit: '°C',
          decimals: 1,
          access: 'rw',
          min: 0,
          max: 100,
        },
        {
          id: 'enabled',
          name: 'Enabled',
          type: 'boolean',
          access: 'rw',
        },
        {
          id: 'temperature',
          name: 'Current Temperature',
          type: 'float',
          unit: '°C',
          access: 'r', // Read-only
        },
      ],
      readDataPoint: jest.fn(),
      writeDataPoint: jest.fn(),
      readDataPoints: jest.fn(),
    }

    mockCreateDriver = jest.fn().mockResolvedValue(mockDriver)

    jest.spyOn(transportFactory, 'createTransport').mockResolvedValue(mockTransport)
    jest.spyOn(driverLoader, 'loadDriver').mockResolvedValue(mockCreateDriver)
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  test('should write data point value with confirmation', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: 'setpoint',
      value: '25.5',
      yes: false,
    }

    mockDriver.readDataPoint.mockResolvedValue(20.0)
    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    // Mock user confirmation
    const mockQuestion = jest.fn().mockResolvedValue('y')
    ;(readline.createInterface as jest.Mock).mockReturnValue({
      question: mockQuestion,
      close: jest.fn(),
    })

    await writeCommand(options)

    // Verify current value was read
    expect(mockDriver.readDataPoint).toHaveBeenCalledWith('setpoint')

    // Verify confirmation was requested
    expect(mockQuestion).toHaveBeenCalled()

    // Verify value was written
    expect(mockDriver.writeDataPoint).toHaveBeenCalledWith('setpoint', 25.5)

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully wrote'))
  })

  test('should skip confirmation with --yes flag', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: 'setpoint',
      value: '30.0',
      yes: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    const mockQuestion = jest.fn()
    ;(readline.createInterface as jest.Mock).mockReturnValue({
      question: mockQuestion,
      close: jest.fn(),
    })

    await writeCommand(options)

    // Verify no confirmation was requested
    expect(mockQuestion).not.toHaveBeenCalled()

    // Verify value was written
    expect(mockDriver.writeDataPoint).toHaveBeenCalledWith('setpoint', 30.0)
  })

  test('should abort write if user declines confirmation', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: 'setpoint',
      value: '25.5',
      yes: false,
    }

    mockDriver.readDataPoint.mockResolvedValue(20.0)

    // Mock user declining
    const mockQuestion = jest.fn().mockResolvedValue('n')
    ;(readline.createInterface as jest.Mock).mockReturnValue({
      question: mockQuestion,
      close: jest.fn(),
    })

    await writeCommand(options)

    // Verify value was NOT written
    expect(mockDriver.writeDataPoint).not.toHaveBeenCalled()

    expect(consoleLogSpy).toHaveBeenCalledWith('Write aborted')
  })

  test('should verify written value if --verify flag is used', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: 'setpoint',
      value: '25.5',
      yes: true,
      verify: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)
    mockDriver.readDataPoint.mockResolvedValue(25.5)

    await writeCommand(options)

    // Verify read was called after write
    expect(mockDriver.readDataPoint).toHaveBeenCalledWith('setpoint')

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Verification: OK'))
  })

  test('should warn if verification fails', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: 'setpoint',
      value: '25.5',
      yes: true,
      verify: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)
    mockDriver.readDataPoint.mockResolvedValue(20.0) // Different value

    await writeCommand(options)

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('MISMATCH'))
  })

  test('should write boolean values', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: 'enabled',
      value: 'true',
      yes: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    await writeCommand(options)

    expect(mockDriver.writeDataPoint).toHaveBeenCalledWith('enabled', true)
  })

  test('should throw error if data point does not exist', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: 'nonexistent',
      value: '100',
      yes: true,
    }

    await expect(writeCommand(options)).rejects.toThrow('Data point not found: nonexistent')
  })

  test('should throw error if data point is read-only', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: 'temperature',
      value: '25.0',
      yes: true,
    }

    await expect(writeCommand(options)).rejects.toThrow('Data point is read-only: temperature')
  })

  test('should validate value is within min/max range', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: 'setpoint',
      value: '150',
      yes: true,
    }

    await expect(writeCommand(options)).rejects.toThrow('Value 150 is outside valid range')
  })

  test('should parse integer values', async () => {
    mockDriver.dataPoints = [
      {
        id: 'count',
        type: 'integer',
        access: 'rw',
      },
    ]

    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: 'count',
      value: '42',
      yes: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    await writeCommand(options)

    expect(mockDriver.writeDataPoint).toHaveBeenCalledWith('count', 42)
  })

  test('should handle TCP connection', async () => {
    const options = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
      dataPoint: 'setpoint',
      value: '25.0',
      yes: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    await writeCommand(options)

    expect(transportFactory.createTransport).toHaveBeenCalledWith({
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    })

    expect(mockDriver.writeDataPoint).toHaveBeenCalledWith('setpoint', 25.0)
  })
})
