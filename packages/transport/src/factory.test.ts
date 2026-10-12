import { createTransport } from './factory.js'
import * as rtuTransport from './rtu-transport.js'
import * as tcpTransport from './tcp-transport.js'

jest.mock('./rtu-transport.js')
jest.mock('./tcp-transport.js')

describe('Transport Factory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('should create RTU transport for /dev/ port paths', async () => {
    const mockRTUTransport = {} as any
    jest.spyOn(rtuTransport, 'createRTUTransport').mockResolvedValue(mockRTUTransport)

    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
    }

    const transport = await createTransport(config)

    expect(rtuTransport.createRTUTransport).toHaveBeenCalledWith(config)
    expect(transport).toBe(mockRTUTransport)
  })

  test('should create RTU transport for COM port paths', async () => {
    const mockRTUTransport = {} as any
    jest.spyOn(rtuTransport, 'createRTUTransport').mockResolvedValue(mockRTUTransport)

    const config = {
      port: 'COM3',
      baudRate: 19200 as const,
      dataBits: 8 as const,
      parity: 'none' as const,
      stopBits: 1 as const,
      slaveId: 5,
    }

    const transport = await createTransport(config)

    expect(rtuTransport.createRTUTransport).toHaveBeenCalledWith(config)
    expect(transport).toBe(mockRTUTransport)
  })

  test('should create TCP transport when host is provided', async () => {
    const mockTCPTransport = {} as any
    jest.spyOn(tcpTransport, 'createTCPTransport').mockResolvedValue(mockTCPTransport)

    const config = {
      host: '192.168.1.100',
      slaveId: 1,
    }

    const transport = await createTransport(config)

    expect(tcpTransport.createTCPTransport).toHaveBeenCalledWith(config)
    expect(transport).toBe(mockTCPTransport)
  })

  test('should create TCP transport with default port', async () => {
    const mockTCPTransport = {} as any
    jest.spyOn(tcpTransport, 'createTCPTransport').mockResolvedValue(mockTCPTransport)

    const config = {
      host: 'modbus.example.com',
      slaveId: 10,
    }

    const transport = await createTransport(config)

    expect(tcpTransport.createTCPTransport).toHaveBeenCalledWith(config)
    expect(transport).toBe(mockTCPTransport)
  })

  // Regression: the TCP config carries the TCP port number in `port`. The factory used to
  // reject every config containing both `port` and `host`, so no TCP transport could be
  // created with an explicit port (CLI read/write, device-profiler).
  test('should create TCP transport when host is provided with a numeric port', async () => {
    const mockTCPTransport = {} as any
    jest.spyOn(tcpTransport, 'createTCPTransport').mockResolvedValue(mockTCPTransport)

    const config = {
      host: '192.168.1.100',
      port: 5020,
      slaveId: 1,
      timeout: 2000,
    }

    const transport = await createTransport(config)

    expect(tcpTransport.createTCPTransport).toHaveBeenCalledWith(config)
    expect(rtuTransport.createRTUTransport).not.toHaveBeenCalled()
    expect(transport).toBe(mockTCPTransport)
  })

  test('should create TCP transport when the port is explicitly undefined', async () => {
    const mockTCPTransport = {} as any
    jest.spyOn(tcpTransport, 'createTCPTransport').mockResolvedValue(mockTCPTransport)

    const config = {
      host: '192.168.1.100',
      port: undefined,
      slaveId: 1,
    }

    const transport = await createTransport(config)

    expect(tcpTransport.createTCPTransport).toHaveBeenCalledWith(config)
    expect(transport).toBe(mockTCPTransport)
  })

  test('should throw error if neither port nor host is provided', async () => {
    const config = {
      slaveId: 1,
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
    } as any

    await expect(createTransport(config)).rejects.toThrow(
      'Either port (for RTU) or host (for TCP) must be specified'
    )
  })

  test('should throw error if both a serial port path and host are provided', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      host: '192.168.1.100',
      slaveId: 1,
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
    } as any

    await expect(createTransport(config)).rejects.toThrow(
      'Cannot specify both port (RTU) and host (TCP)'
    )
    expect(rtuTransport.createRTUTransport).not.toHaveBeenCalled()
    expect(tcpTransport.createTCPTransport).not.toHaveBeenCalled()
  })
})
