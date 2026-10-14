/**
 * Eastron SDM630 3-Phase Energy Meter Driver
 *
 * 3-phase + N energy meter, DIN rail, RS-485, Modbus RTU.
 *
 * Factory default specifications are exported via the DEFAULT_CONFIG constant.
 * See DEFAULT_CONFIG for baud rate, parity, data bits, stop bits, and default address.
 *
 * Register mapping (input registers, FC 04, float32 big-endian, 2 registers each),
 * from "SDM630 Modbus Protocol" V1.8. A full poll reads 6 blocks:
 * - 0x00 x 80: phase values, totals, frequency, energy
 * - 0x50 x 8: kVAh, Ah, power demand
 * - 0x64 x 4: VA demand
 * - 0xC8 x 8: line-to-line voltage
 * - 0xE0 x 46: neutral current, THD, current demand
 * - 0x14E x 48: line-to-line THD, total and per-phase energy
 */

import { readFloatBE } from '@ya-modbus/driver-sdk'
import type {
  CreateDriverFunction,
  DataPoint,
  DefaultSerialConfig,
  DeviceDriver,
  DriverConfig,
  SupportedSerialConfig,
} from '@ya-modbus/driver-types'

/**
 * Supported configuration values for SDM630
 *
 * From the manual: "User Option Of Parity And Stop Bits: No Parity and 2 Stop Bits /
 * No Parity and 1 Stop Bit / Even Parity and 1 Stop Bit / Odd Parity and 1 Stop Bit"
 * and "User Option of Baud 2400; 4800 ; 9600 ; 19200 ; 38400".
 * The address range is "1 to 247".
 */
export const SUPPORTED_CONFIG = {
  validBaudRates: [2400, 4800, 9600, 19200, 38400],
  validParity: ['none', 'even', 'odd'],
  validDataBits: [8],
  validStopBits: [1, 2],
  validAddressRange: [1, 247],
} as const satisfies SupportedSerialConfig

/**
 * Default SDM630 device configuration
 *
 * Use these values when connecting to a factory-default SDM630 device.
 */
export const DEFAULT_CONFIG = {
  baudRate: 9600,
  parity: 'none',
  dataBits: 8,
  stopBits: 1,
  defaultAddress: 1,
} as const satisfies DefaultSerialConfig

/**
 * One request reads one block of input registers (at most 80 registers).
 * The homy Modbus reader reads these same blocks from a real meter. The gaps inside
 * them are read without problems, but untested gaps are not merged.
 */
interface Block {
  address: number
  count: number
}

const MAIN: Block = { address: 0x00, count: 80 }
const DEMAND: Block = { address: 0x50, count: 8 }
const VA_DEMAND: Block = { address: 0x64, count: 4 }
const LINE_VOLTAGE: Block = { address: 0xc8, count: 8 }
const NEUTRAL_THD: Block = { address: 0xe0, count: 46 }
const ENERGY: Block = { address: 0x14e, count: 48 }

interface Register {
  block: Block
  /** Input register address */
  register: number
  point: DataPoint
}

const PHASES = ['l1', 'l2', 'l3']
const LINES = ['l1_l2', 'l2_l3', 'l3_l1']

/** A data point for one float32 register pair */
function single(
  block: Block,
  register: number,
  id: string,
  name: string,
  unit: DataPoint['unit'],
  decimals: number,
  description = name
): Register {
  return {
    block,
    register,
    point: { id, name, type: 'float', ...(unit && { unit }), access: 'r', description, decimals },
  }
}

/** Three data points, 2 registers apart, one per phase (or per line pair) */
function triple(
  block: Block,
  first: number,
  idPrefix: string,
  namePrefix: string,
  unit: DataPoint['unit'],
  decimals: number,
  suffixes = PHASES,
  description = ''
): Register[] {
  return suffixes.map((suffix, i) => {
    const label = suffix.toUpperCase().replace('_', '-')
    return single(
      block,
      first + i * 2,
      `${idPrefix}_${suffix}`,
      `${label} ${namePrefix}`,
      unit,
      decimals,
      `${label} ${namePrefix.toLowerCase()}${description}`
    )
  })
}

const DEGREES = ' (degrees)'

