import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'

import * as driverLoader from '../driver-loader/loader.js'
import * as jsonFormatter from '../formatters/json.js'
import * as perfFormatter from '../formatters/performance.js'
import * as tableFormatter from '../formatters/table.js'
import * as transportFactory from '../transport/factory.js'

import { readCommand } from './read.js'

jest.mock('../transport/factory.js')
jest.mock('../driver-loader/loader.js')
jest.mock('../formatters/table.js')
jest.mock('../formatters/json.js')
jest.mock('../formatters/performance.js')

describe('Read Command', () => {
  let mockTransport: jest.Mocked<Transport>
  let mockDriver: jest.Mocked<DeviceDriver>
  let mockCreateDriver: jest.MockedFunction<any>
  let consoleLogSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock console.log to capture output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()

    // Mock transport
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

    // Mock driver
    mockDriver = {
      name: 'Test Device',
      manufacturer: 'Test Corp',
      model: 'TEST-001',
      dataPoints: [
        {
          id: 'temperature',
          name: 'Temperature',
          type: 'float',
          unit: '°C',
          decimals: 1,
          access: 'r',
        },
        {
          id: 'humidity',
          name: 'Humidity',
          type: 'float',
          unit: '%',
          decimals: 1,
          access: 'r',
        },
      ],
      readDataPoint: jest.fn(),
      writeDataPoint: jest.fn(),
      readDataPoints: jest.fn(),
    }

    mockCreateDriver = jest.fn().mockResolvedValue(mockDriver)

    // Mock factory functions
    jest.spyOn(transportFactory, 'createTransport').mockResolvedValue(mockTransport)
    jest.spyOn(driverLoader, 'loadDriver').mockResolvedValue(mockCreateDriver)

    // Mock formatters
    jest.spyOn(tableFormatter, 'formatTable').mockReturnValue('TABLE OUTPUT')
    jest.spyOn(jsonFormatter, 'formatJSON').mockReturnValue('{"json": "output"}')
    jest.spyOn(perfFormatter, 'formatPerformance').mockReturnValue('PERF OUTPUT')
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  test('should read single data point with RTU connection', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: ['temperature'],
      format: 'table',
    }

    mockDriver.readDataPoint.mockResolvedValue(24.5)

    await readCommand(options)

    // Verify transport was created with correct config
    expect(transportFactory.createTransport).toHaveBeenCalledWith({
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
    })

    // Verify driver was loaded
    expect(driverLoader.loadDriver).toHaveBeenCalled()

    // Verify driver was created with transport
    expect(mockCreateDriver).toHaveBeenCalledWith({
      transport: mockTransport,
      slaveId: 1,
    })

    // Verify data point was read
    expect(mockDriver.readDataPoint).toHaveBeenCalledWith('temperature')

    // Verify table formatter was called
    expect(tableFormatter.formatTable).toHaveBeenCalled()

    // Verify output was printed
    expect(consoleLogSpy).toHaveBeenCalledWith('TABLE OUTPUT')
    expect(consoleLogSpy).toHaveBeenCalledWith('PERF OUTPUT')
  })

  test('should read multiple data points', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: ['temperature', 'humidity'],
      format: 'table',
    }

    mockDriver.readDataPoints.mockResolvedValue({
      temperature: 24.5,
      humidity: 65.2,
    })

    await readCommand(options)

    // Should use batch read for multiple data points
    expect(mockDriver.readDataPoints).toHaveBeenCalledWith(['temperature', 'humidity'])
    expect(mockDriver.readDataPoint).not.toHaveBeenCalled()
  })

  test('should read all data points when --all flag is used', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      all: true,
      format: 'table',
    }

    mockDriver.readDataPoints.mockResolvedValue({
      temperature: 24.5,
      humidity: 65.2,
    })

    await readCommand(options)

    // Should read all readable data points
    expect(mockDriver.readDataPoints).toHaveBeenCalledWith(['temperature', 'humidity'])
  })

  test('should skip write-only data points when reading all', async () => {
    mockDriver.dataPoints = [
      { id: 'temperature', type: 'float', access: 'r' },
      { id: 'setpoint', type: 'float', access: 'w' }, // Write-only
      { id: 'mode', type: 'integer', access: 'rw' },
    ]

    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      all: true,
      format: 'table',
    }

    mockDriver.readDataPoints.mockResolvedValue({
      temperature: 24.5,
      mode: 1,
    })

    await readCommand(options)

    // Should only read readable data points (not setpoint)
    expect(mockDriver.readDataPoints).toHaveBeenCalledWith(['temperature', 'mode'])
  })

  test('should use JSON format when specified', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: ['temperature'],
      format: 'json',
    }

    mockDriver.readDataPoint.mockResolvedValue(24.5)

    await readCommand(options)

    // Verify JSON formatter was called
    expect(jsonFormatter.formatJSON).toHaveBeenCalled()
    expect(tableFormatter.formatTable).not.toHaveBeenCalled()

    // Verify JSON output was printed
    expect(consoleLogSpy).toHaveBeenCalledWith('{"json": "output"}')
  })

  test('should use TCP connection when host is provided', async () => {
    const options = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
      dataPoint: ['temperature'],
      format: 'table',
    }

    mockDriver.readDataPoint.mockResolvedValue(24.5)

    await readCommand(options)

    // Verify TCP transport was created
    expect(transportFactory.createTransport).toHaveBeenCalledWith({
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    })
  })

  test('should load driver from explicit package', async () => {
    const options = {
      driver: 'ya-modbus-driver-xymd1',
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: ['temperature'],
      format: 'table',
    }

    mockDriver.readDataPoint.mockResolvedValue(24.5)

    await readCommand(options)

    // Verify driver loader was called with package name
    expect(driverLoader.loadDriver).toHaveBeenCalledWith({
      driverPackage: 'ya-modbus-driver-xymd1',
    })
  })

  test('should auto-detect local driver package', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: ['temperature'],
      format: 'table',
    }

    mockDriver.readDataPoint.mockResolvedValue(24.5)

    await readCommand(options)

    // Verify driver loader was called in local mode
    expect(driverLoader.loadDriver).toHaveBeenCalledWith({
      localPackage: true,
    })
  })

  test('should measure performance metrics', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: ['temperature'],
      format: 'table',
    }

    mockDriver.readDataPoint.mockResolvedValue(24.5)

    await readCommand(options)

    // Verify performance formatter was called with metrics
    expect(perfFormatter.formatPerformance).toHaveBeenCalledWith(
      expect.objectContaining({
        responseTimeMs: expect.any(Number),
        operations: 1,
        errors: 0,
      })
    )
  })

  test('should handle errors gracefully', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: ['temperature'],
      format: 'table',
    }

    mockDriver.readDataPoint.mockRejectedValue(new Error('Timeout'))

    await expect(readCommand(options)).rejects.toThrow('Timeout')
  })

  test('should throw error if data point does not exist', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: ['nonexistent'],
      format: 'table',
    }

    await expect(readCommand(options)).rejects.toThrow('Data point not found: nonexistent')
  })

  test('should throw error if data point is write-only', async () => {
    mockDriver.dataPoints = [{ id: 'setpoint', type: 'float', access: 'w' }]

    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: ['setpoint'],
      format: 'table',
    }

    await expect(readCommand(options)).rejects.toThrow('Data point is write-only: setpoint')
  })

  test('should use default baud rate and parity if not specified', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      dataPoint: ['temperature'],
      format: 'table',
    }

    mockDriver.readDataPoint.mockResolvedValue(24.5)

    await readCommand(options)

    // Verify defaults were applied
    expect(transportFactory.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        baudRate: 9600,
        parity: 'even',
        dataBits: 8,
        stopBits: 1,
      })
    )
  })

  test('should close transport connection after command completes', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: ['temperature'],
      format: 'table',
    }

    mockDriver.readDataPoint.mockResolvedValue(24.5)

    await readCommand(options)

    // Verify transport was closed to allow process to exit
    expect(mockTransport.close).toHaveBeenCalled()
  })

  test('should close transport even if command fails', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: ['temperature'],
      format: 'table',
    }

    mockDriver.readDataPoint.mockRejectedValue(new Error('Communication error'))

    await expect(readCommand(options)).rejects.toThrow('Communication error')

    // Verify transport was closed even on error
    expect(mockTransport.close).toHaveBeenCalled()
  })
})
