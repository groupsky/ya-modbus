import type ModbusRTU from 'modbus-serial'

import { createTCPTransport } from './tcp-transport.js'

// Mock modbus-serial
jest.mock('modbus-serial')

describe('TCP Transport', () => {
  let mockModbus: jest.Mocked<ModbusRTU>

  beforeEach(async () => {
    jest.clearAllMocks()

    mockModbus = {
      connectTCP: jest.fn(),
      setID: jest.fn(),
      setTimeout: jest.fn(),
      readHoldingRegisters: jest.fn(),
      readInputRegisters: jest.fn(),
      readCoils: jest.fn(),
      readDiscreteInputs: jest.fn(),
      writeRegister: jest.fn(),
      writeRegisters: jest.fn(),
      writeCoil: jest.fn(),
      writeCoils: jest.fn(),
      close: jest.fn(),
      isOpen: false,
    } as unknown as jest.Mocked<ModbusRTU>

    const ModbusRTUConstructor = await import('modbus-serial')
    ;(ModbusRTUConstructor as any).default.mockImplementation(() => mockModbus)
  })

  test('should create TCP transport with correct configuration', async () => {
    const config = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
      timeout: 2000,
    }

    mockModbus.connectTCP.mockResolvedValue(undefined)

    const transport = await createTCPTransport(config)

    expect(mockModbus.connectTCP).toHaveBeenCalledWith('192.168.1.100', { port: 502 })
    expect(mockModbus.setID).toHaveBeenCalledWith(1)
    expect(mockModbus.setTimeout).toHaveBeenCalledWith(2000)
    expect(transport).toBeDefined()
  })

  test('should use default port 502 if not specified', async () => {
    const config = {
      host: '192.168.1.100',
      slaveId: 1,
    }

    mockModbus.connectTCP.mockResolvedValue(undefined)

    await createTCPTransport(config)

    expect(mockModbus.connectTCP).toHaveBeenCalledWith('192.168.1.100', { port: 502 })
  })

  test('should use default timeout if not specified', async () => {
    const config = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    }

    mockModbus.connectTCP.mockResolvedValue(undefined)

    await createTCPTransport(config)

    expect(mockModbus.setTimeout).toHaveBeenCalledWith(1000)
  })

  test('should read holding registers and return buffer', async () => {
    const config = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    }

    mockModbus.connectTCP.mockResolvedValue(undefined)
    mockModbus.readHoldingRegisters.mockResolvedValue({
      data: [0x1234, 0x5678],
      buffer: Buffer.from([0x12, 0x34, 0x56, 0x78]),
    } as never)

    const transport = await createTCPTransport(config)
    const result = await transport.readHoldingRegisters(100, 2)

    expect(mockModbus.readHoldingRegisters).toHaveBeenCalledWith(100, 2)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(4)
  })

  test('should write multiple registers', async () => {
    const config = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    }

    mockModbus.connectTCP.mockResolvedValue(undefined)
    mockModbus.writeRegisters.mockResolvedValue({} as never)

    const transport = await createTCPTransport(config)
    const values = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd])
    await transport.writeMultipleRegisters(200, values)

    expect(mockModbus.writeRegisters).toHaveBeenCalledWith(200, values)
  })

  test('should retry on transient failures', async () => {
    const config = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    }

    mockModbus.connectTCP.mockResolvedValue(undefined)

    mockModbus.readHoldingRegisters
      .mockRejectedValueOnce(new Error('Connection reset'))
      .mockRejectedValueOnce(new Error('Connection reset'))
      .mockResolvedValueOnce({
        data: [0x1111],
        buffer: Buffer.from([0x11, 0x11]),
      } as never)

    const transport = await createTCPTransport(config)
    const result = await transport.readHoldingRegisters(0, 1)

    expect(mockModbus.readHoldingRegisters).toHaveBeenCalledTimes(3)
    expect(result).toBeInstanceOf(Buffer)
  })

  test('should throw after max retries exceeded', async () => {
    const config = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    }

    mockModbus.connectTCP.mockResolvedValue(undefined)
    mockModbus.readInputRegisters.mockRejectedValue(new Error('Network unreachable'))

    const transport = await createTCPTransport(config)

    await expect(transport.readInputRegisters(0, 1)).rejects.toThrow('Network unreachable')
    expect(mockModbus.readInputRegisters).toHaveBeenCalledTimes(3)
  })

  test('should read input registers and return buffer', async () => {
    const config = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    }

    mockModbus.connectTCP.mockResolvedValue(undefined)
    mockModbus.readInputRegisters.mockResolvedValue({
      data: [0xabcd],
      buffer: Buffer.from([0xab, 0xcd]),
    } as never)

    const transport = await createTCPTransport(config)
    const result = await transport.readInputRegisters(50, 1)

    expect(mockModbus.readInputRegisters).toHaveBeenCalledWith(50, 1)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(2)
  })

  test('should read coils and return buffer', async () => {
    const config = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    }

    mockModbus.connectTCP.mockResolvedValue(undefined)
    mockModbus.readCoils.mockResolvedValue({
      data: [true, false, true],
      buffer: Buffer.from([0b00000101]),
    } as never)

    const transport = await createTCPTransport(config)
    const result = await transport.readCoils(10, 3)

    expect(mockModbus.readCoils).toHaveBeenCalledWith(10, 3)
    expect(result).toBeInstanceOf(Buffer)
  })

  test('should read discrete inputs and return buffer', async () => {
    const config = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    }

    mockModbus.connectTCP.mockResolvedValue(undefined)
    mockModbus.readDiscreteInputs.mockResolvedValue({
      data: [false, true],
      buffer: Buffer.from([0b00000010]),
    } as never)

    const transport = await createTCPTransport(config)
    const result = await transport.readDiscreteInputs(20, 2)

    expect(mockModbus.readDiscreteInputs).toHaveBeenCalledWith(20, 2)
    expect(result).toBeInstanceOf(Buffer)
  })

  test('should write single register', async () => {
    const config = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    }

    mockModbus.connectTCP.mockResolvedValue(undefined)
    mockModbus.writeRegister.mockResolvedValue({} as never)

    const transport = await createTCPTransport(config)
    await transport.writeSingleRegister(100, 0x1234)

    expect(mockModbus.writeRegister).toHaveBeenCalledWith(100, 0x1234)
  })

  test('should write single coil', async () => {
    const config = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    }

    mockModbus.connectTCP.mockResolvedValue(undefined)
    mockModbus.writeCoil.mockResolvedValue({} as never)

    const transport = await createTCPTransport(config)
    await transport.writeSingleCoil(5, true)

    expect(mockModbus.writeCoil).toHaveBeenCalledWith(5, true)
  })

  test('should write multiple coils', async () => {
    const config = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    }

    mockModbus.connectTCP.mockResolvedValue(undefined)
    mockModbus.writeCoils.mockResolvedValue({} as never)

    const transport = await createTCPTransport(config)
    // Create buffer representing 16 coils: bit pattern 0b00000101, 0b00001010
    const buffer = Buffer.from([0b00000101, 0b00001010])
    await transport.writeMultipleCoils(10, buffer)

    // Each byte gets expanded to 8 booleans
    expect(mockModbus.writeCoils).toHaveBeenCalledWith(10, [
      true,
      false,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      true,
      false,
      false,
      false,
      false,
    ])
  })

  test('should throw error after exhausting all retries', async () => {
    const config = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    }

    mockModbus.connectTCP.mockResolvedValue(undefined)
    // Make all attempts fail
    mockModbus.readHoldingRegisters.mockRejectedValue(new Error('Network unreachable'))

    const transport = await createTCPTransport(config)

    await expect(transport.readHoldingRegisters(0, 2)).rejects.toThrow('Network unreachable')

    // Should have tried 3 times (initial + 2 retries)
    expect(mockModbus.readHoldingRegisters).toHaveBeenCalledTimes(3)
  })

  test('should close transport', async () => {
    const config = {
      host: '192.168.1.100',
      port: 502,
      slaveId: 1,
    }

    mockModbus.connectTCP.mockResolvedValue(undefined)

    let closeCallback: (() => void) | undefined
    mockModbus.close.mockImplementation((callback?: () => void) => {
      closeCallback = callback
    })

    const transport = await createTCPTransport(config)
    const closePromise = transport.close()

    // Simulate async close completion
    if (closeCallback) {
      closeCallback()
    }

    await closePromise

    expect(mockModbus.close).toHaveBeenCalled()
  })
})
