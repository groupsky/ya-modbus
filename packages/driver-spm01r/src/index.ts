/**
 * Bituo SPM01R FLEX Single-Phase Energy Meter Driver
 *
 * Single-phase + N energy meter, 63 A, built-in current sensor, RS-485, Modbus RTU.
 *
 * Factory default specifications are exported via the DEFAULT_CONFIG constant.
 * See DEFAULT_CONFIG for baud rate, parity, data bits, stop bits, and default address.
 *
 * Register mapping (from the vendor user guide, not yet confirmed on hardware):
 * - 20000-20023: 12 float32 values, big-endian (ABCD), read in one request of 24 registers
 * - 6000: Modbus address, 6001: baud rate code, 6002: parity and stop bits code
 *
 * The guide prints active and apparent power in kW and kVA. The driver multiplies them
 * by 1000 and returns W and VA. This scale is not yet confirmed on hardware.
 *
 * Not exposed on purpose: 10000 (LED blink), 10001 (energy reset), 30000 (broadcast address).
 */

import {
  createEnumValidator,
  createRangeValidator,
  formatEnumError,
  formatRangeError,
  isValidInteger,
} from '@ya-modbus/driver-sdk'
import type {
  CreateDriverFunction,
  DataPoint,
  DefaultSerialConfig,
  DeviceDriver,
  DriverConfig,
  SupportedSerialConfig,
} from '@ya-modbus/driver-types'

/**
 * Supported configuration values for SPM01R
 *
 * The meter also has a "no parity, 2 stop bits" mode (code 3). It is not listed here:
 * the driver supports 1 stop bit only.
 */
export const SUPPORTED_CONFIG = {
  validBaudRates: [2400, 4800, 9600, 19200, 38400],
  validParity: ['none', 'even', 'odd'],
  validDataBits: [8],
  validStopBits: [1],
  validAddressRange: [1, 247],
} as const satisfies SupportedSerialConfig

/**
 * Default SPM01R device configuration
 *
 * Use these values when connecting to a factory-default SPM01R device.
 * A 5 second press of the reset button restores them.
 */
export const DEFAULT_CONFIG = {
  baudRate: 9600,
  parity: 'none',
  dataBits: 8,
  stopBits: 1,
  defaultAddress: 247,
} as const satisfies DefaultSerialConfig

/** First register of the measurement block and its size in registers */
const MEASUREMENT_ADDRESS = 20000
const MEASUREMENT_COUNT = 24

/** Settings registers: address, baud rate, parity (neighbours, read together) */
const ADDRESS_REGISTER = 6000
const BAUD_RATE_REGISTER = 6001
const PARITY_REGISTER = 6002
const SETTINGS_COUNT = 3

interface Measurement {
  id: string
  name: string
  unit?: DataPoint['unit']
  decimals: number
  description: string
  /** Register of the float32 value */
  register: number
  /** Factor from the register value to the data point value */
  factor: number
}

