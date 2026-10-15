import { EventEmitter } from 'node:events'

import type ModbusRTU from 'modbus-serial'

import { createRTUTransport } from './rtu-transport.js'

// Mock modbus-serial
jest.mock('modbus-serial')

describe('RTU Transport', () => {
  let mockModbus: jest.Mocked<ModbusRTU>

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks()

    // Create mock modbus instance
    mockModbus = {
      connectRTUBuffered: jest.fn(),
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
      on: jest.fn(),
      isOpen: true,
    } as unknown as jest.Mocked<ModbusRTU>

    // Mock the ModbusRTU constructor
    const ModbusRTUConstructor = await import('modbus-serial')
    ;(ModbusRTUConstructor as any).default.mockImplementation(() => mockModbus)
  })

  test('should create RTU transport with correct configuration', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
      timeout: 1000,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)

    const transport = await createRTUTransport(config)

    expect(mockModbus.connectRTUBuffered).toHaveBeenCalledWith('/dev/ttyUSB0', {
      baudRate: 9600,
      dataBits: 8,
      parity: 'even',
      stopBits: 1,
    })
    expect(mockModbus.setID).toHaveBeenCalledWith(1)
    expect(mockModbus.setTimeout).toHaveBeenCalledWith(1000)
    expect(transport).toBeDefined()
  })

  test('should read holding registers and return buffer', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)
    mockModbus.readHoldingRegisters.mockResolvedValue({
      data: [0x00f5, 0x0064], // 245, 100
      buffer: Buffer.from([0x00, 0xf5, 0x00, 0x64]),
    })

    const transport = await createRTUTransport(config)
    const result = await transport.readHoldingRegisters(0, 2)

    expect(mockModbus.readHoldingRegisters).toHaveBeenCalledWith(0, 2)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(4)
    expect(result.readUInt16BE(0)).toBe(0x00f5)
    expect(result.readUInt16BE(2)).toBe(0x0064)
  })

  test('should read input registers and return buffer', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)
    mockModbus.readInputRegisters.mockResolvedValue({
      data: [0x0100, 0x0200],
      buffer: Buffer.from([0x01, 0x00, 0x02, 0x00]),
    })

    const transport = await createRTUTransport(config)
    const result = await transport.readInputRegisters(10, 2)

    expect(mockModbus.readInputRegisters).toHaveBeenCalledWith(10, 2)
    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBe(4)
  })

  test('should read coils and return buffer', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)
    mockModbus.readCoils.mockResolvedValue({
      data: [true, false, true, false, false, false, false, false],
      buffer: Buffer.from([0x05]),
    })

    const transport = await createRTUTransport(config)
    const result = await transport.readCoils(0, 8)

    expect(mockModbus.readCoils).toHaveBeenCalledWith(0, 8)
    expect(result).toBeInstanceOf(Buffer)
  })

  test('should read discrete inputs and return buffer', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)
    mockModbus.readDiscreteInputs.mockResolvedValue({
      data: [false, true, true, false, false, false, false, false],
      buffer: Buffer.from([0x06]),
    })

    const transport = await createRTUTransport(config)
    const result = await transport.readDiscreteInputs(5, 8)

    expect(mockModbus.readDiscreteInputs).toHaveBeenCalledWith(5, 8)
    expect(result).toBeInstanceOf(Buffer)
  })

  test('should write single register', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)
    mockModbus.writeRegister.mockResolvedValue({} as never)

    const transport = await createRTUTransport(config)
    await transport.writeSingleRegister(100, 0x1234)

    expect(mockModbus.writeRegister).toHaveBeenCalledWith(100, 0x1234)
  })

  test('should write multiple registers', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)
    mockModbus.writeRegisters.mockResolvedValue({} as never)

    const transport = await createRTUTransport(config)
    const values = Buffer.from([0x12, 0x34, 0x56, 0x78])
    await transport.writeMultipleRegisters(50, values)

    expect(mockModbus.writeRegisters).toHaveBeenCalledWith(50, values)
  })

  test('should write single coil', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)
    mockModbus.writeCoil.mockResolvedValue({} as never)

    const transport = await createRTUTransport(config)
    await transport.writeSingleCoil(10, true)

    expect(mockModbus.writeCoil).toHaveBeenCalledWith(10, true)
  })

  test('should write multiple coils', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)
    mockModbus.writeCoils.mockResolvedValue({} as never)

    const transport = await createRTUTransport(config)
    const values = Buffer.from([0xff, 0x00])
    await transport.writeMultipleCoils(20, values)

    // The implementation converts Buffer to boolean array
    const expectedBools = [
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true, // 0xFF
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false, // 0x00
    ]
    expect(mockModbus.writeCoils).toHaveBeenCalledWith(20, expectedBools)
  })

  test('should use default timeout if not specified', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)

    await createRTUTransport(config)

    expect(mockModbus.setTimeout).toHaveBeenCalledWith(1000)
  })

  test('should retry on transient failures', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)

    // Fail twice, then succeed
    mockModbus.readHoldingRegisters
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce({
        data: [0x00f5],
        buffer: Buffer.from([0x00, 0xf5]),
      })

    const transport = await createRTUTransport(config)
    const result = await transport.readHoldingRegisters(0, 1)

    expect(mockModbus.readHoldingRegisters).toHaveBeenCalledTimes(3)
    expect(result).toBeInstanceOf(Buffer)
  })

  test('should throw after max retries exceeded', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)
    mockModbus.readHoldingRegisters.mockRejectedValue(new Error('Timeout'))

    const transport = await createRTUTransport(config)

    await expect(transport.readHoldingRegisters(0, 1)).rejects.toThrow('Timeout')
    expect(mockModbus.readHoldingRegisters).toHaveBeenCalledTimes(3)
  })

  test('should throw error after exhausting all retries', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)
    // Make all attempts fail
    mockModbus.readHoldingRegisters.mockRejectedValue(new Error('Connection lost'))

    const transport = await createRTUTransport(config)

    await expect(transport.readHoldingRegisters(0, 2)).rejects.toThrow('Connection lost')

    // Should have tried 3 times (initial + 2 retries)
    expect(mockModbus.readHoldingRegisters).toHaveBeenCalledTimes(3)
  })

  test('should close transport', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)

    let closeCallback: (() => void) | undefined
    mockModbus.close.mockImplementation((callback?: () => void) => {
      closeCallback = callback
    })

    const transport = await createRTUTransport(config)
    const closePromise = transport.close()

    // Simulate async close completion
    if (closeCallback) {
      closeCallback()
    }

    await closePromise

    expect(mockModbus.close).toHaveBeenCalled()
  })

  test('should respect custom maxRetries config option', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
      maxRetries: 5,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)
    mockModbus.readHoldingRegisters.mockRejectedValue(new Error('Failed'))

    const transport = await createRTUTransport(config)

    await expect(transport.readHoldingRegisters(0, 1)).rejects.toThrow('Failed')
    expect(mockModbus.readHoldingRegisters).toHaveBeenCalledTimes(5)
  })

  test('should call logger on retry attempts', async () => {
    const logger = jest.fn()
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
      logger,
    }

    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)
    mockModbus.readHoldingRegisters
      .mockRejectedValueOnce(new Error('Error 1'))
      .mockRejectedValueOnce(new Error('Error 2'))
      .mockResolvedValueOnce({
        data: [0x1234],
        buffer: Buffer.from([0x12, 0x34]),
      })

    const transport = await createRTUTransport(config)
    const result = await transport.readHoldingRegisters(0, 1)

    expect(result).toBeInstanceOf(Buffer)
    expect(mockModbus.readHoldingRegisters).toHaveBeenCalledTimes(3)
    expect(logger).toHaveBeenCalledTimes(2)
    expect(logger).toHaveBeenNthCalledWith(1, 1, expect.objectContaining({ message: 'Error 1' }))
    expect(logger).toHaveBeenNthCalledWith(2, 2, expect.objectContaining({ message: 'Error 2' }))
  })

  test('should reopen the serial port on a later request after the port was lost', async () => {
    const config = {
      port: '/dev/ttyUSB0',
      baudRate: 9600 as const,
      dataBits: 8 as const,
      parity: 'even' as const,
      stopBits: 1 as const,
      slaveId: 1,
      maxRetries: 1,
    }
    const events = new EventEmitter()
    mockModbus.on.mockImplementation((event: string, listener: () => void) => {
      events.on(event, listener)
      return mockModbus
    })
    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)
    mockModbus.readHoldingRegisters.mockResolvedValue({ data: [1], buffer: Buffer.from([0, 1]) })
    const start = performance.now()
    const clock = jest.spyOn(performance, 'now').mockReturnValue(start)

    try {
      const transport = await createRTUTransport(config)
      events.emit('close')

      await expect(transport.readHoldingRegisters(0, 1)).rejects.toThrow(
        'Connection to /dev/ttyUSB0 lost: port closed'
      )
      clock.mockReturnValue(start + 1000)
      await expect(transport.readHoldingRegisters(0, 1)).resolves.toEqual(Buffer.from([0, 1]))
      expect(mockModbus.connectRTUBuffered).toHaveBeenCalledTimes(2)
    } finally {
      clock.mockRestore()
    }
  })

  test('names port, serial settings, slave and registers in the error of a failed request', async () => {
    mockModbus.connectRTUBuffered.mockResolvedValue(undefined)
    mockModbus.readHoldingRegisters.mockRejectedValue({
      name: 'TransactionTimedOutError',
      message: 'Timed out',
      errno: 'ETIMEDOUT',
    })
    const transport = await createRTUTransport({
      port: '/dev/ttyUSB0',
      baudRate: 19200,
      dataBits: 8,
      parity: 'none',
      stopBits: 2,
      slaveId: 4,
      maxRetries: 1,
    })

    await expect(transport.readHoldingRegisters(100, 3)).rejects.toMatchObject({
      name: 'TransactionTimedOutError',
      errno: 'ETIMEDOUT',
      message:
        'Timed out (/dev/ttyUSB0 19200 8N2, slave 4, FC03 read holding registers, address 100 (0x0064), count 3)',
    })
  })
})
