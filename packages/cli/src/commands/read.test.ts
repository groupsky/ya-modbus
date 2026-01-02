import type { DeviceDriver, Transport } from '@ya-modbus/driver-types'
import * as transportFactory from '@ya-modbus/transport'

import * as driverLoader from '../driver-loader/loader.js'

import { readCommand } from './read.js'

jest.mock('@ya-modbus/transport')
jest.mock('../driver-loader/loader.js')

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
    jest.spyOn(driverLoader, 'loadDriver').mockResolvedValue({
      createDriver: mockCreateDriver,
      defaultConfig: undefined,
      supportedConfig: undefined,
    })
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

    // Verify output contains the data (real formatters used)
    expect(consoleLogSpy).toHaveBeenCalled()
    const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('Temperature')
    expect(output).toContain('24.5')
    expect(output).toContain('Performance')
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

    // Verify JSON output was printed (real formatter used)
    expect(consoleLogSpy).toHaveBeenCalled()
    const output = consoleLogSpy.mock.calls[0]?.[0]
    expect(output).toBeDefined()
    // Should be valid JSON
    const parsed = JSON.parse(output as string)
    expect(parsed.dataPoints).toBeDefined()
    expect(parsed.dataPoints).toHaveLength(1)
    expect(parsed.dataPoints[0].id).toBe('temperature')
    expect(parsed.dataPoints[0].value).toBe(24.5)
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

    // Verify driver loader was called with auto-detection (empty options)
    expect(driverLoader.loadDriver).toHaveBeenCalledWith({})
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

    // Verify performance metrics are in output (real formatter used)
    const output = consoleLogSpy.mock.calls.map((call) => call[0]).join('\n')
    expect(output).toContain('Performance')
    expect(output).toContain('Response time')
    expect(output).toContain('Operations: 1')
    expect(output).toContain('Errors: 0')
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

  test('should throw error if neither --all nor --data-point is specified', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      format: 'table',
    }

    await expect(readCommand(options)).rejects.toThrow(
      'Either --data-point or --all must be specified'
    )
  })

  test('should throw error if dataPoint array is empty', async () => {
    const options = {
      port: '/dev/ttyUSB0',
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: [],
      format: 'table',
    }

    await expect(readCommand(options)).rejects.toThrow(
      'Either --data-point or --all must be specified'
    )
  })

  test('should use default TCP port 502 when not specified', async () => {
    const options = {
      host: '192.168.1.100',
      slaveId: 1,
      dataPoint: ['temperature'],
      format: 'table',
    }

    mockDriver.readDataPoint.mockResolvedValue(24.5)

    await readCommand(options)

    // Verify TCP transport was created with default port 502
    expect(transportFactory.createTransport).toHaveBeenCalledWith({
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    })
  })

  test('should use default RTU port when not specified', async () => {
    const options = {
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

    // Verify RTU transport was created with default port
    expect(transportFactory.createTransport).toHaveBeenCalledWith({
      port: '/dev/ttyUSB0',
      baudRate: 9600,
      dataBits: 8,
      parity: 'even',
      stopBits: 1,
      slaveId: 1,
    })
  })

  test('should format JSON with undefined connection when neither host nor port specified', async () => {
    const options = {
      slaveId: 1,
      baudRate: 9600,
      parity: 'even',
      dataBits: 8,
      stopBits: 1,
      dataPoint: ['temperature'],
      format: 'json' as const,
    }

    mockDriver.readDataPoint.mockResolvedValue(24.5)

    await readCommand(options)

    // Verify JSON output was called
    expect(consoleLogSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0])

    // Connection should be undefined when neither host nor port in options
    expect(output.connection).toBeUndefined()
    expect(output.dataPoints).toHaveLength(1)
    expect(output.dataPoints[0].value).toBe(24.5)
  })
})