const MEASUREMENTS: ReadonlyArray<Measurement> = [
  {
    id: 'voltage',
    name: 'Voltage',
    unit: 'V',
    decimals: 1,
    description: 'Line voltage',
    register: 20000,
    factor: 1,
  },
  {
    id: 'current',
    name: 'Current',
    unit: 'A',
    decimals: 3,
    description: 'Line current',
    register: 20002,
    factor: 1,
  },
  {
    id: 'active_power',
    name: 'Active Power',
    unit: 'W',
    decimals: 1,
    description: 'Active power in watts (the register is in kW)',
    register: 20004,
    factor: 1000,
  },
  {
    id: 'power_factor',
    name: 'Power Factor',
    decimals: 3,
    description: 'Power factor',
    register: 20006,
    factor: 1,
  },
  {
    id: 'frequency',
    name: 'Grid Frequency',
    unit: 'Hz',
    decimals: 2,
    description: 'Grid frequency',
    register: 20008,
    factor: 1,
  },
  {
    id: 'import_active_energy',
    name: 'Import Active Energy',
    unit: 'kWh',
    decimals: 2,
    description: 'Imported active energy (can be reset)',
    register: 20010,
    factor: 1,
  },
  {
    id: 'export_active_energy',
    name: 'Export Active Energy',
    unit: 'kWh',
    decimals: 2,
    description: 'Exported active energy (can be reset)',
    register: 20012,
    factor: 1,
  },
  {
    id: 'total_active_energy',
    name: 'Total Active Energy',
    unit: 'kWh',
    decimals: 2,
    description: 'Total (absolute) active energy (can be reset)',
    register: 20014,
    factor: 1,
  },
  {
    id: 'total_import_active_energy',
    name: 'Total Import Active Energy',
    unit: 'kWh',
    decimals: 2,
    description: 'Imported active energy, cannot be reset',
    register: 20016,
    factor: 1,
  },
  {
    id: 'total_export_active_energy',
    name: 'Total Export Active Energy',
    unit: 'kWh',
    decimals: 2,
    description: 'Exported active energy, cannot be reset',
    register: 20018,
    factor: 1,
  },
  {
    id: 'total_active_energy_nonresettable',
    name: 'Total Active Energy (non-resettable)',
    unit: 'kWh',
    decimals: 2,
    description: 'Total (absolute) active energy, cannot be reset',
    register: 20020,
    factor: 1,
  },
  {
    id: 'apparent_power',
    name: 'Apparent Power',
    unit: 'VA',
    decimals: 1,
    description: 'Apparent power in volt-amperes (the register is in kVA)',
    register: 20022,
    factor: 1000,
  },
]

/** Baud rate codes. The guide lists 0 and 3 both as 9600; the driver writes 3. */
const BAUD_RATE_DECODE: Record<number, number> = {
  0: 9600,
  1: 2400,
  2: 4800,
  3: 9600,
  4: 19200,
  5: 38400,
}
const BAUD_RATE_ENCODE: Record<number, number> = { 2400: 1, 4800: 2, 9600: 3, 19200: 4, 38400: 5 }

/**
 * Parity codes. Code 3 is no parity with 2 stop bits; it reads as 'none'
 * because stop bits are not a data point.
 */
const PARITY_DECODE: Record<number, string> = { 0: 'none', 1: 'even', 2: 'odd', 3: 'none' }
const PARITY_ENCODE: Record<string, number> = { none: 0, even: 1, odd: 2 }

const SETTING_IDS = ['device_address', 'baud_rate', 'parity']

const DATA_POINTS: ReadonlyArray<DataPoint> = [
  ...MEASUREMENTS.map(({ id, name, unit, decimals, description }): DataPoint => ({
    id,
    name,
    type: 'float',
    ...(unit && { unit }),
    access: 'r',
    description,
    decimals,
  })),
  {
    id: 'device_address',
    name: 'Device Address',
    type: 'integer',
    access: 'rw',
    pollType: 'on-demand',
    description: 'Modbus device address (1-247)',
    min: 1,
    max: 247,
  },
  {
    id: 'baud_rate',
    name: 'Baud Rate',
    type: 'enum',
    access: 'rw',
    pollType: 'on-demand',
    description: 'Serial baud rate',
    enumValues: {
      2400: '2400 bps',
      4800: '4800 bps',
      9600: '9600 bps',
      19200: '19200 bps',
      38400: '38400 bps',
    },
  },
  {
    id: 'parity',
    name: 'Parity',
    type: 'enum',
    access: 'rw',
    pollType: 'on-demand',
    description: 'Serial parity, 8 data bits and 1 stop bit',
    enumValues: { none: 'None', even: 'Even', odd: 'Odd' },
  },
]

const MEASUREMENT_BY_ID = new Map(MEASUREMENTS.map((m) => [m.id, m]))

const isValidBaudRate = createEnumValidator(SUPPORTED_CONFIG.validBaudRates)
const isValidParity = createEnumValidator(SUPPORTED_CONFIG.validParity)
const isValidAddress = createRangeValidator(...SUPPORTED_CONFIG.validAddressRange)

function decodeBaudRate(code: number): number {
  const baudRate = BAUD_RATE_DECODE[code]
  if (baudRate === undefined) {
    throw new Error(`Unknown baud rate encoding from device: ${code}`)
  }
  return baudRate
}

function decodeParity(code: number): string {
  const parity = PARITY_DECODE[code]
  if (parity === undefined) {
    throw new Error(`Unknown parity encoding from device: ${code}`)
  }
  return parity
}