const REGISTERS: ReadonlyArray<Register> = [
  ...triple(MAIN, 0x00, 'voltage', 'Voltage', 'V', 1),
  ...triple(MAIN, 0x06, 'current', 'Current', 'A', 3),
  ...triple(MAIN, 0x0c, 'active_power', 'Active Power', 'W', 1),
  ...triple(MAIN, 0x12, 'apparent_power', 'Apparent Power', 'VA', 1),
  ...triple(MAIN, 0x18, 'reactive_power', 'Reactive Power', 'VAr', 1),
  ...triple(MAIN, 0x1e, 'power_factor', 'Power Factor', undefined, 3),
  ...triple(MAIN, 0x24, 'phase_angle', 'Phase Angle', undefined, 1, PHASES, DEGREES),
  single(MAIN, 0x2a, 'voltage_ln_average', 'Average L-N Voltage', 'V', 1),
  single(MAIN, 0x2e, 'current_average', 'Average Line Current', 'A', 3),
  single(MAIN, 0x30, 'current_sum', 'Sum of Line Currents', 'A', 3),
  single(MAIN, 0x34, 'active_power_total', 'Total Active Power', 'W', 1),
  single(MAIN, 0x38, 'apparent_power_total', 'Total Apparent Power', 'VA', 1),
  single(MAIN, 0x3c, 'reactive_power_total', 'Total Reactive Power', 'VAr', 1),
  single(MAIN, 0x3e, 'power_factor_total', 'Total Power Factor', undefined, 3),
  single(
    MAIN,
    0x42,
    'phase_angle_total',
    'Total Phase Angle',
    undefined,
    1,
    'Total phase angle (degrees)'
  ),
  single(MAIN, 0x46, 'frequency', 'Grid Frequency', 'Hz', 2),
  single(MAIN, 0x48, 'active_energy_forward', 'Import Active Energy', 'kWh', 2),
  single(MAIN, 0x4a, 'active_energy_reverse', 'Export Active Energy', 'kWh', 2),
  single(MAIN, 0x4c, 'reactive_energy_forward', 'Import Reactive Energy', 'kVArh', 2),
  single(MAIN, 0x4e, 'reactive_energy_reverse', 'Export Reactive Energy', 'kVArh', 2),
  single(
    DEMAND,
    0x50,
    'apparent_energy_total',
    'Total Apparent Energy',
    undefined,
    2,
    'Total apparent energy (kVAh)'
  ),
  single(DEMAND, 0x52, 'charge_total', 'Total Charge', 'Ah', 2),
  single(DEMAND, 0x54, 'active_power_demand', 'Total Active Power Demand', 'W', 1),
  single(
    DEMAND,
    0x56,
    'active_power_demand_max',
    'Maximum Total Active Power Demand',
    'W',
    1,
    'Maximum total active power demand (the manual says VA, the real meter gives W)'
  ),
  single(VA_DEMAND, 0x64, 'apparent_power_demand', 'Total Apparent Power Demand', 'VA', 1),
  single(VA_DEMAND, 0x66, 'apparent_power_demand_max', 'Maximum Apparent Power Demand', 'VA', 1),
  ...triple(LINE_VOLTAGE, 0xc8, 'voltage', 'Voltage', 'V', 1, LINES),
  single(LINE_VOLTAGE, 0xce, 'voltage_ll_average', 'Average L-L Voltage', 'V', 1),
  single(NEUTRAL_THD, 0xe0, 'current_neutral', 'Neutral Current', 'A', 3),
  ...triple(NEUTRAL_THD, 0xea, 'voltage_thd', 'Voltage THD', '%', 2),
  ...triple(NEUTRAL_THD, 0xf0, 'current_thd', 'Current THD', '%', 2),
  single(NEUTRAL_THD, 0xf8, 'voltage_thd_ln_average', 'Average L-N Voltage THD', '%', 2),
  single(NEUTRAL_THD, 0xfa, 'current_thd_average', 'Average Current THD', '%', 2),
  ...triple(NEUTRAL_THD, 0x102, 'current_demand', 'Current Demand', 'A', 3),
  ...triple(NEUTRAL_THD, 0x108, 'current_demand_max', 'Maximum Current Demand', 'A', 3),
  ...triple(ENERGY, 0x14e, 'voltage_thd', 'Voltage THD', '%', 2, LINES),
  single(ENERGY, 0x154, 'voltage_thd_ll_average', 'Average L-L Voltage THD', '%', 2),
  single(ENERGY, 0x156, 'active_energy_total', 'Total Active Energy', 'kWh', 2),
  single(ENERGY, 0x158, 'reactive_energy_total', 'Total Reactive Energy', 'kVArh', 2),
  ...triple(ENERGY, 0x15a, 'active_energy_forward', 'Import Active Energy', 'kWh', 2),
  ...triple(ENERGY, 0x160, 'active_energy_reverse', 'Export Active Energy', 'kWh', 2),
  ...triple(ENERGY, 0x166, 'active_energy', 'Total Active Energy', 'kWh', 2),
  ...triple(ENERGY, 0x16c, 'reactive_energy_forward', 'Import Reactive Energy', 'kVArh', 2),
  ...triple(ENERGY, 0x172, 'reactive_energy_reverse', 'Export Reactive Energy', 'kVArh', 2),
  ...triple(ENERGY, 0x178, 'reactive_energy', 'Total Reactive Energy', 'kVArh', 2),
]

const DATA_POINTS: ReadonlyArray<DataPoint> = REGISTERS.map((r) => r.point)

const REGISTER_BY_ID = new Map(REGISTERS.map((r) => [r.point.id, r]))

/**
 * Create SDM630 device driver
 */
export const createDriver: CreateDriverFunction = (config: DriverConfig) => {
  const { transport } = config

  /** Read each needed block once and decode the requested ids */
  async function read(ids: string[]): Promise<Record<string, unknown>> {
    const unknown = ids.filter((id) => !REGISTER_BY_ID.has(id))
    if (unknown.length > 0) {
      throw new Error(`Unknown data points: ${unknown.join(', ')}`)
    }

    const wanted = ids.map((id) => REGISTER_BY_ID.get(id) as Register)
    const blocks = new Set(wanted.map((r) => r.block))
    const buffers = new Map<Block, Buffer>()
    for (const block of blocks) {
      buffers.set(block, await transport.readInputRegisters(block.address, block.count))
    }

    const result: Record<string, unknown> = {}
    for (const { block, register, point } of wanted) {
      result[point.id] = readFloatBE(buffers.get(block) as Buffer, (register - block.address) * 2)
    }
    return result
  }

  const driver: DeviceDriver = {
    name: 'SDM630',
    manufacturer: 'Eastron',
    model: 'SDM630',
    dataPoints: DATA_POINTS,

    async readDataPoint(id: string): Promise<unknown> {
      if (!REGISTER_BY_ID.has(id)) {
        throw new Error(`Unknown data point: ${id}`)
      }
      return (await read([id]))[id]
    },

    writeDataPoint(id: string): Promise<void> {
      return Promise.reject(new Error(`Data point ${id} is read-only`))
    },

    readDataPoints: read,
  }

  return Promise.resolve(driver)
}
