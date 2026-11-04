/**
 * `ya-modbus-bridge check`: the real config loading and driver checks. Only the driver package
 * loading, the serial port and MQTT are replaced, so the tests can see that neither opens.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { loadDriver, type LoadedDriver } from '@ya-modbus/driver-loader'
import ModbusRTU from 'modbus-serial'
import mqtt from 'mqtt'

import { main } from './cli.js'
import { processUtils } from './utils/process.js'

jest.mock('./utils/process.js')
jest.mock('modbus-serial')
jest.mock('mqtt')
jest.mock('@ya-modbus/driver-loader', () => ({
  ...jest.requireActual<object>('@ya-modbus/driver-loader'),
  loadDriver: jest.fn(),
}))

/** Works only with odd parity, like the OR-WE-516 */
const oddOnlyDriver: LoadedDriver = {
  createDriver: jest.fn<LoadedDriver['createDriver']>(),
  defaultConfig: { baudRate: 9600, parity: 'odd', dataBits: 8, stopBits: 1, defaultAddress: 1 },
  supportedConfig: {
    validBaudRates: [9600],
    validParity: ['odd'],
    validDataBits: [8],
    validStopBits: [1],
    validAddressRange: [1, 247],
  },
}

function device(deviceId: string, connection: object, extra: object = {}): object {
  return {
    deviceId,
    driver: 'ya-modbus-driver-test',
    connection: { type: 'rtu', port: '/dev/ttyUSB0', slaveId: 1, ...connection },
    ...extra,
  }
}

describe('CLI check command', () => {
  let dir: string
  let errorSpy: jest.SpiedFunction<typeof console.error>
  let logSpy: jest.SpiedFunction<typeof console.log>

  async function check(config: unknown): Promise<string[]> {
    const path = join(dir, 'config.json')
    await writeFile(path, typeof config === 'string' ? config : JSON.stringify(config))
    await main(['node', 'ya-modbus-bridge', 'check', '--config', path])
    // eslint-disable-next-line no-control-regex -- strip chalk colors
    return errorSpy.mock.calls.map((call) => call.join(' ').replace(/\x1b\[[0-9;]*m/g, ''))
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    dir = await mkdtemp(join(tmpdir(), 'bridge-check-'))
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    jest.mocked(loadDriver).mockResolvedValue(oddOnlyDriver)
  })

  afterEach(async () => {
    jest.restoreAllMocks()
    await rm(dir, { recursive: true, force: true })
  })

  it('should exit with 0 for a valid config, without opening a port or MQTT', async () => {
    const errors = await check({ devices: [device('meter', {})] })

    expect(errors).toEqual([])
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('is valid'))
    expect(processUtils.exit).toHaveBeenCalledWith(0)
    expect(loadDriver).toHaveBeenCalledWith({ driverPackage: 'ya-modbus-driver-test' })
    expect(ModbusRTU).not.toHaveBeenCalled()
    expect(mqtt.connect).not.toHaveBeenCalled()
    expect(oddOnlyDriver.createDriver).not.toHaveBeenCalled()
  })

  it('should print every schema error with its path and exit with 1', async () => {
    const errors = await check({ topicPrefix: 1, typo: true, devices: [{ deviceId: 'x' }] })

    expect(errors).toEqual([
      expect.stringMatching(/^✗ topicPrefix: /),
      expect.stringMatching(/^✗ devices\.0\.driver: /),
      expect.stringMatching(/^✗ devices\.0\.connection: /),
      expect.stringMatching(/^✗ .*typo/),
      expect.stringMatching(/^4 error\(s\) in /),
    ])
    expect(processUtils.exit).toHaveBeenCalledWith(1)
    expect(loadDriver).not.toHaveBeenCalled()
  })

  it('should print the error of each device whose driver does not accept it', async () => {
    jest
      .mocked(loadDriver)
      .mockResolvedValueOnce(oddOnlyDriver)
      .mockRejectedValueOnce(new Error('Cannot find module ya-modbus-driver-test'))
      .mockResolvedValueOnce(oddOnlyDriver)

    const errors = await check({
      devices: [
        device('meter1', { parity: 'none' }),
        device('meter2', {}),
        device('meter3', {}),
        device('off', { parity: 'none' }, { enabled: false }),
      ],
    })

    expect(errors).toEqual([
      "✗ devices[0] (meter1): Invalid parity 'none'. This driver supports: odd (default: odd)",
      '✗ devices[1] (meter2): Cannot find module ya-modbus-driver-test',
      expect.stringMatching(/^2 error\(s\) in /),
    ])
    expect(loadDriver).toHaveBeenCalledTimes(3)
    expect(processUtils.exit).toHaveBeenCalledWith(1)
  })

  it('should print a file that is not JSON as one error', async () => {
    const errors = await check('{')

    expect(errors[0]).toMatch(/^✗ .*JSON/)
    expect(processUtils.exit).toHaveBeenCalledWith(1)
  })

  it('should require --config', async () => {
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true)

    await main(['node', 'ya-modbus-bridge', 'check'])

    expect(processUtils.exit).toHaveBeenCalledWith(1)
  })
})
