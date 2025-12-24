import readline from 'readline/promises'

import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'

import * as driverLoader from '../driver-loader/loader.js'
import * as transportFactory from '../transport/factory.js'

import { writeCommand } from './write.js'

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
      close: jest.fn().mockResolvedValue(undefined),
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
        {
          id: 'device_address',
          name: 'Device Address',
          type: 'integer',
          access: 'rw',
          min: 1,
          max: 247,
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

  test('should parse string values', async () => {
    mockDriver.dataPoints = [
      {
        id: 'device_name',
        type: 'string',
        access: 'rw',
      },
    ]

    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'device_name',
      value: 'My Device',
      yes: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    await writeCommand(options)

    expect(mockDriver.writeDataPoint).toHaveBeenCalledWith('device_name', 'My Device')
  })

  test('should parse enum values as numbers', async () => {
    mockDriver.dataPoints = [
      {
        id: 'mode',
        type: 'enum',
        access: 'rw',
        enumValues: {
          0: 'Off',
          1: 'On',
          2: 'Auto',
        },
      },
    ]

    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'mode',
      value: '2',
      yes: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    await writeCommand(options)

    expect(mockDriver.writeDataPoint).toHaveBeenCalledWith('mode', 2)
  })

  test('should parse enum values as strings', async () => {
    mockDriver.dataPoints = [
      {
        id: 'mode',
        type: 'enum',
        access: 'rw',
        enumValues: {
          off: 'Off',
          on: 'On',
        },
      },
    ]

    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'mode',
      value: 'on',
      yes: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    await writeCommand(options)

    expect(mockDriver.writeDataPoint).toHaveBeenCalledWith('mode', 'on')
  })

  test('should validate min value constraint', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'setpoint',
      value: '-10',
      yes: true,
    }

    await expect(writeCommand(options)).rejects.toThrow('Value -10 is outside valid range')
  })

  test('should validate enum value constraint', async () => {
    mockDriver.dataPoints = [
      {
        id: 'mode',
        type: 'enum',
        access: 'rw',
        enumValues: {
          0: 'Off',
          1: 'On',
        },
      },
    ]

    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'mode',
      value: '99',
      yes: true,
    }

    await expect(writeCommand(options)).rejects.toThrow('Invalid enum value: 99')
  })

  test('should handle error when reading current value', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'setpoint',
      value: '25.0',
      yes: false,
    }

    mockDriver.readDataPoint.mockRejectedValue(new Error('Read timeout'))

    const mockQuestion = jest.fn().mockResolvedValue('y')
    ;(readline.createInterface as jest.Mock).mockReturnValue({
      question: mockQuestion,
      close: jest.fn(),
    })

    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    await writeCommand(options)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not read current value')
    )
    expect(mockDriver.writeDataPoint).toHaveBeenCalledWith('setpoint', 25.0)
  })

  test('should handle verification of write-only data point', async () => {
    mockDriver.dataPoints = [
      {
        id: 'command',
        type: 'integer',
        access: 'w',
      },
    ]

    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'command',
      value: '5',
      yes: true,
      verify: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    await writeCommand(options)

    expect(mockDriver.writeDataPoint).toHaveBeenCalledWith('command', 5)
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot verify write-only data point')
    )
  })

  test('should handle verification read error', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'setpoint',
      value: '25.0',
      yes: true,
      verify: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)
    mockDriver.readDataPoint.mockRejectedValue(new Error('Verification read failed'))

    await writeCommand(options)

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Verification failed: Verification read failed')
    )
  })

  test('should handle unknown data point type in parseValue', async () => {
    mockDriver.dataPoints = [
      {
        id: 'custom',
        type: 'unknown' as any,
        access: 'rw',
      },
    ]

    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'custom',
      value: 'custom-value',
      yes: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    await writeCommand(options)

    expect(mockDriver.writeDataPoint).toHaveBeenCalledWith('custom', 'custom-value')
  })

  test('should parse boolean value as 1', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'enabled',
      value: '1',
      yes: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    await writeCommand(options)

    expect(mockDriver.writeDataPoint).toHaveBeenCalledWith('enabled', true)
  })

  test('should parse boolean value as false', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'enabled',
      value: 'false',
      yes: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    await writeCommand(options)

    expect(mockDriver.writeDataPoint).toHaveBeenCalledWith('enabled', false)
  })

  test('should handle data point with no access field (defaults to r)', async () => {
    mockDriver.dataPoints = [
      {
        id: 'readonly',
        type: 'float',
      } as any,
    ]

    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'readonly',
      value: '25.0',
      yes: true,
    }

    await expect(writeCommand(options)).rejects.toThrow('Data point is read-only: readonly')
  })

  test('should handle data point with w access', async () => {
    mockDriver.dataPoints = [
      {
        id: 'writeonly',
        type: 'integer',
        access: 'w',
      },
    ]

    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'writeonly',
      value: '42',
      yes: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    await writeCommand(options)

    expect(mockDriver.writeDataPoint).toHaveBeenCalledWith('writeonly', 42)
  })

  test('should use default TCP port 502 when host is provided without port', async () => {
    const options = {
      host: '192.168.1.100',
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
  })

  test('should use default RTU parameters when not specified', async () => {
    const options = {
      slaveId: 1,
      dataPoint: 'setpoint',
      value: '25.0',
      yes: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    await writeCommand(options)

    expect(transportFactory.createTransport).toHaveBeenCalledWith({
      port: '/dev/ttyUSB0',
      baudRate: 9600,
      dataBits: 8,
      parity: 'even',
      stopBits: 1,
      slaveId: 1,
    })
  })

  test('should verify float values with relative error tolerance for small values', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'setpoint',
      value: '0.001',
      yes: true,
      verify: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)
    // Simulate small floating point error (0.0000001 difference)
    mockDriver.readDataPoint.mockResolvedValue(0.0010000001)

    await writeCommand(options)

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Verification: OK'))
  })

  test('should verify float values with relative error tolerance for large values', async () => {
    // Add a data point without max constraint for testing large values
    mockDriver.dataPoints = [
      ...mockDriver.dataPoints,
      {
        id: 'large_value',
        type: 'float',
        access: 'rw',
        decimals: 1,
      },
    ]

    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'large_value',
      value: '10000.0',
      yes: true,
      verify: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)
    // Simulate small relative error (0.0001% difference, within 1e-6 tolerance)
    mockDriver.readDataPoint.mockResolvedValue(10000.01)

    await writeCommand(options)

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Verification: OK'))
  })

  test('should detect verification mismatch for float values with large relative error', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'setpoint',
      value: '25.0',
      yes: true,
      verify: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)
    // Large difference (20% error)
    mockDriver.readDataPoint.mockResolvedValue(30.0)

    await writeCommand(options)

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('MISMATCH'))
  })

  test('should verify float values near zero with absolute error tolerance', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'setpoint',
      value: '0.0',
      yes: true,
      verify: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)
    // Very small absolute value (within absolute epsilon)
    mockDriver.readDataPoint.mockResolvedValue(1e-10)

    await writeCommand(options)

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Verification: OK'))
  })

  test('should handle write-only data point in confirmation flow (no current value)', async () => {
    mockDriver.dataPoints = [
      {
        id: 'writeonly',
        type: 'integer',
        access: 'w',
      },
    ]

    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'writeonly',
      value: '100',
      yes: false,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)

    // Mock user confirmation
    const mockQuestion = jest.fn().mockResolvedValue('y')
    const mockClose = jest.fn()
    const readlineModule = jest.requireMock('readline/promises')
    readlineModule.createInterface.mockReturnValue({
      question: mockQuestion,
      close: mockClose,
    })

    await writeCommand(options)

    expect(mockDriver.writeDataPoint).toHaveBeenCalledWith('writeonly', 100)
    // Should not attempt to read current value for write-only data point
    expect(mockDriver.readDataPoint).not.toHaveBeenCalled()
  })

  test('should verify integer values with strict equality', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'device_address',
      value: '10',
      yes: true,
      verify: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)
    mockDriver.readDataPoint.mockResolvedValue(10)

    await writeCommand(options)

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Verification: OK'))
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('read back 10'))
  })

  test('should detect integer verification mismatch', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: 'device_address',
      value: '10',
      yes: true,
      verify: true,
    }

    mockDriver.writeDataPoint.mockResolvedValue(undefined)
    mockDriver.readDataPoint.mockResolvedValue(15) // Different value

    await writeCommand(options)

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('MISMATCH'))
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('expected 10'))
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('got 15'))
  })
})
