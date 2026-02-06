/**
 * Helper for running code against a Modbus RTU server via virtual serial ports
 *
 * Sets up a virtual serial port pair using socat, starts a Modbus RTU server
 * using modbus-serial's ServerSerial, and provides the client port path to the callback.
 */

import { ServerSerial, type IServiceVector } from 'modbus-serial'

import { createPtyPair, type PtyPair } from './pty-pair.js'

export interface RtuEmulatorConfig {
  /** Slave ID for the emulated device (default: 1) */
  slaveId?: number
  /** Initial holding register values: { address: value } */
  holding?: Record<number, number>
  /** Initial input register values: { address: value } */
  input?: Record<number, number>
  /** Baud rate (default: 9600) */
  baudRate?: number
  /** Parity (default: 'even') */
  parity?: 'none' | 'even' | 'odd'
}

export interface RtuEmulatorContext {
  /** Path to the client-side PTY for connecting the transport */
  clientPort: string
  /** The PTY pair (for advanced usage) */
  ptyPair: PtyPair
}

/**
 * Run a function with an RTU emulator
 *
 * Sets up a virtual serial port pair, starts a Modbus RTU server,
 * and provides the client port path that can be used with createRTUTransport.
 *
 * Requires socat to be installed on the system.
 *
 * @example
 * ```typescript
 * import { withRtuEmulator } from '@ya-modbus/emulator'
 * import { createRTUTransport } from '@ya-modbus/transport'
 * import { createDriver } from '@ya-modbus/driver-xymd1'
 *
 * await withRtuEmulator(
 *   { input: { 1: 245, 2: 652 } },
 *   async ({ clientPort }) => {
 *     const transport = await createRTUTransport({
 *       port: clientPort,
 *       baudRate: 9600,
 *       parity: 'even',
 *       dataBits: 8,
 *       stopBits: 1,
 *       slaveId: 1,
 *     })
 *     const driver = await createDriver({ transport, slaveId: 1 })
 *     const values = await driver.readDataPoints(['temperature', 'humidity'])
 *     console.log(values) // { temperature: 24.5, humidity: 65.2 }
 *     await transport.close()
 *   }
 * )
 * ```
 */
export async function withRtuEmulator<T>(
  config: RtuEmulatorConfig,
  fn: (context: RtuEmulatorContext) => Promise<T>
): Promise<T> {
  const slaveId = config.slaveId ?? 1

  // Create register storage
  const holdingRegisters = new Map<string, number>()
  const inputRegisters = new Map<string, number>()

  // Initialize registers from config
  if (config.holding) {
    for (const [addr, value] of Object.entries(config.holding)) {
      holdingRegisters.set(`${slaveId}:${addr}`, value)
    }
  }
  if (config.input) {
    for (const [addr, value] of Object.entries(config.input)) {
      inputRegisters.set(`${slaveId}:${addr}`, value)
    }
  }

  // Create service vector for ServerSerial
  const vector: IServiceVector = {
    getHoldingRegister: (addr: number, unitID: number): number => {
      return holdingRegisters.get(`${unitID}:${addr}`) ?? 0
    },
    getInputRegister: (addr: number, unitID: number): number => {
      return inputRegisters.get(`${unitID}:${addr}`) ?? 0
    },
    getMultipleHoldingRegisters: (addr: number, length: number, unitID: number): number[] => {
      const values: number[] = []
      for (let i = 0; i < length; i++) {
        values.push(holdingRegisters.get(`${unitID}:${addr + i}`) ?? 0)
      }
      return values
    },
    getMultipleInputRegisters: (addr: number, length: number, unitID: number): number[] => {
      const values: number[] = []
      for (let i = 0; i < length; i++) {
        values.push(inputRegisters.get(`${unitID}:${addr + i}`) ?? 0)
      }
      return values
    },
    setRegister: (addr: number, value: number, unitID: number): void => {
      holdingRegisters.set(`${unitID}:${addr}`, value)
    },
    setRegisterArray: (addr: number, values: number[], unitID: number): void => {
      for (let i = 0; i < values.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        holdingRegisters.set(`${unitID}:${addr + i}`, values[i]!)
      }
    },
    // Coil operations (not typically used for XYMD1 but included for completeness)
    getCoil: (): boolean => false,
    getDiscreteInput: (): boolean => false,
    setCoil: (): void => {},
  }

  // Create PTY pair
  const ptyPair = await createPtyPair()

  // Create Modbus RTU server on the server PTY
  // Note: modbus-serial's ServerSerial accepts 'path' from serialport options
  const server = new ServerSerial(vector, {
    path: ptyPair.serverPath,
    baudRate: config.baudRate ?? 9600,
    parity: config.parity ?? 'even',
    dataBits: 8,
    stopBits: 1,
  })

  // Wait for server to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 5000)
    server.on('initialized', () => {
      clearTimeout(timeout)
      resolve()
    })
    server.on('error', (err: Error | null) => {
      clearTimeout(timeout)
      reject(err ?? new Error('Unknown server error'))
    })
  })

  try {
    return await fn({
      clientPort: ptyPair.clientPath,
      ptyPair,
    })
  } finally {
    server.close(() => {})
    await ptyPair.stop()
  }
}