/**
 * Create SPM01R device driver
 */
export const createDriver: CreateDriverFunction = (config: DriverConfig) => {
  const { transport } = config

  function assertKnown(ids: string[]): void {
    const unknown = ids.filter((id) => !MEASUREMENT_BY_ID.has(id) && !SETTING_IDS.includes(id))
    if (unknown.length > 0) {
      throw new Error(
        unknown.length === 1 && ids.length === 1
          ? `Unknown data point: ${unknown[0]}`
          : `Unknown data points: ${unknown.join(', ')}`
      )
    }
  }

  async function readMeasurements(ids: string[]): Promise<Record<string, unknown>> {
    const buffer = await transport.readHoldingRegisters(MEASUREMENT_ADDRESS, MEASUREMENT_COUNT)
    if (buffer.length < MEASUREMENT_COUNT * 2) {
      throw new Error(
        `Buffer too short: expected at least ${MEASUREMENT_COUNT * 2} bytes, got ${buffer.length}`
      )
    }
    const result: Record<string, unknown> = {}
    for (const id of ids) {
      const { register, factor } = MEASUREMENT_BY_ID.get(id) as Measurement
      result[id] = buffer.readFloatBE((register - MEASUREMENT_ADDRESS) * 2) * factor
    }
    return result
  }

  const driver: DeviceDriver = {
    name: 'SPM01R',
    manufacturer: 'Bituo Technik',
    model: 'SPM01R FLEX',
    dataPoints: DATA_POINTS,

    async readDataPoint(id: string): Promise<unknown> {
      assertKnown([id])
      if (id === 'device_address') {
        return (await transport.readHoldingRegisters(ADDRESS_REGISTER, 1)).readUInt16BE(0)
      }
      if (id === 'baud_rate') {
        return decodeBaudRate(
          (await transport.readHoldingRegisters(BAUD_RATE_REGISTER, 1)).readUInt16BE(0)
        )
      }
      if (id === 'parity') {
        return decodeParity(
          (await transport.readHoldingRegisters(PARITY_REGISTER, 1)).readUInt16BE(0)
        )
      }
      return (await readMeasurements([id]))[id]
    },

    async readDataPoints(ids: string[]): Promise<Record<string, unknown>> {
      assertKnown(ids)
      const result: Record<string, unknown> = {}

      const measurementIds = ids.filter((id) => MEASUREMENT_BY_ID.has(id))
      if (measurementIds.length > 0) {
        Object.assign(result, await readMeasurements(measurementIds))
      }

      const settingIds = ids.filter((id) => SETTING_IDS.includes(id))
      if (settingIds.length > 0) {
        const buffer = await transport.readHoldingRegisters(ADDRESS_REGISTER, SETTINGS_COUNT)
        for (const id of settingIds) {
          if (id === 'device_address') result[id] = buffer.readUInt16BE(0)
          else if (id === 'baud_rate') result[id] = decodeBaudRate(buffer.readUInt16BE(2))
          else result[id] = decodeParity(buffer.readUInt16BE(4))
        }
      }

      return result
    },

    async writeDataPoint(id: string, value: unknown): Promise<void> {
      assertKnown([id])

      if (id === 'device_address') {
        const [min, max] = SUPPORTED_CONFIG.validAddressRange
        if (!isValidInteger(value) || !isValidAddress(value)) {
          throw new Error(formatRangeError('device address', value, min, max))
        }
        await transport.writeSingleRegister(ADDRESS_REGISTER, value)
        return
      }

      if (id === 'baud_rate') {
        if (!isValidBaudRate(value)) {
          throw new Error(formatEnumError('baud rate', value, SUPPORTED_CONFIG.validBaudRates))
        }
        await transport.writeSingleRegister(BAUD_RATE_REGISTER, BAUD_RATE_ENCODE[value] as number)
        return
      }

      if (id === 'parity') {
        if (!isValidParity(value)) {
          throw new Error(formatEnumError('parity', value, SUPPORTED_CONFIG.validParity))
        }
        await transport.writeSingleRegister(PARITY_REGISTER, PARITY_ENCODE[value] as number)
        return
      }

      throw new Error(`Data point ${id} is read-only`)
    },
  }

  return Promise.resolve(driver)
}
