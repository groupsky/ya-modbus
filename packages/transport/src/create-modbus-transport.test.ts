import { EventEmitter } from 'node:events'

import ModbusRTU from 'modbus-serial'

import { createModbusTransport } from './create-modbus-transport.js'

// These tests use the real modbus-serial client so the rejected values and
// the emitted events have the shapes the library produces (plain objects that
// do not extend Error).

/** Serial port that accepts writes but never answers */
class SilentPort extends EventEmitter {
  isOpen = true
  write = jest.fn()
}

/** Serial port that can be opened by the real client and then unplugged */
class UnpluggablePort extends SilentPort {
  open(callback: (error: Error | null) => void): void {
    callback(null)
  }

  close(callback: () => void): void {
    this.isOpen = false
    callback()
  }

  /** What serialport does when a write fails because the USB adapter is gone */
  unplug(): void {
    this.isOpen = false
    this.emit('error', new Error('EIO: i/o error, write'))
    this.emit('close')
  }
}

async function openClient(port: UnpluggablePort, timeout = 1000): Promise<ModbusRTU> {
  const client = new ModbusRTU(port)
  await new Promise<void>((resolve, reject) => {
    client.open((error: Error | null) => (error ? reject(error) : resolve()))
  })
  client.setTimeout(timeout)
  return client
}

test.each([
  {
    situation: 'the device does not answer',
    createClient: () => {
      const client = new ModbusRTU(new SilentPort())
      client.setTimeout(10)
      return client
    },
    expected: { name: 'TransactionTimedOutError', message: 'Timed out', errno: 'ETIMEDOUT' },
  },
  {
    situation: 'the port is not open',
    createClient: () => new ModbusRTU(),
    expected: { name: 'PortNotOpenError', message: 'Port Not Open', errno: 'ECONNREFUSED' },
  },
])('rejects with an Error that keeps errno when $situation', async ({ createClient, expected }) => {
  const transport = createModbusTransport(createClient(), 1)

  const error = await transport.readHoldingRegisters(0, 1).catch((err: unknown) => err)

  expect(error).toBeInstanceOf(Error)
  expect(error).toMatchObject(expected)
})

describe('when the serial port fails', () => {
  // Without an 'error' listener on the client, Node.js throws the SerialPortError
  // that modbus-serial emits and the whole process crashes
  test('does not throw the error event of the client', async () => {
    const port = new UnpluggablePort()
    createModbusTransport(await openClient(port), 1)

    expect(() => port.unplug()).not.toThrow()
  })

  // Closing the client stops modbus-serial from forwarding the 'error' events of its port
  test('does not throw an error that the port emits after the lost client is closed', async () => {
    const port = new UnpluggablePort()
    createModbusTransport(await openClient(port), 1)

    // The port fails but stays open, so the lost client is closed
    port.emit('error', new Error('EIO: i/o error, read'))
    expect(port.isOpen).toBe(false)

    expect(() => port.emit('error', new Error('EIO: i/o error, read'))).not.toThrow()
  })

  test('rejects a request in flight at once instead of waiting for the response timeout', async () => {
    const port = new UnpluggablePort()
    const transport = createModbusTransport(await openClient(port), 1)

    const request = transport.readHoldingRegisters(0, 1).catch((err: unknown) => err)
    await new Promise((resolve) => setImmediate(resolve))
    expect(port.write).toHaveBeenCalled()
    port.unplug()

    const error = await request
    expect(error).toMatchObject({
      name: 'ConnectionLostError',
      message: 'Connection lost: EIO: i/o error, write',
    })
    // modbus-serial gives every port error errno 'ECONNREFUSED', also an unplugged adapter
    expect(error).not.toHaveProperty('errno')
  })

  test('rejects later requests with the same error without writing to the port', async () => {
    const port = new UnpluggablePort()
    const transport = createModbusTransport(await openClient(port), 1)
    port.unplug()

    const error = await transport.writeSingleRegister(0, 1).catch((err: unknown) => err)

    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({ name: 'ConnectionLostError' })
    expect(port.write).not.toHaveBeenCalled()
  })
})
