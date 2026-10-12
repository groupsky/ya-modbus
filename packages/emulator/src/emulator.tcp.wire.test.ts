/**
 * Tests of ModbusEmulator over TCP with the real modbus-serial server and client
 *
 * The mocked transport tests cannot show which response reaches a client, because
 * modbus-serial builds the response from what the service vector returns or throws.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import ModbusRTU, { ServerTCP } from 'modbus-serial'

import { ModbusEmulator } from './emulator.js'
import type { MemoryTransport } from './transports/memory.js'
import { createServiceVector, type RequestHandler } from './transports/service-vector.js'
import { getFreePort } from './transports/test-free-port.js'

const HOST = '127.0.0.1'
const KNOWN_SLAVE = 1
const UNKNOWN_SLAVE = 9

describe('ModbusEmulator over TCP with a real client', () => {
  let emulator: ModbusEmulator
  let client: ModbusRTU

  beforeEach(async () => {
    const port = await getFreePort()
    emulator = new ModbusEmulator({ transport: 'tcp', host: HOST, port })
    emulator.addDevice({ slaveId: KNOWN_SLAVE, registers: { holding: { 0: 230 } } })
    await emulator.start()

    client = new ModbusRTU()
    await client.connectTCP(HOST, { port })
    client.setTimeout(2000)
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => client.close(() => resolve()))
    await emulator.stop()
  })

  it('answers requests for a slave ID that has a device', async () => {
    client.setID(KNOWN_SLAVE)

    await client.writeRegister(1, 52)

    await expect(client.readHoldingRegisters(0, 2)).resolves.toMatchObject({ data: [230, 52] })
  })

  describe('slave ID without a device', () => {
    // Issue #561: a write got a success response and nothing was stored. A read got exception
    // 0x04. A gateway answers every request for an absent device with exception 0x0B.
    it.each([
      { name: 'read holding registers', call: () => client.readHoldingRegisters(0, 1) },
      { name: 'read input registers', call: () => client.readInputRegisters(0, 1) },
      { name: 'write single register', call: () => client.writeRegister(0, 1) },
      { name: 'write multiple registers', call: () => client.writeRegisters(0, [1, 2]) },
      { name: 'write single coil', call: () => client.writeCoil(0, true) },
    ])('answers $name with exception 0x0B', async ({ call }) => {
      client.setID(UNKNOWN_SLAVE)

      await expect(call()).rejects.toMatchObject({ modbusCode: 0x0b })
    })
  })

  it.each([
    { name: 'read coils', call: () => client.readCoils(0, 3) },
    { name: 'read discrete inputs', call: () => client.readDiscreteInputs(0, 3) },
    { name: 'write single coil', call: () => client.writeCoil(0, true) },
    { name: 'write multiple coils', call: () => client.writeCoils(0, [true, false, true]) },
  ])('answers $name with exception 0x01', async ({ call }) => {
    client.setID(KNOWN_SLAVE)

    await expect(call()).rejects.toMatchObject({ modbusCode: 0x01 })
  })

  it('answers a read of more than 125 registers with exception 0x04', async () => {
    client.setID(KNOWN_SLAVE)

    await expect(client.readHoldingRegisters(0, 126)).rejects.toMatchObject({ modbusCode: 0x04 })
  })

  it('answers a write that the device rejects with exception 0x03', async () => {
    client.setID(KNOWN_SLAVE)

    // The second register is at address 65536
    await expect(client.writeRegisters(0xffff, [1, 2])).rejects.toMatchObject({ modbusCode: 0x03 })
  })
})

describe('requests to a slave ID without a device when the vector is silent (RTU)', () => {
  // The RTU transport needs a serial port. ServerTCP uses the same modbus-serial handlers as
  // ServerSerial, so it shows what a client sees when the service vector sends no response.
  let emulator: ModbusEmulator
  let server: ServerTCP
  let client: ModbusRTU

  beforeEach(async () => {
    const port = await getFreePort()
    emulator = new ModbusEmulator({ transport: 'memory' })
    emulator.addDevice({ slaveId: KNOWN_SLAVE, registers: { holding: { 0: 230 } } })
    const memory = emulator.getTransport() as MemoryTransport
    const vector = createServiceVector((): RequestHandler => memory.sendRequest.bind(memory), {
      unknownSlave: 'silence',
    })

    server = new ServerTCP(vector, { host: HOST, port, unitID: 255 })
    await new Promise<void>((resolve) => server.once('initialized', resolve))
    client = new ModbusRTU()
    await client.connectTCP(HOST, { port })
    client.setTimeout(300)
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => client.close(() => resolve()))
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it.each([
    { name: 'read one register', call: () => client.readHoldingRegisters(0, 1) },
    { name: 'read multiple registers', call: () => client.readHoldingRegisters(0, 2) },
    { name: 'write single register', call: () => client.writeRegister(0, 1) },
    { name: 'write multiple registers', call: () => client.writeRegisters(0, [1, 2]) },
    { name: 'write multiple coils', call: () => client.writeCoils(0, [true, false, true]) },
  ])('sends no response to $name', async ({ call }) => {
    client.setID(UNKNOWN_SLAVE)

    await expect(call()).rejects.toMatchObject({ errno: 'ETIMEDOUT' })
  })

  it('goes on to answer a slave ID that has a device', async () => {
    client.setID(UNKNOWN_SLAVE)
    await expect(client.writeRegister(0, 1)).rejects.toMatchObject({ errno: 'ETIMEDOUT' })

    client.setID(KNOWN_SLAVE)

    await expect(client.readHoldingRegisters(0, 1)).resolves.toMatchObject({ data: [230] })
  })
})
