/**
 * A serial adapter, simulated with a socat pseudo-terminal pair: unplug and replug it, and open
 * its port with other settings. Like a real serial port, an open port is locked.
 *
 * Killing socat removes both pseudo-terminals, like unplugging a USB adapter removes
 * its device node. Starting socat again with the same link names brings the port back.
 * The tests are skipped when socat is not installed, except in CI, which installs it.
 */

import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

import type { Transport } from '@ya-modbus/driver-types'
import { ServerSerial } from 'modbus-serial'

import { TransportManager } from './manager.js'

const hasSocat = spawnSync('socat', ['-V']).status === 0

// A skipped suite in CI would hide that these tests never run there
if (!hasSocat && process.env['CI']) {
  throw new Error('socat is required for the serial port tests in CI')
}

/** Repeat an action until it returns true or the time runs out */
async function waitUntil(
  action: () => Promise<boolean> | boolean,
  timeoutMs = 5000
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!(await action())) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for condition')
    await sleep(50)
  }
}

/** Read one holding register and return the error name, or 'ok' */
async function tryRead(transport: Transport): Promise<string> {
  try {
    await transport.readHoldingRegisters(0, 1)
    return 'ok'
  } catch (error) {
    return (error as Error).name
  }
}

;(hasSocat ? describe : describe.skip)('serial adapter simulated with socat', () => {
  let dir: string
  let clientPath: string
  let devicePath: string
  let socat: ChildProcess | undefined
  let device: ServerSerial | undefined
  let manager: TransportManager

  async function plugIn(): Promise<void> {
    socat = spawn(
      'socat',
      [`pty,rawer,echo=0,link=${clientPath}`, `pty,rawer,echo=0,link=${devicePath}`],
      { stdio: 'ignore' }
    )
    await waitUntil(() => existsSync(clientPath) && existsSync(devicePath))

    // Modbus device on the other end of the pair, answers 42 for every holding register
    await new Promise<void>((resolve, reject) => {
      device = new ServerSerial(
        { getHoldingRegister: (_addr: number, _unitID: number, cb) => cb(null, 42) },
        {
          path: devicePath,
          baudRate: 9600,
          unitID: 1,
          openCallback: (error) => (error ? reject(error) : resolve()),
        }
      )
      // The device port fails too when socat is killed
      device.on('error', () => undefined)
    })
  }

  async function unplug(): Promise<void> {
    const socatProcess = socat
    socat = undefined
    if (socatProcess?.exitCode === null) {
      await new Promise((resolve) => {
        socatProcess.once('exit', resolve)
        socatProcess.kill('SIGTERM')
      })
    }
    device = undefined
  }

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'ya-modbus-transport-'))
    clientPath = join(dir, 'client')
    devicePath = join(dir, 'device')
    manager = new TransportManager()
    await plugIn()
  })

  afterEach(async () => {
    await manager.closeAll()
    const server = device
    if (server) await new Promise((resolve) => server.close(resolve))
    await unplug()
    rmSync(dir, { recursive: true, force: true })
  })

  test('fails requests while the port is gone and reads again after it comes back', async () => {
    const transport = await manager.getTransport({
      port: clientPath,
      baudRate: 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      slaveId: 1,
      timeout: 500,
      maxRetries: 1,
    })
    await expect(transport.readHoldingRegisters(0, 1)).resolves.toEqual(Buffer.from([0, 42]))

    await unplug()
    await waitUntil(async () => (await tryRead(transport)) === 'ConnectionLostError')

    await plugIn()
    await waitUntil(async () => (await tryRead(transport)) === 'ok')
    await expect(transport.readHoldingRegisters(0, 1)).resolves.toEqual(Buffer.from([0, 42]))
  }, 20_000)

  test('with startLost, opens a port that is missing at start after it appears', async () => {
    await unplug()
    manager = new TransportManager({ startLost: true })

    const transport = await manager.getTransport({
      port: clientPath,
      baudRate: 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      slaveId: 1,
      timeout: 500,
      maxRetries: 1,
    })
    expect(await tryRead(transport)).toBe('ConnectionLostError')

    await plugIn()
    await waitUntil(async () => (await tryRead(transport)) === 'ok')
    await expect(transport.readHoldingRegisters(0, 1)).resolves.toEqual(Buffer.from([0, 42]))
  }, 20_000)

  // The port stayed open and locked until closeAll(), so other settings could not open it
  test('opens the port with other settings after the last transport on it is released', async () => {
    const config = {
      port: clientPath,
      baudRate: 9600,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      slaveId: 1,
      timeout: 500,
      maxRetries: 1,
    } as const
    const transport = await manager.getTransport(config)
    await expect(transport.readHoldingRegisters(0, 1)).resolves.toEqual(Buffer.from([0, 42]))

    await manager.releaseTransport(transport)
    const other = await manager.getTransport({ ...config, baudRate: 19200 })

    await expect(other.readHoldingRegisters(0, 1)).resolves.toEqual(Buffer.from([0, 42]))
  }, 20_000)
})
